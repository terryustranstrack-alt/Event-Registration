"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { isConfirmOtpType, safeNextPath } from "@/lib/auth-redirect";

/**
 * Verifies an email link's token hash (sign-up confirmation, invite, magic
 * link, recovery). Runs on a button press, not on page load, so email
 * security scanners that pre-open links cannot use up the one-time token.
 * Works on any device because it does not rely on a PKCE cookie.
 */
export async function confirmEmailAction(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = formData.get("type");
  const next = safeNextPath(String(formData.get("next") ?? ""));
  if (!tokenHash || !isConfirmOtpType(type)) redirect("/login?error=confirm_invalid");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) redirect(`/login?error=confirm_expired`);

  // Brand-new organizers go straight to creating their organization.
  redirect(type === "signup" && next === "/dashboard" ? "/dashboard/new-organization" : next);
}
