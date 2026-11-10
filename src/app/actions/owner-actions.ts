"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformOwner } from "@/lib/auth-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

/** Suspend / unsuspend an organization (FR-1.5, US-18). */
export async function setOrganizationStatusAction(formData: FormData) {
  await requirePlatformOwner();
  const status = formData.get("status") === "suspended" ? "suspended" : "active";
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("organizations")
    .update({ status, suspended_reason: status === "suspended" ? String(formData.get("reason") ?? "") || null : null })
    .eq("id", String(formData.get("org_id")));
  revalidatePath("/admin");
}
