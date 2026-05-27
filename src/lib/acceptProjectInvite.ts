export interface AcceptInviteResult {
  workspaceId: string;
  projectId?: string;
  alreadyAccepted?: boolean;
}

/** Accept a pending project invite via the server API. */
export async function acceptProjectInvite(
  idToken: string,
  workspaceId: string,
  token: string
): Promise<AcceptInviteResult> {
  const response = await fetch("/api/project-invites/accept", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ workspaceId, token }),
  });

  const payload = (await response.json()) as {
    error?: string;
    workspaceId?: string;
    projectId?: string;
  };

  if (response.ok) {
    return {
      workspaceId: payload.workspaceId ?? workspaceId,
      projectId: payload.projectId,
    };
  }

  if (response.status === 409) {
    return {
      workspaceId: payload.workspaceId ?? workspaceId,
      projectId: payload.projectId,
      alreadyAccepted: true,
    };
  }

  throw new Error(payload.error ?? "Failed to accept invite.");
}
