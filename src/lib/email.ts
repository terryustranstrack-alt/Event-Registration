import "server-only";
import nodemailer from "nodemailer";

// All app email goes through this one file, using the mail server (SMTP)
// set in the environment: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and
// EMAIL_FROM (e.g. "Racik EventMu <no-reply@tickets.racikdigital.com>").

function readSetting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Email is not set up: missing ${name}.`);
  return value;
}

// Connects on port 587 and upgrades to an encrypted connection (STARTTLS)
// before logging in. requireTLS refuses to send if the server can't encrypt.
function createMailTransport() {
  return nodemailer.createTransport({
    host: readSetting("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user: readSetting("SMTP_USER"), pass: readSetting("SMTP_PASS") },
  });
}

/** Send one email. Throws if the mail server rejects it, so callers can retry. */
export async function sendEmail(to: string, subject: string, html: string): Promise<{ messageId: string }> {
  const info = await createMailTransport().sendMail({ from: readSetting("EMAIL_FROM"), to, subject, html });
  return { messageId: info.messageId };
}
