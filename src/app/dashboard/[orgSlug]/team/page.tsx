import { InviteMemberForm } from "@/components/invite-member-form";
import { PageHeader } from "@/components/page-header";
import { removeMemberAction, revokeInvitationAction } from "@/app/actions/organization-actions";
import { requireOrgMembership } from "@/lib/auth-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatDate } from "@/lib/i18n/format";

interface TeamMember {
  user_id: string;
  role: "admin" | "staff";
  email: string;
  full_name: string | null;
}

/**
 * Members of the organization with their names. Memberships and profiles
 * are read separately because the database has no direct link between them
 * to join on (both point at the login account).
 */
async function loadTeamMembers(orgId: string): Promise<TeamMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data: memberships } = await supabase.from("memberships").select("user_id, role").eq("org_id", orgId).order("created_at");
  const userIds = (memberships ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("id, email, full_name").in("id", userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (memberships ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    email: byId.get(m.user_id)?.email ?? "—",
    full_name: byId.get(m.user_id)?.full_name ?? null,
  }));
}

async function loadPendingInvitations(orgId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export default async function TeamPage({ params }: PageProps<"/dashboard/[orgSlug]/team">) {
  const { orgSlug } = await params;
  const { org, user } = await requireOrgMembership(orgSlug, ["admin"]);
  const { locale, t } = await getServerTranslator();
  const [members, invitations] = await Promise.all([loadTeamMembers(org.id), loadPendingInvitations(org.id)]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={org.name} title={t("team.title")} />
      <section className="card">
        <h2 className="mb-4 text-lg font-extrabold">{t("team.invite")}</h2>
        <InviteMemberForm locale={locale} orgSlug={org.slug} />
      </section>
      <section className="card p-0">
        <ul className="divide-y divide-brand-50">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span aria-hidden="true" className="bg-festival grid h-10 w-10 shrink-0 place-items-center rounded-full font-extrabold text-white">
                {(m.full_name || m.email).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{m.full_name || m.email}</p>
                {m.full_name && <p className="truncate text-sm text-ink-700/75">{m.email}</p>}
              </div>
              <span className={`badge ${m.role === "admin" ? "bg-brand-100 text-brand-700" : "bg-orange-100 text-orange-800"}`}>
                {t(m.role === "admin" ? "team.role.admin" : "team.role.staff")}
              </span>
              {m.user_id !== user.id && (
                <form action={removeMemberAction}>
                  <input type="hidden" name="org_slug" value={org.slug} />
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button className="btn-danger btn-sm">{t("team.remove")}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
      {invitations.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-lg font-extrabold">{t("team.pending")}</h2>
          <ul className="divide-y divide-brand-50 text-sm">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  <span className="font-semibold">{inv.email}</span> · {t(inv.role === "admin" ? "team.role.admin" : "team.role.staff")} ·{" "}
                  {formatDate(inv.expires_at, locale)}
                </span>
                <form action={revokeInvitationAction}>
                  <input type="hidden" name="org_slug" value={org.slug} />
                  <input type="hidden" name="invitation_id" value={inv.id} />
                  <button className="btn-danger btn-sm">{t("team.remove")}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
