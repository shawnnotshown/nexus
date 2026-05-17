import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import {
  appUrl,
  getBearerToken,
  normalizeEmail,
  resendFailureMessage,
  sendResendMessage,
} from "@/lib/email";

interface CreateInviteBody {
  workspaceId?: string;
  projectId?: string;
  email?: string;
  sendEmail?: boolean;
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
      const result = await sendResendMessage({
        to: email,
        subject: "You're invited to a Nexus project",
        text: `You were invited to join a Nexus project. Open this link to sign in and accept: ${inviteUrl}`,
        html: `<p>You were invited to join a Nexus project.</p><p><a href="${inviteUrl}">Open invite link</a></p><p>If the button doesn't work, copy this URL:<br/>${inviteUrl}</p>`,
      });
      if (!result.ok) {
        console.error("[project-invites] Resend send failed:", result.detail);
        return NextResponse.json({ error: resendFailureMessage(result.detail) }, { status: result.status });
      }
    }

    return NextResponse.json({ url: inviteUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create invite.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
