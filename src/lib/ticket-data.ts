import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { isValidTicketCode } from "@/lib/ticket-codes";
import { serverEnv } from "@/lib/env";
import type { Locale } from "@/lib/i18n/translate";

export interface TicketView {
  registration: {
    id: string;
    full_name: string;
    email: string;
    language: Locale;
    status: "registered" | "cancelled" | "waitlisted";
    group_id: string | null;
    ticket_code: string;
    checked_in_at: string | null;
    email_status: string;
  };
  event: {
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
    banner_url: string | null;
    slug: string;
  };
  org: { name: string; slug: string; logo_url: string | null; status: string };
}

/** Look up a ticket by its signed code. The code is the bearer secret. */
export async function getTicketByCode(code: string): Promise<TicketView | null> {
  if (!isValidTicketCode(code, serverEnv().ticketSigningSecret)) return null;
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("registrations")
    .select(
      "id, full_name, email, language, status, group_id, ticket_code, checked_in_at, email_status, event:events(id, title_en, title_id, starts_at, ends_at, timezone, venue_name, venue_address, maps_url, online_url, banner_url, slug), org:organizations(name, slug, logo_url, status)",
    )
    .eq("ticket_code", code)
    .maybeSingle();
  if (!data) return null;
  const { event, org, ...registration } = data as unknown as TicketView["registration"] & {
    event: TicketView["event"];
    org: TicketView["org"];
  };
  return { registration, event, org };
}

/** Satu tiket lain dalam rombongan yang sama (untuk ditampilkan sebagai link). */
export interface GroupTicket {
  full_name: string;
  ticket_code: string;
  status: string;
}

/**
 * Tiket-tiket lain dalam satu pendaftaran rombongan (pendaftar utama + orang
 * tambahannya), selain tiket yang sedang dibuka. Kosong kalau daftar sendiri.
 */
export async function getGroupTickets(registration: { id: string; group_id: string | null }): Promise<GroupTicket[]> {
  const leaderId = registration.group_id ?? registration.id;
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("registrations")
    .select("id, full_name, ticket_code, status")
    .or(`id.eq.${leaderId},group_id.eq.${leaderId}`)
    .order("created_at")
    .order("id");
  return (data ?? []).filter((r) => r.id !== registration.id).map(({ full_name, ticket_code, status }) => ({ full_name, ticket_code, status }));
}
