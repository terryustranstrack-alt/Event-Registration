import { randomUUID } from "node:crypto";
import { NextResponse, after, type NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { getEventForRegistration } from "@/lib/public-event-data";
import { getClosedReason } from "@/lib/event-availability";
import { generateTicketCode } from "@/lib/ticket-codes";
import { serverEnv } from "@/lib/env";
import { verifyTurnstileToken } from "@/lib/turnstile-verification";
import { getClientIp, hashForRateLimit } from "@/lib/request-client-info";
import { processEmailQueue } from "@/lib/messaging/email-queue-worker";
import { isLocale } from "@/lib/i18n/translate";
import {
  isFileLike,
  validateCustomFields,
  validateFixedFields,
  type FieldError,
  type RawValue,
} from "@/lib/registration-validation";
import type { FileAnswer } from "@/lib/domain-types";

/**
 * Public registration (FR-5.1): validate → captcha → reserve seat atomically
 * (register_for_event) → queue ticket email → respond with the ticket code.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/events/[eventId]/register">) {
  const { eventId } = await ctx.params;
  const supabase = createSupabaseServiceRoleClient();

  const ip = (await getClientIp()) ?? "unknown";
  const { data: allowed } = await supabase.rpc("hit_rate_limit", {
    p_key: `register:${eventId}:${hashForRateLimit(ip)}`,
    p_window_seconds: 60,
    p_max: 10,
  });
  if (allowed === false) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!(await verifyTurnstileToken(formData.get("cf-turnstile-response") as string | null, ip))) {
    return NextResponse.json({ error: "captcha" }, { status: 400 });
  }

  const loaded = await getEventForRegistration(eventId);
  if (!loaded || loaded.event.org.status !== "active" || loaded.event.status === "draft") {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }
  const { event, fields } = loaded;
  const closed = getClosedReason(event);
  if (closed) return NextResponse.json({ error: closed }, { status: 409 });

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const languageRaw = String(formData.get("language") ?? "id");
  const language = isLocale(languageRaw) ? languageRaw : "id";
  const consent = formData.get("consent") === "on";

  const values: Record<string, RawValue> = {};
  for (const field of fields) {
    const key = `field_${field.id}`;
    if (field.type === "checkbox") values[field.id] = formData.getAll(key).map(String);
    else if (field.type === "file") {
      const file = formData.get(key);
      values[field.id] = file instanceof File ? file : null;
    } else values[field.id] = (formData.get(key) as string | null) ?? null;
  }

  const fieldErrors: Record<string, FieldError> = {
    ...validateFixedFields({ fullName, email }),
    ...validateCustomFields(fields, values).errors,
  };
  if (event.consent_enabled && !consent) fieldErrors.consent = { key: "error.consent_required" };
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: "validation", fieldErrors }, { status: 422 });
  }
  const { cleaned } = validateCustomFields(fields, values);

  // Upload files to the private bucket; answers store only the storage path.
  const uploadedPaths: string[] = [];
  const answers: Record<string, unknown> = {};
  for (const [fieldId, value] of Object.entries(cleaned)) {
    if (isFileLike(value) && value instanceof File) {
      const safeName = value.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
      const path = `${event.org_id}/${event.id}/${randomUUID()}-${safeName}`;
      const { error } = await supabase.storage
        .from("registration-uploads")
        .upload(path, value, { contentType: value.type });
      if (error) {
        await removeUploads(uploadedPaths);
        return NextResponse.json({ error: "upload_failed" }, { status: 500 });
      }
      uploadedPaths.push(path);
      answers[fieldId] = { path, name: value.name, size: value.size, type: value.type } satisfies FileAnswer;
    } else {
      answers[fieldId] = value;
    }
  }

  const ticketCode = generateTicketCode(serverEnv().ticketSigningSecret);
  const { data, error } = await supabase
    .rpc("register_for_event", {
      p_event_id: event.id,
      p_full_name: fullName,
      p_email: email,
      p_language: language,
      p_answers: answers,
      p_ticket_code: ticketCode,
      p_consent: consent,
    })
    .single<{ registration_id: string | null; error_code: string | null }>();

  if (error || !data?.registration_id) {
    await removeUploads(uploadedPaths);
    const code = data?.error_code ?? "server_error";
    const status = code === "already_registered" || code === "consent_required" ? 422 : error ? 500 : 409;
    if (code === "already_registered") return NextResponse.json({ error: code, fieldErrors: { email: { key: "error.already_registered" } } }, { status });
    if (error) console.error("register_for_event failed", error);
    return NextResponse.json({ error: code }, { status });
  }

  // Send the ticket right after responding (target: within 1 minute, NFR).
  const registrationId = data.registration_id;
  after(async () => {
    const { data: job } = await supabase.from("email_jobs").select("id").eq("registration_id", registrationId).eq("kind", "ticket").maybeSingle();
    if (job) await processEmailQueue({ onlyJobId: job.id }).catch((e) => console.error("ticket email failed", e));
  });

  return NextResponse.json({ ticketCode }, { status: 201 });
}

async function removeUploads(paths: string[]) {
  if (paths.length === 0) return;
  await createSupabaseServiceRoleClient().storage.from("registration-uploads").remove(paths);
}
