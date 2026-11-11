"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { requireOrgMembership } from "@/lib/auth-guards";
import { copySlugCandidate, EVENT_SLUG_RE, slugify } from "@/lib/slug-utils";
import { getOrgEvent } from "@/lib/event-data";
import { EVENT_DELETE_CONFIRM_WORD } from "@/lib/event-delete";
import { isValidTimeZone, zonedLocalToUtcIso } from "@/lib/timezone-utils";
import { FORM_FIELD_TYPES, type EventRow, type EventStatus } from "@/lib/domain-types";
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

/**
 * Hapus file yang diunggah pendaftar untuk acara ini (folder {org}/{acara}/).
 * Datanya pribadi, jadi jangan ditinggal setelah acaranya dihapus.
 */
async function removeRegistrationUploads(orgId: string, eventId: string) {
  const storage = createSupabaseServiceRoleClient().storage.from("registration-uploads");
  const folder = `${orgId}/${eventId}`;
  // Dihapus per 1.000 file; dibatasi 50 putaran supaya tidak pernah macet berulang tanpa akhir.
  for (let round = 0; round < 50; round++) {
    const { data: files } = await storage.list(folder, { limit: 1000 });
    if (!files || files.length === 0) return;
    const { error } = await storage.remove(files.map((f) => `${folder}/${f.name}`));
    if (error) return;
  }
}

/**
 * Hapus acara beserta semua pendaftar, check-in, dan file unggahannya.
 * Hanya jalan kalau admin sudah mengetik kata konfirmasi (langkah kedua).
 */
export async function deleteEventAction(formData: FormData) {
  const orgSlug = String(formData.get("org_slug"));
  const eventId = String(formData.get("event_id"));
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  if (String(formData.get("confirm") ?? "").trim() !== EVENT_DELETE_CONFIRM_WORD) {
    redirect(`/dashboard/${org.slug}/events/${eventId}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: deleted } = await supabase.from("events").delete().eq("id", eventId).eq("org_id", org.id).select("id");
  if (deleted && deleted.length > 0) await removeRegistrationUploads(org.id, eventId);
  revalidatePath(`/dashboard/${org.slug}`);
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

// ---------------------------------------------------------------------------
// Duplikat acara
// ---------------------------------------------------------------------------
type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Isi acara baru dari acara lama: semua detail & gambar ikut, tapi statusnya
 * draf, kursi terisi 0, dan judulnya diberi tanda "(copy)" supaya tidak tertukar.
 */
function buildEventCopy(event: EventRow, userId: string) {
  return {
    org_id: event.org_id,
    title_en: event.title_en ? `${event.title_en} (copy)` : null,
    title_id: event.title_id ? `${event.title_id} (salinan)` : null,
    description_en: event.description_en,
    description_id: event.description_id,
    banner_url: event.banner_url,
    about_image_url: event.about_image_url,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    timezone: event.timezone,
    venue_name: event.venue_name,
    venue_address: event.venue_address,
    maps_url: event.maps_url,
    online_url: event.online_url,
    extra_links: event.extra_links,
    capacity: event.capacity,
    hide_capacity_total: event.hide_capacity_total,
    registration_opens_at: event.registration_opens_at,
    registration_closes_at: event.registration_closes_at,
    allow_multiple_per_email: event.allow_multiple_per_email,
    consent_enabled: event.consent_enabled,
    retention_months: event.retention_months,
    status: "draft" as const,
    created_by: userId,
  };
}

/** Simpan salinan acara. Kalau alamatnya sudah dipakai, coba "-copy-2", "-copy-3", dst. */
async function insertEventCopy(supabase: ServerSupabase, copy: ReturnType<typeof buildEventCopy>, slug: string) {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...copy, slug: copySlugCandidate(slug, attempt) })
      .select("id")
      .single();
    if (data) return data.id as string;
    if (error?.code !== "23505") return null;
  }
  return null;
}

/** Salin pertanyaan formulir yang masih aktif ke acara baru (dengan ID baru). */
async function copyFormFields(supabase: ServerSupabase, fromEventId: string, toEventId: string) {
  const { data: fields } = await supabase
    .from("form_fields")
    .select("org_id, position, type, label_en, label_id, help_en, help_id, placeholder_en, placeholder_id, required, min_value, max_value, options")
    .eq("event_id", fromEventId)
    .is("archived_at", null)
    .order("position");
  if (!fields || fields.length === 0) return;
  await supabase.from("form_fields").insert(fields.map((f) => ({ ...f, event_id: toEventId })));
}

/** Tombol "Duplikat": buat salinan acara sebagai draf, lalu buka halaman editnya. */
export async function duplicateEventAction(formData: FormData) {
  const orgSlug = String(formData.get("org_slug"));
  const eventId = String(formData.get("event_id"));
  const { org, user } = await requireOrgMembership(orgSlug, ["admin"]);
  const event = await getOrgEvent(org.id, eventId);

  const supabase = await createSupabaseServerClient();
  const newId = await insertEventCopy(supabase, buildEventCopy(event, user.id), event.slug);
  if (!newId) redirect(`/dashboard/${org.slug}/events/${eventId}`); // jarang terjadi; kembali ke acara asal

  await copyFormFields(supabase, event.id, newId);
  revalidatePath(`/dashboard/${org.slug}`);
  redirect(`/dashboard/${org.slug}/events/${newId}`);
}
