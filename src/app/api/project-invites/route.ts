import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

interface CreateInviteBody {
  workspaceId?: string;
  projectId?: string;
  email?: string;
  sendEmail?: boolean;
}

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

function normalizeEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function appUrl() {
  return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateInviteBody;
    const workspaceId = body.workspaceId?.trim();
    const projectId = body.projectId?.trim();
    const email = normalizeEmail(body.email);
    const sendEmail = Boolean(body.sendEmail);

    if (!workspaceId || !projectId) {
      return NextResponse.json({ error: "workspaceId and projectId are required." }, { status: 400 });
    }

    if (sendEmail && !email) {
      return NextResponse.json({ error: "Email is required when sending invitation email." }, { status: 400 });
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
    const projectRef = db.doc(`workspaces/${workspaceId}/projects/${projectId}`);
    const [memberSnap, projectSnap] = await Promise.all([memberRef.get(), projectRef.get()]);

    if (!memberSnap.exists) {
      return NextResponse.json({ error: "Only workspace members can create invites." }, { status: 403 });
    }
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const inviteToken = randomBytes(32).toString("base64url");
    const inviteRef = db.doc(`workspaces/${workspaceId}/projectInvites/${inviteToken}`);
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    await inviteRef.set({
      workspaceId,
      projectId,
      createdByUid: uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      email: email ?? null,
      acceptedAt: null,
      acceptedByUid: null,
    });

    const baseUrl = appUrl();
    if (!baseUrl) {
      return NextResponse.json({ error: "Missing APP_URL configuration." }, { status: 500 });
    }
    const inviteUrl = `${baseUrl}/join?w=${encodeURIComponent(workspaceId)}&t=${encodeURIComponent(inviteToken)}`;

    if (sendEmail && email) {
      const resendApiKey = process.env.RESEND_API_KEY;
      const resendFrom = process.env.RESEND_FROM;
      if (!resendApiKey || !resendFrom) {
        return NextResponse.json(
          { error: "RESEND_API_KEY and RESEND_FROM are required for email invites." },
          { status: 500 }
        );
      }
      const resend = new Resend(resendApiKey);
      const { error: resendError } = await resend.emails.send({
        from: resendFrom,
        to: email,
        subject: "You're invited to a Nexus project",
        text: `You were invited to join a Nexus project. Open this link to sign in and accept: ${inviteUrl}`,
        html: `<p>You were invited to join a Nexus project.</p><p><a href="${inviteUrl}">Open invite link</a></p><p>If the button doesn't work, copy this URL:<br/>${inviteUrl}</p>`,
      });
      if (resendError) {
        const detail =
          typeof resendError === "object" &&
          resendError !== null &&
          "message" in resendError &&
          typeof (resendError as { message: unknown }).message === "string"
            ? (resendError as { message: string }).message
            : JSON.stringify(resendError);
        console.error("[project-invites] Resend send failed:", resendError);
        return NextResponse.json(
          { error: `Email could not be sent (${detail}). Fix RESEND_FROM (use a full address like "Nexus <onboarding@resend.dev>" or a verified domain) and check the Resend dashboard.` },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ url: inviteUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create invite.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
