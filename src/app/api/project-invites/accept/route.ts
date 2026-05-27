import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

interface AcceptInviteBody {
  token?: string;
  workspaceId?: string;
}

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

function memberProfile(verified: { name?: string | null; picture?: string | null; email?: string | null }) {
  return {
    role: "member",
    xp: 0,
    level: 1,
    badges: [] as string[],
    joinedAt: FieldValue.serverTimestamp(),
    displayName: verified.name ?? "",
    photoURL: verified.picture ?? "",
    name: verified.name ?? "Member",
    email: verified.email ?? "",
  };
}

/** Idempotent: ensures invitee has workspace membership and project team access. */
async function ensureInviteeAccess(
  db: ReturnType<typeof getAdminDb>,
  workspaceId: string,
  projectId: string,
  uid: string,
  verified: { name?: string | null; picture?: string | null; email?: string | null }
) {
  const memberRef = db.doc(`workspaces/${workspaceId}/members/${uid}`);
  const projectRef = db.doc(`workspaces/${workspaceId}/projects/${projectId}`);
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async (txn) => {
    const project = await txn.get(projectRef);
    if (!project.exists) throw new Error("Project no longer exists.");

    txn.set(memberRef, memberProfile(verified), { merge: true });
    txn.update(projectRef, { team: FieldValue.arrayUnion(uid) });
    txn.set(
      userRef,
      {
        displayName: verified.name ?? "",
        photoURL: verified.picture ?? "",
        email: verified.email ?? "",
        workspaceIds: FieldValue.arrayUnion(workspaceId),
        defaultWorkspaceId: workspaceId,
      },
      { merge: true }
    );
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AcceptInviteBody;
    const inviteToken = body.token?.trim();
    const workspaceIdParam = body.workspaceId?.trim();
    if (!inviteToken || !workspaceIdParam) {
      return NextResponse.json(
        { error: "workspaceId and token are required. Open the invite link from your email or a fresh copy." },
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
    const verifiedEmail = (verified.email ?? "").toLowerCase();

    const db = getAdminDb();
    const inviteRef = db.doc(`workspaces/${workspaceIdParam}/projectInvites/${inviteToken}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }

    const docSnap = inviteSnap;
    const inviteData = docSnap.data() as Record<string, unknown>;
    const docWorkspaceId =
      typeof inviteData.workspaceId === "string" ? inviteData.workspaceId : workspaceIdParam;
    if (typeof inviteData.workspaceId === "string" && inviteData.workspaceId !== workspaceIdParam) {
      return NextResponse.json({ error: "Invite link does not match this workspace." }, { status: 400 });
    }
    const workspaceId = docWorkspaceId;
    const projectId = typeof inviteData.projectId === "string" ? inviteData.projectId : null;
    const requiredEmail =
      typeof inviteData.email === "string" ? inviteData.email.trim().toLowerCase() : "";

    if (!workspaceId || !projectId) {
      return NextResponse.json({ error: "Invite payload is invalid." }, { status: 400 });
    }

    const expiresAt = inviteData.expiresAt as { toDate?: () => Date } | undefined;
    if (!expiresAt?.toDate || expiresAt.toDate().getTime() < Date.now()) {
      return NextResponse.json({ error: "Invite has expired." }, { status: 410 });
    }

    const acceptedByUid =
      typeof inviteData.acceptedByUid === "string" ? inviteData.acceptedByUid : null;
    if (inviteData.acceptedAt) {
      if (acceptedByUid === uid) {
        await ensureInviteeAccess(db, workspaceId, projectId, uid, verified);
        return NextResponse.json({ ok: true, workspaceId, projectId, alreadyAccepted: true });
      }
      return NextResponse.json({ error: "Invite was already accepted." }, { status: 409 });
    }

    if (requiredEmail && requiredEmail !== verifiedEmail) {
      return NextResponse.json(
        { error: "This invite is restricted to a different email address." },
        { status: 403 }
      );
    }

    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const projectRef = db.doc(`workspaces/${workspaceId}/projects/${projectId}`);

    await db.runTransaction(async (txn) => {
      const freshInvite = await txn.get(docSnap.ref);
      const freshData = freshInvite.data() as Record<string, unknown> | undefined;
      if (!freshData) throw new Error("Invite not found.");
      if (freshData.acceptedAt) throw new Error("Invite already accepted.");
      const freshExpires = freshData.expiresAt as { toDate?: () => Date } | undefined;
      if (!freshExpires?.toDate || freshExpires.toDate().getTime() < Date.now()) {
        throw new Error("Invite has expired.");
      }

      const project = await txn.get(projectRef);
      if (!project.exists) throw new Error("Project no longer exists.");

      const workspace = await txn.get(workspaceRef);
      if (!workspace.exists) throw new Error("Workspace no longer exists.");

      txn.update(docSnap.ref, {
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedByUid: uid,
      });
    });

    await ensureInviteeAccess(db, workspaceId, projectId, uid, verified);

    return NextResponse.json({ ok: true, workspaceId, projectId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to accept invite.";
    const status = message.toLowerCase().includes("expired")
      ? 410
      : message.toLowerCase().includes("already")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
