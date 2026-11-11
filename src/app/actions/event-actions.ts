"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { requireOrgMembership } from "@/lib/auth-guards";
import { EVENT_SLUG_RE, slugify } from "@/lib/slug-utils";
import { isValidTimeZone, zonedLocalToUtcIso } from "@/lib/timezone-utils";
import { FORM_FIELD_TYPES, type EventStatus } from "@/lib/domain-types";
import { uploadOrgImage, type FormState } from "./organization-actions";

// Gambar acara yang bisa diunggah dari editor: kolom di database, nama input
// file, nama kotak centang "hapus", dan awalan nama file di penyimpanan.
const EVENT_IMAGES = [
  { column: "banner_url", input: "banner", remove: "remove_banner", prefix: "banner" },
  { column: "about_image_url", input: "about_image", remove: "remove_about_image", prefix: "about" },
] as const;
type EventImage = (typeof EVENT_IMAGES)[number];

/**
 * Cek apa yang diminta untuk satu gambar acara: hapus (null), ganti dengan
 * unggahan baru (alamat gambar), atau biarkan (undefined).
 */
async function readEventImageChange(formData: FormData, orgId: string, eventId: string, image: EventImage) {
  if (formData.get(image.remove) === "on") return null;
  const file = formData.get(image.input);
  if (file instanceof File && file.size > 0) return uploadOrgImage(orgId, `events/${eventId}/${image.prefix}`, file);
  return undefined;
}

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\/\S+$/.test(v), "Links must start with http:// or https://");

function readEventForm(formData: FormData) {
  const timezone = String(formData.get("timezone") || "Asia/Jakarta");
  const tz = isValidTimeZone(timezone) ? timezone : "Asia/Jakarta";
  const toUtc = (name: string) => {
    const v = String(formData.get(name) ?? "");
    return v ? zonedLocalToUtcIso(v, tz) : null;
  };
  const links: { label_en: string | null; label_id: string | null; url: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const url = String(formData.get(`link_url_${i}`) ?? "").trim();
    if (!url) continue;
    links.push({
      url,
      label_en: String(formData.get(`link_label_en_${i}`) ?? "").trim() || null,
      label_id: String(formData.get(`link_label_id_${i}`) ?? "").trim() || null,
    });
  }
  const text = (name: string) => String(formData.get(name) ?? "").trim() || null;
  return {
    title_en: text("title_en"),
    title_id: text("title_id"),
    description_en: text("description_en"),
    description_id: text("description_id"),
    slug: slugify(String(formData.get("slug") || formData.get("title_en") || formData.get("title_id") || ""), 80),
    timezone: tz,
    starts_at: toUtc("starts_at"),
    ends_at: toUtc("ends_at"),
    registration_opens_at: toUtc("registration_opens_at"),
    registration_closes_at: toUtc("registration_closes_at"),
    venue_name: text("venue_name"),
    venue_address: text("venue_address"),
    maps_url: String(formData.get("maps_url") ?? ""),
    online_url: String(formData.get("online_url") ?? ""),
    extra_links: links,
    capacity: Number(formData.get("capacity")),
    hide_capacity_total: formData.get("hide_capacity_total") === "on",
    allow_multiple_per_email: formData.get("allow_multiple_per_email") === "on",
    consent_enabled: formData.get("consent_enabled") === "on",
    retention_months: Number(formData.get("retention_months") || 12),
  };
}

const eventSchema = z
  .object({
    title_en: z.string().max(200).nullable(),
    title_id: z.string().max(200).nullable(),
    description_en: z.string().max(20000).nullable(),
    description_id: z.string().max(20000).nullable(),
    slug: z.string().regex(EVENT_SLUG_RE, "Event URL name is invalid."),
    timezone: z.string(),
    starts_at: z.string({ message: "Start date is required." }),
    ends_at: z.string({ message: "End date is required." }),
    registration_opens_at: z.string().nullable(),
    registration_closes_at: z.string().nullable(),
    venue_name: z.string().max(200).nullable(),
    venue_address: z.string().max(500).nullable(),
    maps_url: optionalUrl,
    online_url: optionalUrl,
    extra_links: z
      .array(z.object({ url: z.string().regex(/^https?:\/\/\S+$/, "Links must start with https://"), label_en: z.string().nullable(), label_id: z.string().nullable() }))
      .max(5),
    capacity: z.number().int("Capacity must be a whole number.").min(1, "Capacity must be at least 1.").max(100000),
    hide_capacity_total: z.boolean(),
    allow_multiple_per_email: z.boolean(),
    consent_enabled: z.boolean(),
    retention_months: z.number().int().min(1).max(120),
  })
  .refine((v) => v.title_en || v.title_id, { message: "Add a title in English or Indonesian." })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), { message: "The end must be after the start." })
  .refine(
    (v) => !v.registration_opens_at || !v.registration_closes_at || new Date(v.registration_closes_at) > new Date(v.registration_opens_at),
    { message: "Registration must close after it opens." },
  );

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orgSlug = String(formData.get("org_slug"));
  const { org, user } = await requireOrgMembership(orgSlug, ["admin"]);
  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data: event, error } = await supabase
    .from("events")
    .insert({ ...parsed.data, org_id: org.id, created_by: user.id, status: "draft" })
    .select("id")
    .single();
  if (error || !event) {
    return { error: error?.code === "23505" ? "An event with this URL name already exists." : (error?.message ?? "Could not create event.") };
  }

  for (const image of EVENT_IMAGES) {
    try {
      const url = await readEventImageChange(formData, org.id, event.id, image);
      if (url) await supabase.from("events").update({ [image.column]: url }).eq("id", event.id);
    } catch {
      // Optional; can be re-uploaded from the editor.
    }
  }
  redirect(`/dashboard/${org.slug}/events/${event.id}/form`);
}

