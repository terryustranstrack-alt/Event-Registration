import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { publicEnv } from "@/lib/env";
import { pickLocalized, getTranslator, type Locale } from "@/lib/i18n/translate";
import { sendEmail } from "@/lib/email";
import { invitationEmail, reminderEmail, ticketEmail, waitlistEmail, type TicketEmailInput } from "./email-templates";

const MAX_ATTEMPTS = 5;

// Outcome of one send attempt, used to decide whether to retry later.
interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

// Sends through the shared SMTP helper. A rejected send is retried later
// (the mail server may just be busy), so failures are marked retryable.
async function deliver(to: string, content: { subject: string; html: string }): Promise<SendResult> {
  try {
    const { messageId } = await sendEmail(to, content.subject, content.html);
    return { ok: true, messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), retryable: true };
  }
}

interface EmailJob {
  id: string;
  kind: "ticket" | "invitation" | "reminder" | "waitlist";
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
      result = await sendJob(job);
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err), retryable: true };
    }
    await recordResult(job, result);
    results.push({ id: job.id, ok: result.ok });
  }
  return results;
}

// Pilih cara kirim sesuai jenis email.
function sendJob(job: EmailJob): Promise<SendResult> {
  if (job.kind === "ticket") return sendTicketJob(job);
  if (job.kind === "reminder") return sendReminderJob(job);
  if (job.kind === "waitlist") return sendWaitlistJob(job);
  return sendInvitationJob(job);
}

async function recordResult(job: EmailJob, result: SendResult) {
  // Status email di daftar pendaftar ("terkirim"/"gagal") hanya tentang tiket.
  // Email pengingat tidak boleh menimpanya.
  const tracksRegistrationStatus = job.kind === "ticket" && job.registration_id;
  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();
  if (result.ok) {
    await supabase
      .from("email_jobs")
      .update({ status: "sent", sent_at: now, provider_message_id: result.messageId ?? null, last_error: null, locked_until: null })
      .eq("id", job.id);
    if (tracksRegistrationStatus) {
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
  if (tracksRegistrationStatus && giveUp) {
    await supabase
      .from("registrations")
      .update({ email_status: "failed", email_error: result.error ?? "unknown error" })
      .eq("id", job.registration_id);
  }
}

// Data pendaftaran yang dibutuhkan untuk menyusun email tiket/pengingat.
interface TicketEmailData {
  email: string;
  checkedIn: boolean;
  status: string;
  input: TicketEmailInput;
}

/**
 * Ambil data pendaftar + acara lalu susun isi email tiket.
 * Hasilnya berupa SendResult (gagal) kalau pendaftaran tidak ada atau sudah dibatalkan.
 */
async function loadTicketEmailData(registrationId: string): Promise<TicketEmailData | SendResult> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: reg } = await supabase
    .from("registrations")
    .select(
      "id, full_name, email, language, ticket_code, status, checked_in_at, event:events(id, title_en, title_id, description_en, description_id, starts_at, ends_at, timezone, venue_name, venue_address, maps_url, online_url), org:organizations(name, logo_url)",
    )
    .eq("id", registrationId)
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
  const org = reg.org as unknown as { name: string; logo_url: string | null };
  const locale = reg.language as Locale;
  const site = publicEnv.siteUrl;

  return {
    email: reg.email,
    checkedIn: reg.checked_in_at !== null,
    status: reg.status,
    input: {
      locale,
      orgName: org.name,
      orgLogoUrl: org.logo_url,
      registrantName: reg.full_name,
      eventTitle: pickLocalized(locale, event.title_en, event.title_id),
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      timezone: event.timezone,
      venue: [event.venue_name, event.venue_address].filter(Boolean).join(", ") || null,
      mapsUrl: event.maps_url,
      onlineUrl: event.online_url,
      // The QR code appears in the email as an image loaded from the site,
      // and the "Open web ticket" button links to the full ticket.
      ticketUrl: `${site}/t/${reg.ticket_code}`,
      qrImageUrl: `${site}/api/tickets/${reg.ticket_code}/qr-code`,
      ticketCode: reg.ticket_code,
    },
  };
}

// Pembeda hasil: data email berhasil dimuat, atau sudah berupa alasan gagal.
function isLoadFailure(value: TicketEmailData | SendResult): value is SendResult {
  return "ok" in value;
}

async function sendTicketJob(job: EmailJob): Promise<SendResult> {
  const data = await loadTicketEmailData(job.registration_id!);
  if (isLoadFailure(data)) return data;
  // Tiket (QR + link online) hanya untuk yang sudah punya kursi.
  if (data.status === "waitlisted") return { ok: false, error: "still on the waitlist", retryable: false };
  return deliver(data.email, ticketEmail(data.input));
}

/**
 * Kirim email konfirmasi daftar tunggu. Dilewati kalau orangnya keburu dapat
 * kursi (tiketnya sudah dikirim terpisah) atau sudah dikeluarkan dari antrean.
 */
async function sendWaitlistJob(job: EmailJob): Promise<SendResult> {
  const data = await loadTicketEmailData(job.registration_id!);
  if (isLoadFailure(data)) return data;
  if (data.status !== "waitlisted") return { ok: false, error: "no longer on the waitlist", retryable: false };
  return deliver(data.email, waitlistEmail(data.input));
}

/**
 * Kirim email pengingat. Dilewati (tanpa dicoba ulang) kalau orangnya sudah
 * check-in atau acaranya sudah mulai — pengingat tidak ada gunanya lagi.
 */
async function sendReminderJob(job: EmailJob): Promise<SendResult> {
  const data = await loadTicketEmailData(job.registration_id!);
  if (isLoadFailure(data)) return data;
  if (data.checkedIn) return { ok: false, error: "already checked in", retryable: false };
  if (new Date(data.input.startsAt) <= new Date()) return { ok: false, error: "event already started", retryable: false };
  return deliver(data.email, reminderEmail(data.input));
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
  return deliver(inv.email, content);
}
