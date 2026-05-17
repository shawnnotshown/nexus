import type { User as FirebaseUser } from "firebase/auth";
import { collectUserIdentityIds } from "./firestoreMappers";
import type { User } from "../types";

export function filterAssigneesForNotification(
  assigneeIds: string[],
  currentUser: User,
  users: { id: string; email?: string | null }[],
  authUid: string | null | undefined
): string[] {
  const identity = new Set(
    collectUserIdentityIds(currentUser.id, authUid, users, currentUser.email)
  );
  return [...new Set(assigneeIds.map((id) => id.trim()).filter(Boolean))].filter(
    (id) => !identity.has(id)
  );
}

export async function notifyTaskAssignment(input: {
  firebaseUser: FirebaseUser;
  workspaceId: string;
  projectId: string;
  projectName: string;
  taskTitle: string;
  assigneeIds: string[];
  source?: "todo" | "kanban";
}): Promise<void> {
  const assigneeIds = input.assigneeIds.map((id) => id.trim()).filter(Boolean);
  if (assigneeIds.length === 0) return;

  try {
    const idToken = await input.firebaseUser.getIdToken();
    const response = await fetch("/api/task-assignments/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        projectName: input.projectName,
        taskTitle: input.taskTitle,
        assigneeIds,
        source: input.source ?? "todo",
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      console.warn(
        "[notifyTaskAssignment]",
        payload.error ?? `Request failed with status ${response.status}`
      );
    }
  } catch (error) {
    console.warn(
      "[notifyTaskAssignment]",
      error instanceof Error ? error.message : "Failed to notify assignees"
    );
  }
}