export async function updateEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orgSlug = String(formData.get("org_slug"));
  const eventId = String(formData.get("event_id"));
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase.from("events").select("status, slug").eq("id", eventId).eq("org_id", org.id).single();
  if (!current) return { error: "Event not found." };
  const update: Record<string, unknown> = { ...parsed.data };
  if (current.status !== "draft") update.slug = current.slug; // FR-2.5

  for (const image of EVENT_IMAGES) {
    try {
      const value = await readEventImageChange(formData, org.id, eventId, image);
      if (value !== undefined) update[image.column] = value;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Upload failed." };
    }
  }

  const { error } = await supabase.from("events").update(update).eq("id", eventId).eq("org_id", org.id);
  if (error) {
    if (error.message.includes("capacity_below_registrations")) return { error: "Capacity cannot be lower than the number of registrations." };
    return { error: error.code === "23505" ? "An event with this URL name already exists." : error.message };
  }
  revalidatePath(`/dashboard/${org.slug}/events/${eventId}`, "layout");
  return { ok: true };
}

export async function setEventStatusAction(formData: FormData) {
  const orgSlug = String(formData.get("org_slug"));
  const eventId = String(formData.get("event_id"));
  const status = String(formData.get("status")) as EventStatus;
  if (!["draft", "published", "closed"].includes(status)) return;
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  const supabase = await createSupabaseServerClient();
  await supabase.from("events").update({ status }).eq("id", eventId).eq("org_id", org.id);
  revalidatePath(`/dashboard/${org.slug}`, "layout");
}

export async function deleteDraftEventAction(formData: FormData) {
  const orgSlug = String(formData.get("org_slug"));
  const eventId = String(formData.get("event_id"));
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  const supabase = await createSupabaseServerClient();
  await supabase.from("events").delete().eq("id", eventId).eq("org_id", org.id).eq("status", "draft");
  redirect(`/dashboard/${org.slug}`);
}

// ---------------------------------------------------------------------------
// Form builder (FR-3)
// ---------------------------------------------------------------------------
const optionSchema = z.object({
  value: z.string().min(1).max(100),
  label_en: z.string().max(200).nullable().optional(),
  label_id: z.string().max(200).nullable().optional(),
});

const fieldSchema = z
  .object({
    id: z.string().uuid().optional(),
    type: z.enum(FORM_FIELD_TYPES as [string, ...string[]]),
    label_en: z.string().max(300).nullable(),
    label_id: z.string().max(300).nullable(),
    help_en: z.string().max(500).nullable(),
    help_id: z.string().max(500).nullable(),
    placeholder_en: z.string().max(200).nullable(),
    placeholder_id: z.string().max(200).nullable(),
    required: z.boolean(),
    min_value: z.number().nullable(),
    max_value: z.number().nullable(),
    options: z.array(optionSchema).max(100),
  })
  .refine((f) => f.label_en || f.label_id, { message: "Every question needs a label." })
  .refine((f) => !["dropdown", "radio", "checkbox"].includes(f.type) || f.options.length > 0, {
    message: "Choice questions need at least one option.",
  });

export async function saveFormFieldsAction(input: {
  orgSlug: string;
  eventId: string;
  fields: unknown[];
}): Promise<FormState> {
  const { org } = await requireOrgMembership(input.orgSlug, ["admin"]);
  const parsed = z.array(fieldSchema).max(60).safeParse(input.fields);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase.from("events").select("id").eq("id", input.eventId).eq("org_id", org.id).single();
  if (!event) return { error: "Event not found." };

  const { data: existing } = await supabase
    .from("form_fields")
    .select("id")
    .eq("event_id", event.id)
    .is("archived_at", null);
  const keepIds = new Set(parsed.data.map((f) => f.id).filter(Boolean));
  const toArchive = (existing ?? []).map((f) => f.id).filter((id) => !keepIds.has(id));

  // Removed questions are archived, not deleted, so old answers stay exportable (FR-3.5).
  if (toArchive.length > 0) {
    const { error } = await supabase.from("form_fields").update({ archived_at: new Date().toISOString() }).in("id", toArchive);
    if (error) return { error: error.message };
  }

  const rows = parsed.data.map((f, index) => ({
    ...f,
    id: f.id ?? crypto.randomUUID(),
    event_id: event.id,
    org_id: org.id,
    position: index,
    archived_at: null,
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from("form_fields").upsert(rows, { onConflict: "id" });
    if (error) return { error: error.message };
  }
  revalidatePath(`/dashboard/${org.slug}/events/${event.id}`, "layout");
  return { ok: true };
}
