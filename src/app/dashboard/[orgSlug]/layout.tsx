import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OrgSwitcher } from "@/components/org-switcher";
import { getMyMemberships, requireOrgMembership } from "@/lib/auth-guards";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export default async function OrgDashboardLayout({ children, params }: LayoutProps<"/dashboard/[orgSlug]">) {
  const { orgSlug } = await params;
  const { org, role, user } = await requireOrgMembership(orgSlug);
  const memberships = await getMyMemberships();
  const { locale, t } = await getServerTranslator(org.default_language);
  const base = `/dashboard/${org.slug}`;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href={base} className="flex items-center gap-2 font-bold text-zinc-900">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
            )}
            <span>{org.name}</span>
          </Link>
          <OrgSwitcher
            current={org.slug}
            label={t("org.switch")}
            createLabel={t("org.create")}
            options={memberships.map((m) => ({ slug: m.organization.slug, name: m.organization.name }))}
          />
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            <Link href={base} className="rounded-md px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100">{t("nav.events")}</Link>
            {role === "admin" && (
              <>
                <Link href={`${base}/team`} className="rounded-md px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100">{t("nav.team")}</Link>
                <Link href={`${base}/settings`} className="rounded-md px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100">{t("nav.settings")}</Link>
              </>
            )}
            {user.isPlatformOwner && (
              <Link href="/admin" className="rounded-md px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100">{t("nav.ownerConsole")}</Link>
            )}
          </nav>
          <LanguageSwitcher locale={locale} label={t("lang.switch")} />
          <form action="/auth/sign-out" method="post">
            <button className="btn-secondary btn-sm">{t("nav.signOut")}</button>
          </form>
        </div>
      </header>
      {org.status === "suspended" && (
        <div role="alert" className="bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-800">{t("org.suspended")}</div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
