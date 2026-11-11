import { BrandLogo } from "@/components/brand-logo";
import { DashboardNav, type NavIcon } from "@/components/dashboard-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogOutIcon } from "@/components/icons";
import { OrgSwitcher } from "@/components/org-switcher";
import { getMyMemberships, requireOrgMembership } from "@/lib/auth-guards";
import { getServerTranslator } from "@/lib/i18n/server-locale";

/** Organizer dashboard frame: dark side menu (desktop) / top bar (phone). */
export default async function OrgDashboardLayout({ children, params }: LayoutProps<"/dashboard/[orgSlug]">) {
  const { orgSlug } = await params;
  const { org, role, user } = await requireOrgMembership(orgSlug);
  const memberships = await getMyMemberships();
  const { locale, t } = await getServerTranslator();
  const base = `/dashboard/${org.slug}`;

  const items: { href: string; label: string; icon: NavIcon; exact?: boolean }[] = [
    { href: base, label: t("nav.events"), icon: "events", exact: true },
    ...(role === "admin"
      ? [
          { href: `${base}/team`, label: t("nav.team"), icon: "team" as const },
          { href: `${base}/settings`, label: t("nav.settings"), icon: "settings" as const },
        ]
      : []),
    ...(user.isPlatformOwner ? [{ href: "/admin", label: t("nav.ownerConsole"), icon: "owner" as const }] : []),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="bg-ink-900 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="relative overflow-hidden px-4 pb-3 pt-4 lg:px-5 lg:pt-6">
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-brand-600/50 blur-3xl" />
          <div className="relative flex items-center justify-between gap-3">
            <BrandLogo href={base} light />
            <div className="lg:hidden">
              <LanguageSwitcher locale={locale} label={t("lang.switch")} dark />
            </div>
          </div>
          <div className="relative mt-4 flex items-center gap-3">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5" />
            ) : (
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15 font-extrabold">
                {org.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <OrgSwitcher
              current={org.slug}
              label={t("org.switch")}
              createLabel={t("org.create")}
              options={memberships.map((m) => ({ slug: m.organization.slug, name: m.organization.name }))}
            />
          </div>
        </div>
        <div className="px-3 pb-3 lg:flex-1 lg:px-3 lg:pt-4">
          <DashboardNav items={items} />
        </div>
        <div className="hidden border-t border-white/10 p-4 lg:block">
          <p className="truncate text-xs text-white/60">{user.email}</p>
          <div className="mt-3 flex items-center justify-between">
            <LanguageSwitcher locale={locale} label={t("lang.switch")} dark />
            <form action="/auth/sign-out" method="post">
              <button className="btn btn-sm text-white/80 hover:bg-white/10 hover:text-white">
                <LogOutIcon size={16} /> {t("nav.signOut")}
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {org.status === "suspended" && (
          <div role="alert" className="bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-800">{t("org.suspended")}</div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 lg:py-10">{children}</main>
        <form action="/auth/sign-out" method="post" className="border-t border-brand-100 px-4 py-3 text-right lg:hidden">
          <button className="btn-ghost btn-sm"><LogOutIcon size={16} /> {t("nav.signOut")}</button>
        </form>
      </div>
    </div>
  );
}
