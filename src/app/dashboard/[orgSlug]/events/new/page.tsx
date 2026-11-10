import { EventEditorForm } from "@/components/event-editor-form";
import { createEventAction } from "@/app/actions/event-actions";
import { requireOrgMembership } from "@/lib/auth-guards";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export default async function NewEventPage({ params }: PageProps<"/dashboard/[orgSlug]/events/new">) {
  const { orgSlug } = await params;
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  const { locale, t } = await getServerTranslator(org.default_language);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t("event.new")}</h1>
      <EventEditorForm locale={locale} orgSlug={org.slug} action={createEventAction} />
    </div>
  );
}
