import { EventEditorForm } from "@/components/event-editor-form";
import { updateEventAction } from "@/app/actions/event-actions";
import { requireOrgMembership } from "@/lib/auth-guards";
import { getOrgEvent } from "@/lib/event-data";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export default async function EventDetailsPage({ params }: PageProps<"/dashboard/[orgSlug]/events/[eventId]">) {
  const { orgSlug, eventId } = await params;
  const { org } = await requireOrgMembership(orgSlug, ["admin"]);
  const event = await getOrgEvent(org.id, eventId);
  const { locale } = await getServerTranslator(org.default_language);
  return <EventEditorForm key={event.id} locale={locale} orgSlug={org.slug} event={event} action={updateEventAction} />;
}
