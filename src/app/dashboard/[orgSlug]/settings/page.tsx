import { OrganizationForm } from "@/components/organization-form";
import { updateOrganizationAction } from "@/app/actions/organization-actions";
import { requireOrgMembership } from "@/lib/auth-guards";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export default async function OrganizationSettingsPage({ params }: PageProps<"/dashboard/[orgSlug]/settings">) {
  const { orgSlug } = await params;
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  const { locale, t } = await getServerTranslator();
  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t("nav.settings")}</h1>
      <div className="card">
        <OrganizationForm locale={locale} action={updateOrganizationAction} org={org} />
      </div>
    </div>
  );
}
