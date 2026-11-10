import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import type { Organization, OrgRole } from "@/lib/domain-types";

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_platform_owner")
    .eq("id", user.id)
    .single();
  return {
    id: user.id,
    email: user.email ?? profile?.email ?? "",
    fullName: (profile?.full_name as string | null) ?? null,
    isPlatformOwner: Boolean(profile?.is_platform_owner),
  };
});

export async function requireUser(nextPath?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  return user;
}

export interface MembershipWithOrg {
  role: OrgRole;
  organization: Organization;
}

export const getMyMemberships = cache(async (): Promise<MembershipWithOrg[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("memberships")
    .select("role, organization:organizations(*)")
    .eq("user_id", user.id)
    .order("created_at");
  return ((data ?? []) as unknown as MembershipWithOrg[]).filter((m) => m.organization);
});

/** Resolve the active org from its slug and check the caller's role. */
export async function requireOrgMembership(orgSlug: string, roles: OrgRole[] = ["admin", "staff"]) {
  const user = await requireUser(`/dashboard/${orgSlug}`);
  const memberships = await getMyMemberships();
  const membership = memberships.find((m) => m.organization.slug === orgSlug);
  if (!membership) notFound();
  if (!roles.includes(membership.role)) redirect(`/dashboard/${orgSlug}`);
  return { user, role: membership.role, org: membership.organization };
}

export async function requirePlatformOwner() {
  const user = await requireUser("/admin");
  if (!user.isPlatformOwner) notFound();
  return user;
}
