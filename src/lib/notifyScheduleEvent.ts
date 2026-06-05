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

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      sent?: number;
      message?: string;
      teamSize?: number;
      recipients?: number;
    };

    if (!response.ok) {
      console.warn(
        "[notifyScheduleEvent]",
        payload.error ?? `Request failed with status ${response.status}`
      );
      return;
    }

    if ((payload.sent ?? 0) === 0) {
      console.warn(
        "[notifyScheduleEvent] No emails sent.",
        payload.message ?? `teamSize=${payload.teamSize ?? "?"} recipients=${payload.recipients ?? 0}`
      );
      return;
    }

    console.info("[notifyScheduleEvent] Sent", payload.sent, "email(s).");
  } catch (error) {
    console.warn(
      "[notifyScheduleEvent]",
      error instanceof Error ? error.message : "Failed to notify project members"
    );
  }
}
