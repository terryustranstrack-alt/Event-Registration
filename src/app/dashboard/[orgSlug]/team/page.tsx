import { InviteMemberForm } from "@/components/invite-member-form";
import { removeMemberAction, revokeInvitationAction } from "@/app/actions/organization-actions";
import { requireOrgMembership } from "@/lib/auth-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatDate } from "@/lib/i18n/format";

export default async function TeamPage({ params }: PageProps<"/dashboard/[orgSlug]/team">) {
  const { orgSlug } = await params;
  const { org, user } = await requireOrgMembership(orgSlug, ["admin"]);
  const { locale, t } = await getServerTranslator(org.default_language);
  const supabase = await createSupabaseServerClient();
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.from("memberships").select("user_id, role, created_at, profile:profiles(email, full_name)").eq("org_id", org.id).order("created_at"),
    supabase.from("invitations").select("id, email, role, expires_at, token").eq("org_id", org.id).is("accepted_at", null).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t("team.title")}</h1>
      <section className="card">
        <h2 className="mb-4 font-semibold">{t("team.invite")}</h2>
        <InviteMemberForm locale={locale} orgSlug={org.slug} />
      </section>
      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-600">
            <tr><th className="py-2">{t("auth.email")}</th><th>{t("team.role")}</th><th className="text-right">{t("common.actions")}</th></tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => {
              const profile = m.profile as unknown as { email: string; full_name: string | null } | null;
              return (
                <tr key={m.user_id} className="border-t border-zinc-100">
                  <td className="py-2">{profile?.full_name ? `${profile.full_name} · ` : ""}{profile?.email}</td>
                  <td>{t(m.role === "admin" ? "team.role.admin" : "team.role.staff")}</td>
                  <td className="text-right">
                    {m.user_id !== user.id && (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="org_slug" value={org.slug} />
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <button className="btn-danger btn-sm">{t("team.remove")}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {invitations && invitations.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold">{t("team.pending")}</h2>
          <ul className="divide-y divide-zinc-100 text-sm">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{inv.email} · {t(inv.role === "admin" ? "team.role.admin" : "team.role.staff")} · {formatDate(inv.expires_at, locale)}</span>
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
