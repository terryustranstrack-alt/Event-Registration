import "server-only";
import { cache } from "react";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { EventRow, FormField, Organization } from "@/lib/domain-types";

// Columns safe for the public page. online_url is deliberately excluded (FR-2.2).
const PUBLIC_EVENT_COLUMNS =
  "id, org_id, slug, title_en, title_id, description_en, description_id, banner_url, about_image_url, starts_at, ends_at, timezone, venue_name, venue_address, maps_url, extra_links, capacity, seats_taken, hide_capacity_total, registration_opens_at, registration_closes_at, status, consent_enabled, allow_multiple_per_email";

export type PublicEvent = Omit<EventRow, "online_url" | "retention_months" | "created_at"> & { has_online_link: boolean };
export type PublicOrg = Pick<Organization, "id" | "name" | "slug" | "logo_url" | "default_language" | "privacy_policy_url" | "status">;

export type PublicEventResult =
  | { kind: "ok"; org: PublicOrg; event: PublicEvent; fields: FormField[] }
  | { kind: "unavailable"; org: PublicOrg }
  | { kind: "not_found" };

export const getPublicEvent = cache(async (orgSlug: string, eventSlug: string): Promise<PublicEventResult> => {
  const supabase = createSupabaseServiceRoleClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, default_language, privacy_policy_url, status")
    .eq("slug", orgSlug.toLowerCase())
    .maybeSingle<PublicOrg>();
  if (!org) return { kind: "not_found" };
  if (org.status !== "active") return { kind: "unavailable", org };

  const { data: event } = await supabase
    .from("events")
    .select(`${PUBLIC_EVENT_COLUMNS}, online_url`)
    .eq("org_id", org.id)
    .eq("slug", eventSlug.toLowerCase())
    .in("status", ["published", "closed"])
    .maybeSingle();
  if (!event) return { kind: "not_found" };

  const { data: fields } = await supabase
    .from("form_fields")
    .select("*")
    .eq("event_id", event.id)
    .is("archived_at", null)
    .order("position");

  const { online_url, ...safe } = event as EventRow;
  return {
    kind: "ok",
    org,
    event: { ...safe, has_online_link: Boolean(online_url) } as PublicEvent,
    fields: (fields ?? []) as FormField[],
  };
});

/** Event + org + fields for the registration endpoint, by event id. */
export async function getEventForRegistration(eventId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: event } = await supabase
    .from("events")
    .select(`${PUBLIC_EVENT_COLUMNS}, org:organizations(id, name, status)`)
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;
  const { data: fields } = await supabase
    .from("form_fields")
    .select("*")
    .eq("event_id", eventId)
    .is("archived_at", null)
    .order("position");
  return {
    event: event as unknown as PublicEvent & { org: { id: string; name: string; status: string } },
    fields: (fields ?? []) as FormField[],
  };
}
