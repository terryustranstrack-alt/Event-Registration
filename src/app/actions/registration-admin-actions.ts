"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { requireOrgMembership } from "@/lib/auth-guards";
import { processEmailQueue } from "@/lib/messaging/email-queue-worker";

async function context(formData: FormData) {
  const orgSlug = String(formData.get("org_slug"));
  const eventId = String(formData.get("event_id"));
  const registrationId = String(formData.get("registration_id"));
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  return { org, eventId, registrationId, path: `/dashboard/${org.slug}/events/${eventId}/registrants` };
}

/** FR-5.5 */
export async function cancelRegistrationAction(formData: FormData) {
  const { registrationId, path } = await context(formData);
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("cancel_registration", { p_registration_id: registrationId });
  revalidatePath(path);
}

/** FR-8.5 */
export async function undoCheckInAction(formData: FormData) {
  const { registrationId, path } = await context(formData);
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("undo_check_in", { p_registration_id: registrationId });
  revalidatePath(path);
}

/** FR-5.5 / US-13: edit name + email (RLS: admins only). */
export async function editRegistrantAction(formData: FormData) {
  const { org, registrationId, path } = await context(formData);
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("registrations").update({ full_name: fullName, email }).eq("id", registrationId).eq("org_id", org.id);
  if (formData.get("resend") === "on") await queueTicketEmail(org.id, registrationId);
  revalidatePath(path);
}

/** FR-7.2 / US-13: resend the ticket email. */
export async function resendTicketAction(formData: FormData) {
  const { org, registrationId, path } = await context(formData);
  await queueTicketEmail(org.id, registrationId);
  revalidatePath(path);
}

async function queueTicketEmail(orgId: string, registrationId: string) {
  // Confirm visibility under the admin's own RLS before using the service role.
  const supabase = await createSupabaseServerClient();
  const { data: reg } = await supabase.from("registrations").select("id, status").eq("id", registrationId).eq("org_id", orgId).maybeSingle();
  if (!reg || reg.status !== "registered") return;
  const admin = createSupabaseServiceRoleClient();
  await admin.from("registrations").update({ email_status: "pending", email_error: null }).eq("id", reg.id);
  const { data: job } = await admin
    .from("email_jobs")
    .insert({ org_id: orgId, registration_id: reg.id, kind: "ticket" })
    .select("id")
    .single();
  if (job) after(() => processEmailQueue({ onlyJobId: job.id }).catch(console.error));
}
