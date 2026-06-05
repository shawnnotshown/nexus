import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  buildScheduleEventEmail,
  configuredAppUrl,
  getTomorrowUtcRange,
  parseScheduleEventPath,
  resolveProjectTeamEmails,
  sendScheduleEventEmailsToTeam,
} from "@/lib/scheduleEventEmails";

function getCronSecret(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }
  const querySecret = req.nextUrl.searchParams.get("secret")?.trim();
  return querySecret || null;
}

export async function GET(req: NextRequest) {
  try {
    const expectedSecret = process.env.CRON_SECRET?.trim();
    if (!expectedSecret) {
      return NextResponse.json({ error: "Missing CRON_SECRET configuration." }, { status: 500 });
    }

    const providedSecret = getCronSecret(req);
    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const baseUrl = configuredAppUrl();
    if (!baseUrl) {
      return NextResponse.json({ error: "Missing APP_URL configuration." }, { status: 500 });
    }

    const db = getAdminDb();
    const { tomorrowStart, dayAfterTomorrowStart } = getTomorrowUtcRange();

    const eventsSnap = await db
      .collectionGroup("scheduleEvents")
      .where("reminderSent", "==", false)
      .where("eventDate", ">=", tomorrowStart)
      .where("eventDate", "<", dayAfterTomorrowStart)
      .get();

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const eventDoc of eventsSnap.docs) {
      processed += 1;
      const parsed = parseScheduleEventPath(eventDoc.ref.path);
      if (!parsed) {
        skipped += 1;
        errors.push(`Invalid event path: ${eventDoc.ref.path}`);
        continue;
      }

      const data = eventDoc.data() as Record<string, unknown>;
      const eventTitle =
        typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Scheduled event";
      const eventDate =
        typeof data.eventDate === "string"
          ? data.eventDate
          : data.eventDate instanceof Date
            ? data.eventDate.toISOString()
            : "";
      const notes = typeof data.notes === "string" ? data.notes : "";

      if (!eventDate) {
        skipped += 1;
        errors.push(`Missing eventDate for ${eventDoc.ref.path}`);
        continue;
      }

      const { projectName, recipients } = await resolveProjectTeamEmails(
        db,
        parsed.workspaceId,
        parsed.projectId
      );

      if (recipients.length === 0) {
        await eventDoc.ref.update({
          reminderSent: true,
          reminderSentAt: FieldValue.serverTimestamp(),
        });
        skipped += 1;
        continue;
      }

      const emailContent = buildScheduleEventEmail({
        kind: "reminder",
        creatorName: "Nexus",
        projectName,
        eventTitle,
        eventDate,
        notes,
        baseUrl,
      });

      const result = await sendScheduleEventEmailsToTeam({ recipients, emailContent });
      if (result.failed) {
        errors.push(`Failed to send for ${eventDoc.ref.path}: ${result.detail ?? "Unknown error"}`);
        continue;
      }

      await eventDoc.ref.update({
        reminderSent: true,
        reminderSentAt: FieldValue.serverTimestamp(),
      });

      sent += result.sent;
    }

    return NextResponse.json({
      processed,
      sent,
      skipped,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process schedule event reminders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
