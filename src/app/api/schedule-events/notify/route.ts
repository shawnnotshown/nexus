import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  buildScheduleEventEmail,
  configuredAppUrl,
  resolveProjectTeamEmails,
  sendScheduleEventEmailsToTeam,
} from "@/lib/scheduleEventEmails";
import { getBearerToken, resendFailureMessage } from "@/lib/email";

interface NotifyBody {
  workspaceId?: string;
  projectId?: string;
  eventTitle?: string;
  eventDate?: string;
  notes?: string;
}

function memberDisplayName(data: Record<string, unknown> | undefined): string {
  if (!data) return "A teammate";
  const name = data.name ?? data.displayName;
  return typeof name === "string" && name.trim() ? name.trim() : "A teammate";
}

async function canAccessProject(
  db: ReturnType<typeof getAdminDb>,
  workspaceId: string,
  projectId: string,
  uid: string
): Promise<boolean> {
  const [workspaceSnap, projectSnap, memberSnap] = await Promise.all([
    db.doc(`workspaces/${workspaceId}`).get(),
    db.doc(`workspaces/${workspaceId}/projects/${projectId}`).get(),
    db.doc(`workspaces/${workspaceId}/members/${uid}`).get(),
  ]);

  if (!projectSnap.exists || !memberSnap.exists) return false;

  const workspaceData = workspaceSnap.data() as Record<string, unknown> | undefined;
  const memberData = memberSnap.data() as Record<string, unknown> | undefined;
  const isOwner =
    workspaceData?.createdBy === uid ||
    (typeof memberData?.role === "string" && memberData.role === "owner");

  if (isOwner) return true;

  const projectData = projectSnap.data() as Record<string, unknown>;
  const team = Array.isArray(projectData.team) ? projectData.team : [];
  return team.includes(uid);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NotifyBody;
    const workspaceId = body.workspaceId?.trim();
    const projectId = body.projectId?.trim();
    const eventTitle = body.eventTitle?.trim();
    const eventDate = body.eventDate?.trim();
    const notes = body.notes?.trim() ?? "";

    if (!workspaceId || !projectId || !eventTitle || !eventDate) {
      return NextResponse.json(
        { error: "workspaceId, projectId, eventTitle, and eventDate are required." },
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

    const db = getAdminDb();
    const memberRef = db.doc(`workspaces/${workspaceId}/members/${uid}`);
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      return NextResponse.json(
        { error: "Only workspace members can send schedule event emails." },
        { status: 403 }
      );
    }

    const hasAccess = await canAccessProject(db, workspaceId, projectId, uid);
    if (!hasAccess) {
      return NextResponse.json({ error: "Project not found or access denied." }, { status: 403 });
    }

    const baseUrl = configuredAppUrl();
    if (!baseUrl) {
      return NextResponse.json({ error: "Missing APP_URL configuration." }, { status: 500 });
    }

    const creatorName = memberDisplayName(memberSnap.data() as Record<string, unknown>);
    const { projectName, recipients, teamSize } = await resolveProjectTeamEmails(
      db,
      workspaceId,
      projectId,
      auth
    );

    if (recipients.length === 0) {
      console.warn("[schedule-events/notify] No team recipients with email.", {
        workspaceId,
        projectId,
        teamSize,
      });
      return NextResponse.json({
        sent: 0,
        skipped: { noEmail: teamSize },
        teamSize,
        message:
          teamSize === 0
            ? "Project has no team members."
            : "No project team members have an email address on file.",
      });
    }

    const emailContent = buildScheduleEventEmail({
      kind: "created",
      creatorName,
      projectName,
      eventTitle,
      eventDate,
      notes,
      baseUrl,
    });

    const result = await sendScheduleEventEmailsToTeam({ recipients, emailContent });
    if (result.failed) {
      console.error("[schedule-events/notify] Resend send failed:", result.detail);
      if (result.partial && result.sent > 0) {
        return NextResponse.json({
          sent: result.sent,
          skipped: { noEmail: result.noEmailSkipped },
          teamSize,
          recipients: recipients.length,
          warning: resendFailureMessage(result.detail ?? "Unknown error"),
        });
      }
      return NextResponse.json(
        { error: resendFailureMessage(result.detail ?? "Unknown error") },
        { status: 502 }
      );
    }

    return NextResponse.json({
      sent: result.sent,
      skipped: { noEmail: result.noEmailSkipped },
      teamSize,
      recipients: recipients.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send schedule event notification.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
