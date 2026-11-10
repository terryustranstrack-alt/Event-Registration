import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { publicEnv } from "@/lib/env";
import { pickLocalized, getTranslator, type Locale } from "@/lib/i18n/translate";
import { buildIcsFile } from "@/lib/calendar-invite";
import { qrCodePngBuffer } from "@/lib/qr-code-image";
import { sendEmail, type SendResult } from "./email-provider";
import { invitationEmail, ticketEmail } from "./email-templates";

const MAX_ATTEMPTS = 5;

interface EmailJob {
  id: string;
  kind: "ticket" | "invitation";
  registration_id: string | null;
  invitation_id: string | null;
  attempts: number;
}

/**
 * Process pending email jobs (FR-7.2). Called right after registration (for
 * the < 1 minute delivery target) and every minute by cron as a safety net.
 */
export async function processEmailQueue(options: { limit?: number; onlyJobId?: string } = {}) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: jobs, error } = await supabase.rpc("claim_email_jobs", {
    p_limit: options.limit ?? 20,
    p_only_id: options.onlyJobId ?? null,
  });
  if (error) throw new Error(`claim_email_jobs failed: ${error.message}`);

  const results: { id: string; ok: boolean }[] = [];
  for (const job of (jobs ?? []) as EmailJob[]) {
    let result: SendResult;
    try {
      result = job.kind === "ticket" ? await sendTicketJob(job) : await sendInvitationJob(job);
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err), retryable: true };
    }
    await recordResult(job, result);
    results.push({ id: job.id, ok: result.ok });
  }
  return results;
}

async function recordResult(job: EmailJob, result: SendResult) {
  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();
  if (result.ok) {
    await supabase
      .from("email_jobs")
      .update({ status: "sent", sent_at: now, provider_message_id: result.messageId ?? null, last_error: null, locked_until: null })
      .eq("id", job.id);
    if (job.registration_id) {
      await supabase
        .from("registrations")
        .update({ email_status: "sent", email_sent_at: now, email_error: null })
        .eq("id", job.registration_id);
    }
    return;
  }
  const giveUp = !result.retryable || job.attempts >= MAX_ATTEMPTS;
  const backoffSeconds = 30 * 2 ** (job.attempts - 1); // 30s, 1m, 2m, 4m…
  await supabase
    .from("email_jobs")
    .update({
      status: giveUp ? "failed" : "pending",
      last_error: result.error ?? "unknown error",
      run_after: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
      locked_until: null,
    })
    .eq("id", job.id);
  if (job.registration_id && giveUp) {
    await supabase
      .from("registrations")
      .update({ email_status: "failed", email_error: result.error ?? "unknown error" })
      .eq("id", job.registration_id);
  }
}

async function sendTicketJob(job: EmailJob): Promise<SendResult> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: reg } = await supabase
    .from("registrations")
    .select(
      "id, full_name, email, language, ticket_code, status, event:events(id, title_en, title_id, description_en, description_id, starts_at, ends_at, timezone, venue_name, venue_address, maps_url, online_url), org:organizations(name, logo_url, contact_email)",
    )
    .eq("id", job.registration_id!)
    .single();
  if (!reg) return { ok: false, error: "registration not found", retryable: false };
  if (reg.status === "cancelled") return { ok: false, error: "registration cancelled", retryable: false };

  const event = reg.event as unknown as {
    id: string;
    title_en: string | null;
    title_id: string | null;
    starts_at: string;
    ends_at: string;
    timezone: string;
    venue_name: string | null;
    venue_address: string | null;
    maps_url: string | null;
    online_url: string | null;
  };
  const org = reg.org as unknown as { name: string; logo_url: string | null; contact_email: string | null };
  const locale = reg.language as Locale;
  const title = pickLocalized(locale, event.title_en, event.title_id);
  const site = publicEnv.siteUrl;
  const ticketUrl = `${site}/t/${reg.ticket_code}`;
  const venue = [event.venue_name, event.venue_address].filter(Boolean).join(", ") || null;

  const content = ticketEmail({
    locale,
    orgName: org.name,
    orgLogoUrl: org.logo_url,
    registrantName: reg.full_name,
    eventTitle: title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone,
    venue,
    mapsUrl: event.maps_url,
    onlineUrl: event.online_url,
    ticketUrl,
    qrImageUrl: `${site}/api/tickets/${reg.ticket_code}/qr-code`,
    ticketCode: reg.ticket_code,
  });
  const ics = buildIcsFile({
    uid: `${reg.id}@racik-events`,
    title,
    location: event.online_url ?? venue ?? undefined,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    url: ticketUrl,
  });
  const qr = await qrCodePngBuffer(reg.ticket_code);

  return sendEmail({
    to: { email: reg.email, name: reg.full_name },
    replyTo: org.contact_email ? { email: org.contact_email, name: org.name } : undefined,
    ...content,
    attachments: [
      { name: "ticket-qr.png", contentBase64: qr.toString("base64") },
      { name: "event.ics", contentBase64: Buffer.from(ics).toString("base64") },
    ],
  });
}

async function sendInvitationJob(job: EmailJob): Promise<SendResult> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("email, role, token, accepted_at, org:organizations(name, logo_url, default_language)")
    .eq("id", job.invitation_id!)
    .single();
  if (!inv) return { ok: false, error: "invitation not found", retryable: false };
  if (inv.accepted_at) return { ok: true, messageId: "already-accepted" };
  const org = inv.org as unknown as { name: string; logo_url: string | null; default_language: Locale };
  const t = getTranslator(org.default_language);
  const content = invitationEmail({
    locale: org.default_language,
    orgName: org.name,
    orgLogoUrl: org.logo_url,
    roleLabel: t(inv.role === "admin" ? "team.role.admin" : "team.role.staff"),
    acceptUrl: `${publicEnv.siteUrl}/invite/${inv.token}`,
  });
  return sendEmail({ to: { email: inv.email }, ...content });
}
