import { SiteHeader } from "@/components/site-header";
import { OrganizationForm } from "@/components/organization-form";
import { createOrganizationAction } from "@/app/actions/organization-actions";
import { requireUser } from "@/lib/auth-guards";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export const metadata = { title: "Create organization" };

export default async function NewOrganizationPage() {
  await requireUser("/dashboard/new-organization");
  const { locale, t } = await getServerTranslator();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold">{t("org.create")}</h1>
        <div className="card">
          <OrganizationForm locale={locale} action={createOrganizationAction} />
        </div>
      </main>
    </>
  );
}
