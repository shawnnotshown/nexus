import { format } from "date-fns";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { appUrl, normalizeEmail, sendResendMessage } from "./email";

export interface TeamMemberRecipient {
  userId: string;
  email: string;
  displayName: string;
}

function memberDisplayName(data: Record<string, unknown> | undefined): string {
  if (!data) return "A teammate";
  const name = data.name ?? data.displayName;
  return typeof name === "string" && name.trim() ? name.trim() : "A teammate";
}

export function formatEventDate(eventDateIso: string): string {
  const date = new Date(eventDateIso);
  if (Number.isNaN(date.getTime())) return eventDateIso;
  return format(date, "EEEE, MMMM d, yyyy");
}

async function resolveTeamMemberContact(
  db: Firestore,
  auth: Auth | undefined,
  userId: string,
  memberData: Record<string, unknown> | undefined
): Promise<{ email?: string; displayName: string }> {
  let displayName = memberDisplayName(memberData);
  let email = normalizeEmail(
    typeof memberData?.email === "string" ? memberData.email : undefined
  );
  if (email) return { email, displayName };

  const userSnap = await db.doc(`users/${userId}`).get();
  if (userSnap.exists) {
    const userData = userSnap.data() as Record<string, unknown>;
    email = normalizeEmail(typeof userData.email === "string" ? userData.email : undefined);
    if (email) return { email, displayName };
  }

  if (!auth) return { displayName };

  try {
    const authUser = await auth.getUser(userId);
    email = normalizeEmail(authUser.email);
    if (authUser.displayName?.trim()) displayName = authUser.displayName.trim();
    return { email, displayName };
  } catch {
    return { displayName };
  }
}

export async function resolveProjectTeamEmails(
  db: Firestore,
  workspaceId: string,
  projectId: string,
  auth?: Auth
): Promise<{ projectName: string; recipients: TeamMemberRecipient[]; teamSize: number }> {
  const projectSnap = await db.doc(`workspaces/${workspaceId}/projects/${projectId}`).get();
  if (!projectSnap.exists) {
    return { projectName: "a project", recipients: [], teamSize: 0 };
  }

  const projectData = projectSnap.data() as Record<string, unknown>;
  const projectName =
    typeof projectData.name === "string" && projectData.name.trim()
      ? projectData.name.trim()
      : "a project";
  const team = Array.isArray(projectData.team)
    ? projectData.team.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  const recipients: TeamMemberRecipient[] = [];
  for (const userId of [...new Set(team)]) {
    const memberSnap = await db.doc(`workspaces/${workspaceId}/members/${userId}`).get();
    const memberData = memberSnap.exists
      ? (memberSnap.data() as Record<string, unknown>)
      : undefined;
    const contact = await resolveTeamMemberContact(db, auth, userId, memberData);
    if (!contact.email) continue;

    recipients.push({
      userId,
      email: contact.email,
      displayName: contact.displayName,
    });
  }

  return { projectName, recipients, teamSize: team.length };
}

export function buildScheduleEventEmail(input: {
  kind: "created" | "reminder";
  creatorName: string;
  projectName: string;
  eventTitle: string;
  eventDate: string;
  notes?: string;
  baseUrl: string;
}): { subject: string; text: string; html: string } {
  const formattedDate = formatEventDate(input.eventDate);
  const notesLine = input.notes?.trim() ? input.notes.trim() : "";
  const notesText = notesLine ? `\nNotes: ${notesLine}` : "";
  const notesHtml = notesLine ? `<p><strong>Notes:</strong> ${notesLine}</p>` : "";

  if (input.kind === "created") {
    const subject = `${input.creatorName} scheduled an event in ${input.projectName}`;
    const text = [
      `${input.creatorName} scheduled an event in ${input.projectName}.`,
      ``,
      `Event: ${input.eventTitle}`,
      `Date: ${formattedDate}`,
      notesText,
      ``,
      `Open Nexus: ${input.baseUrl}`,
    ]
      .filter((line, i, arr) => !(line === "" && arr[i + 1] === ""))
      .join("\n");
    const html = [
      `<p><strong>${input.creatorName}</strong> scheduled an event in <strong>${input.projectName}</strong>.</p>`,
      `<p><strong>Event:</strong> ${input.eventTitle}</p>`,
      `<p><strong>Date:</strong> ${formattedDate}</p>`,
      notesHtml,
      `<p><a href="${input.baseUrl}">Open Nexus</a></p>`,
      `<p>If the link doesn't work, copy this URL:<br/>${input.baseUrl}</p>`,
    ]
      .filter(Boolean)
      .join("");
    return { subject, text, html };
  }

  const subject = `Reminder: ${input.eventTitle} is tomorrow in ${input.projectName}`;
  const text = [
    `This is a reminder that an event is happening tomorrow in ${input.projectName}.`,
    ``,
    `Event: ${input.eventTitle}`,
    `Date: ${formattedDate}`,
    notesText,
    ``,
    `Open Nexus: ${input.baseUrl}`,
  ]
    .filter((line, i, arr) => !(line === "" && arr[i + 1] === ""))
    .join("\n");
  const html = [
    `<p>This is a reminder that an event is happening <strong>tomorrow</strong> in <strong>${input.projectName}</strong>.</p>`,
    `<p><strong>Event:</strong> ${input.eventTitle}</p>`,
    `<p><strong>Date:</strong> ${formattedDate}</p>`,
    notesHtml,
    `<p><a href="${input.baseUrl}">Open Nexus</a></p>`,
    `<p>If the link doesn't work, copy this URL:<br/>${input.baseUrl}</p>`,
  ]
    .filter(Boolean)
    .join("");
  return { subject, text, html };
}

export async function sendScheduleEventEmailsToTeam(input: {
  recipients: TeamMemberRecipient[];
  emailContent: { subject: string; text: string; html: string };
}): Promise<{
  sent: number;
  noEmailSkipped: number;
  failed: boolean;
  detail?: string;
  partial?: boolean;
}> {
  let sent = 0;
  let noEmailSkipped = 0;

  for (const recipient of input.recipients) {
    if (!recipient.email) {
      noEmailSkipped += 1;
      continue;
    }

    const result = await sendResendMessage({
      to: recipient.email,
      subject: input.emailContent.subject,
      text: input.emailContent.text,
      html: input.emailContent.html,
    });

    if (!result.ok) {
      return {
        sent,
        noEmailSkipped,
        failed: true,
        detail: result.detail,
        partial: sent > 0,
      };
    }
    sent += 1;
  }

  return { sent, noEmailSkipped, failed: false };
}

export function getTomorrowUtcRange(): { tomorrowStart: string; dayAfterTomorrowStart: string } {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayAfterTomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2)
  );
  return {
    tomorrowStart: tomorrow.toISOString(),
    dayAfterTomorrowStart: dayAfterTomorrow.toISOString(),
  };
}

export function parseScheduleEventPath(
  path: string
): { workspaceId: string; projectId: string; eventId: string } | null {
  const match = path.match(/^workspaces\/([^/]+)\/projects\/([^/]+)\/scheduleEvents\/([^/]+)$/);
  if (!match) return null;
  return { workspaceId: match[1], projectId: match[2], eventId: match[3] };
}

export function configuredAppUrl(): string | null {
  const baseUrl = appUrl();
  return baseUrl || null;
}
