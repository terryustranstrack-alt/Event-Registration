import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * One messaging module (NFR Maintainability): the rest of the app only calls
 * sendEmail(); swap Brevo for another provider here.
 */
export interface OutgoingEmail {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  replyTo?: { email: string; name?: string };
  attachments?: { name: string; contentBase64: string }[];
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

export async function sendEmail(message: OutgoingEmail): Promise<SendResult> {
  const env = serverEnv();
  if (!env.brevoApiKey) {
    // Local development: log instead of sending.
    console.info(`[email:dev] to=${message.to.email} subject="${message.subject}"`);
    return { ok: true, messageId: "dev-log" };
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.brevoApiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: env.emailFromAddress, name: env.emailFromName },
        to: [message.to],
        replyTo: message.replyTo,
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        attachment: message.attachments?.map((a) => ({ name: a.name, content: a.contentBase64 })),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { messageId?: string };
      return { ok: true, messageId: data.messageId };
    }
    const body = await res.text();
    return { ok: false, error: `Brevo ${res.status}: ${body.slice(0, 300)}`, retryable: res.status >= 500 || res.status === 429 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), retryable: true };
  }
}
