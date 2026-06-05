import type { User as FirebaseUser } from "firebase/auth";

export async function notifyScheduleEventCreated(input: {
  firebaseUser: FirebaseUser;
  workspaceId: string;
  projectId: string;
  projectName: string;
  eventTitle: string;
  eventDate: string;
  notes?: string;
}): Promise<void> {
  try {
    const idToken = await input.firebaseUser.getIdToken();
    const response = await fetch("/api/schedule-events/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        eventTitle: input.eventTitle,
        eventDate: input.eventDate,
        notes: input.notes ?? "",
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      console.warn(
        "[notifyScheduleEvent]",
        payload.error ?? `Request failed with status ${response.status}`
      );
    }
  } catch (error) {
    console.warn(
      "[notifyScheduleEvent]",
      error instanceof Error ? error.message : "Failed to notify project members"
    );
  }
}
