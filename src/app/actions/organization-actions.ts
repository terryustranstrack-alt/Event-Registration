"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { requireOrgMembership, requireUser } from "@/lib/auth-guards";
import { isValidOrgSlug, slugify } from "@/lib/slug-utils";
import { processEmailQueue } from "@/lib/messaging/email-queue-worker";
import { isLocale } from "@/lib/i18n/translate";

export interface FormState {
  error?: string;
  ok?: boolean;
  message?: string;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Upload an image to the public org-assets bucket under {orgId}/… */
export async function uploadOrgImage(orgId: string, prefix: string, file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be JPG, PNG or WebP and at most 5 MB.");
  }
  const supabase = await createSupabaseServerClient();
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${orgId}/${prefix}-${randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("org-assets").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("org-assets").getPublicUrl(path).data.publicUrl;
}

export async function createOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") || name));
  const language = String(formData.get("default_language") ?? "id");
  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;

  if (name.length < 2) return { error: "Name is too short." };
  if (!isValidOrgSlug(slug)) return { error: "This URL name is not allowed. Use 3–50 lowercase letters, numbers or dashes." };

  const supabase = await createSupabaseServerClient();
  const { data: org, error } = await supabase
    .rpc("create_organization", {
      p_name: name,
      p_slug: slug,
      p_default_language: isLocale(language) ? language : "id",
      p_contact_email: contactEmail,
    })
    .single<{ id: string; slug: string }>();
  if (error || !org) {
    return { error: error?.code === "23505" ? "This URL name is already taken." : (error?.message ?? "Could not create organization.") };
  }

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    try {
      const url = await uploadOrgImage(org.id, "logo", logo);
      await supabase.from("organizations").update({ logo_url: url }).eq("id", org.id);
    } catch {
      // Logo is optional; the org can add it later in settings.
    }
  }
  redirect(`/dashboard/${org.slug}`);
}

export async function updateOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orgSlug = String(formData.get("org_slug"));
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  const supabase = await createSupabaseServerClient();
  const language = String(formData.get("default_language") ?? "id");
  const update: Record<string, unknown> = {
    name: String(formData.get("name") ?? "").trim(),
    default_language: isLocale(language) ? language : "id",
    contact_email: String(formData.get("contact_email") ?? "").trim() || null,
    privacy_policy_url: String(formData.get("privacy_policy_url") ?? "").trim() || null,
  };
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    try {
      update.logo_url = await uploadOrgImage(org.id, "logo", logo);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Upload failed." };
    }
  }
  const { error } = await supabase.from("organizations").update(update).eq("id", org.id);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/${orgSlug}`, "layout");
  return { ok: true };
}

export async function inviteMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orgSlug = String(formData.get("org_slug"));
  const { org, user } = await requireOrgMembership(orgSlug, ["admin"]);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "admin" ? "admin" : "staff";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };

  const supabase = await createSupabaseServerClient();
  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({ org_id: org.id, email, role, invited_by: user.id })
    .select("id, token")
    .single();
  if (error || !invitation) return { error: error?.message ?? "Could not create invitation." };

  // Queue the invitation email (service role: email_jobs is not client-writable).
  const admin = createSupabaseServiceRoleClient();
  const { data: job } = await admin
    .from("email_jobs")
    .insert({ org_id: org.id, invitation_id: invitation.id, kind: "invitation" })
    .select("id")
    .single();
  if (job) after(() => processEmailQueue({ onlyJobId: job.id }).catch(console.error));

  revalidatePath(`/dashboard/${orgSlug}/team`);
  return { ok: true, message: `/invite/${invitation.token}` };
}

export async function revokeInvitationAction(formData: FormData) {
  const orgSlug = String(formData.get("org_slug"));
  await requireOrgMembership(orgSlug, ["admin"]);
  const supabase = await createSupabaseServerClient();
  await supabase.from("invitations").delete().eq("id", String(formData.get("invitation_id")));
  revalidatePath(`/dashboard/${orgSlug}/team`);
}

export async function removeMemberAction(formData: FormData) {
  const orgSlug = String(formData.get("org_slug"));
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  const supabase = await createSupabaseServerClient();
  await supabase.from("memberships").delete().eq("org_id", org.id).eq("user_id", String(formData.get("user_id")));
  revalidatePath(`/dashboard/${orgSlug}/team`);
}

export async function acceptInvitationAction(formData: FormData) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const token = String(formData.get("token"));
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) redirect(`/invite/${token}?error=${encodeURIComponent(error.message)}`);
  const { data: org } = await supabase.from("organizations").select("slug").eq("id", orgId as string).single();
  redirect(org ? `/dashboard/${org.slug}` : "/dashboard");
}
