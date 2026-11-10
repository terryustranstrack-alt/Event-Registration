import "server-only";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import type { EventRow, FormField } from "@/lib/domain-types";

/** Load an event the signed-in user can see (RLS) within the given org. */
export async function getOrgEvent(orgId: string, eventId: string): Promise<EventRow> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("events").select("*").eq("id", eventId).eq("org_id", orgId).maybeSingle();
  if (!data) notFound();
  return data as EventRow;
}

export async function getEventFormFields(eventId: string, includeArchived = false): Promise<FormField[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("form_fields").select("*").eq("event_id", eventId).order("position");
  if (!includeArchived) query = query.is("archived_at", null);
  const { data } = await query;
  return (data ?? []) as FormField[];
}

export interface EventStats {
  registered: number;
  cancelled: number;
  checked_in: number;
  no_show: number;
  capacity: number;
  seats_left: number;
  event_ended: boolean;
}

export async function getEventStats(eventId: string): Promise<EventStats> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("event_stats", { p_event_id: eventId }).single<EventStats>();
  return (
    data ?? { registered: 0, cancelled: 0, checked_in: 0, no_show: 0, capacity: 0, seats_left: 0, event_ended: false }
  );
}
