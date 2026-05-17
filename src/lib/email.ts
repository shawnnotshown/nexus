import type { NextRequest } from "next/server";
import { Resend } from "resend";

export function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

export function appUrl(): string {
  return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export function normalizeEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export type SendResendResult =
  | { ok: true }
  | { ok: false; detail: string; status: 500 | 502 };

export async function sendResendMessage(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendResendResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  if (!resendApiKey || !resendFrom) {
    return {
      ok: false,
      status: 500,
      detail: "RESEND_API_KEY and RESEND_FROM are required to send email.",
    };
  }

  const resend = new Resend(resendApiKey);
  const { error: resendError } = await resend.emails.send({
    from: resendFrom,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  if (resendError) {
    const detail =
      typeof resendError === "object" &&
      resendError !== null &&
      "message" in resendError &&
      typeof (resendError as { message: unknown }).message === "string"
        ? (resendError as { message: string }).message
        : JSON.stringify(resendError);
    return { ok: false, status: 502, detail };
  }

  return { ok: true };
}

export function resendFailureMessage(detail: string): string {
  return `Email could not be sent (${detail}). Fix RESEND_FROM (use a full address like "Nexus <onboarding@resend.dev>" or a verified domain) and check the Resend dashboard.`;
}
