import { FormBuilder } from "@/components/form-builder";
import { requireOrgMembership } from "@/lib/auth-guards";
import { getEventFormFields, getOrgEvent } from "@/lib/event-data";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export default async function EventFormBuilderPage({ params }: PageProps<"/dashboard/[orgSlug]/events/[eventId]/form">) {
  const { orgSlug, eventId } = await params;
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  const event = await getOrgEvent(org.id, eventId);
  const fields = await getEventFormFields(event.id);
  const { locale } = await getServerTranslator(org.default_language);
  return (
    <FormBuilder
      locale={locale}
      orgSlug={org.slug}
      orgName={org.name}
      eventId={event.id}
      consentEnabled={event.consent_enabled}
      initialFields={fields}
    />
  );
}
