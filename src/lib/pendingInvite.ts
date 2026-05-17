/** sessionStorage payload for invite-before-workspace bootstrap */
export const PENDING_INVITE_KEY = "nexus_pending_invite";

export interface PendingInvite {
  workspaceId: string;
  token: string;
}

export function serializePendingInvite(workspaceId: string, token: string): string {
  return JSON.stringify({ workspaceId, token });
}

export function parsePendingInvite(raw: string | null): PendingInvite | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as { workspaceId?: string; token?: string };
    if (
      typeof o.workspaceId === "string" &&
      o.workspaceId.length > 0 &&
      typeof o.token === "string" &&
      o.token.length > 0
    ) {
      return { workspaceId: o.workspaceId, token: o.token };
    }
  } catch {
    // ignore
  }
  return null;
}
