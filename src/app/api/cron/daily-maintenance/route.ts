import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { processEmailQueue } from "@/lib/messaging/email-queue-worker";

export const maxDuration = 60;

/**
 * Tugas harian:
 * 1. Anonimkan data pendaftar yang sudah lewat masa simpan (NFR Privacy).
 * 2. Antrekan email pengingat untuk acara yang mulai kira-kira besok, lalu langsung kirim.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const anonymized = await anonymizeExpiredRegistrations();
    const remindersQueued = await queueEventReminders();
    const remindersSent = await sendQueuedEmails();
    return NextResponse.json({ anonymized, remindersQueued, remindersSent });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

async function anonymizeExpiredRegistrations(): Promise<number> {
  const { data, error } = await createSupabaseServiceRoleClient().rpc("anonymize_expired_registrations");
  if (error) throw new Error(`anonymize failed: ${error.message}`);
  return data as number;
}

async function queueEventReminders(): Promise<number> {
  const { data, error } = await createSupabaseServiceRoleClient().rpc("queue_event_reminders");
  if (error) throw new Error(`queue reminders failed: ${error.message}`);
  return data as number;
}

// Kirim sebagian antrean sekarang juga; sisanya (kalau banyak) dikirim oleh
// tugas antrean email berikutnya.
async function sendQueuedEmails(): Promise<number> {
  const results = await processEmailQueue({ limit: 50 });
  return results.filter((r) => r.ok).length;
}
