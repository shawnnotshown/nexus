import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { appUrl, getBearerToken, normalizeEmail, resendFailureMessage, sendResendMessage } from "@/lib/email";

interface NotifyBody {
  workspaceId?: string;
  projectId?: string;
  projectName?: string;
  taskTitle?: string;
  assigneeIds?: string[];
  source?: "todo" | "kanban";
}

function memberDisplayName(data: Record<string, unknown> | undefined): string {
  if (!data) return "A teammate";
  const name = data.name ?? data.displayName;
  return typeof name === "string" && name.trim() ? name.trim() : "A teammate";
}

function collectCallerIdentityIds(
  uid: string,
  tokenEmail: string | undefined,
  members: { id: string; email?: string }[]
): Set<string> {
  const ids = new Set<string>();
  if (uid.trim()) ids.add(uid.trim());
  const email = tokenEmail?.trim().toLowerCase();
  if (email) {
    for (const m of members) {
      if (m.email?.trim().toLowerCase() === email) ids.add(m.id.trim());
    }
  }
  return ids;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NotifyBody;
    const workspaceId = body.workspaceId?.trim();
    const projectId = body.projectId?.trim();
    const taskTitle = body.taskTitle?.trim();
    const assigneeIds = (body.assigneeIds ?? [])
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter((id) => id.length > 0);
    const source = body.source === "kanban" ? "kanban" : "todo";

    if (!workspaceId || !projectId || !taskTitle) {
      return NextResponse.json(
        { error: "workspaceId, projectId, and taskTitle are required." },
        { status: 400 }
      );
    }
    if (assigneeIds.length === 0) {
      return NextResponse.json(
        { error: "assigneeIds must include at least one user id." },
        { status: 400 }
      );
    }

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const auth = getAdminAuth();
    const verified = await auth.verifyIdToken(token);
    const uid = verified.uid;
    const tokenEmail = normalizeEmail(verified.email);

    const db = getAdminDb();
    const memberRef = db.doc(`workspaces/${workspaceId}/members/${uid}`);
    const projectRef = db.doc(`workspaces/${workspaceId}/projects/${projectId}`);
    const membersCol = db.collection(`workspaces/${workspaceId}/members`);

    const [memberSnap, projectSnap, membersSnap] = await Promise.all([
      memberRef.get(),
      projectRef.get(),
      membersCol.get(),
    ]);

    if (!memberSnap.exists) {
      return NextResponse.json({ error: "Only workspace members can send assignment emails." }, { status: 403 });
    }
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const baseUrl = appUrl();
    if (!baseUrl) {
      return NextResponse.json({ error: "Missing APP_URL configuration." }, { status: 500 });
    }

    const members = membersSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const email = typeof data.email === "string" ? normalizeEmail(data.email) : undefined;
      return { id: doc.id, email };
    });

    const identityIds = collectCallerIdentityIds(uid, tokenEmail, members);
    const assignerName = memberDisplayName(memberSnap.data() as Record<string, unknown>);
    const projectData = projectSnap.data() as Record<string, unknown> | undefined;
    const projectName =
      body.projectName?.trim() ||
      (typeof projectData?.name === "string" ? projectData.name.trim() : "") ||
      "a project";

    const sourceLabel = source === "kanban" ? "Kanban card" : "To-Do task";
    let selfSkipped = 0;
    let noEmailSkipped = 0;
    let sent = 0;

    const uniqueTargets = [...new Set(assigneeIds)];
    for (const assigneeId of uniqueTargets) {
      if (identityIds.has(assigneeId)) {
        selfSkipped += 1;
        continue;
      }

      const assigneeSnap = await db.doc(`workspaces/${workspaceId}/members/${assigneeId}`).get();
      if (!assigneeSnap.exists) {
        noEmailSkipped += 1;
        continue;
      }

      const assigneeData = assigneeSnap.data() as Record<string, unknown>;
      const to = normalizeEmail(
        typeof assigneeData.email === "string" ? assigneeData.email : undefined
      );
      if (!to) {
        noEmailSkipped += 1;
        continue;
      }

      const subject = `${assignerName} assigned you a task in ${projectName}`;
      const text = [
        `${assignerName} assigned you a ${sourceLabel} in ${projectName}.`,
        ``,
        `Task: ${taskTitle}`,
        ``,
        `Open Nexus: ${baseUrl}`,
      ].join("\n");
      const html = [
        `<p><strong>${assignerName}</strong> assigned you a ${sourceLabel} in <strong>${projectName}</strong>.</p>`,
        `<p><strong>Task:</strong> ${taskTitle}</p>`,
        `<p><a href="${baseUrl}">Open Nexus</a></p>`,
        `<p>If the link doesn't work, copy this URL:<br/>${baseUrl}</p>`,
      ].join("");

      const result = await sendResendMessage({ to, subject, text, html });
      if (!result.ok) {
        console.error("[task-assignments/notify] Resend send failed:", result.detail);
        return NextResponse.json(
          { error: resendFailureMessage(result.detail) },
          { status: result.status }
        );
      }
      sent += 1;
    }

    return NextResponse.json({
      sent,
      skipped: { self: selfSkipped, noEmail: noEmailSkipped },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send assignment notification.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
