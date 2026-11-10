import Link from "next/link";
import { requireOrgMembership } from "@/lib/auth-guards";
import { getOrgEvent } from "@/lib/event-data";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatEventRange } from "@/lib/i18n/format";
import { pickLocalized } from "@/lib/i18n/translate";
import { EventStatusBadge } from "@/components/event-status-badge";
import { EventTabs } from "@/components/event-tabs";
import { deleteDraftEventAction, setEventStatusAction } from "@/app/actions/event-actions";

export default async function EventLayout({ children, params }: LayoutProps<"/dashboard/[orgSlug]/events/[eventId]">) {
  const { orgSlug, eventId } = await params;
  const { org, role } = await requireOrgMembership(orgSlug);
  const event = await getOrgEvent(org.id, eventId);
  const { locale, t } = await getServerTranslator(org.default_language);
  const base = `/dashboard/${org.slug}/events/${event.id}`;
  const isAdmin = role === "admin";

  const statusButton = (status: string, label: string, className = "btn-secondary btn-sm") => (
    <form action={setEventStatusAction}>
      <input type="hidden" name="org_slug" value={org.slug} />
      <input type="hidden" name="event_id" value={event.id} />
      <input type="hidden" name="status" value={status} />
      <button className={className}>{label}</button>
    </form>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/dashboard/${org.slug}`} className="text-sm text-zinc-600 hover:underline">← {t("nav.events")}</Link>
          <h1 className="mt-1 text-2xl font-bold">{pickLocalized(locale, event.title_en, event.title_id)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <EventStatusBadge status={event.status} t={t} />
            {formatEventRange(event.starts_at, event.ends_at, locale, event.timezone)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {event.status !== "draft" && (
            <a href={`/${org.slug}/${event.slug}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">{t("event.viewPublic")} ↗</a>
          )}
          <Link href={`/checkin/${event.id}`} className="btn-secondary btn-sm">{t("event.openScanner")}</Link>
          {isAdmin && event.status === "draft" && statusButton("published", t("event.publish"), "btn-primary btn-sm")}
          {isAdmin && event.status === "published" && statusButton("closed", t("event.close"))}
          {isAdmin && event.status === "closed" && statusButton("published", t("event.reopen"))}
          {isAdmin && event.status === "draft" && (
            <form action={deleteDraftEventAction}>
              <input type="hidden" name="org_slug" value={org.slug} />
              <input type="hidden" name="event_id" value={event.id} />
              <button className="btn-danger btn-sm">{t("event.delete")}</button>
            </form>
          )}
        </div>
      </div>
      <EventTabs
        tabs={[
          ...(isAdmin
            ? [
                { href: base, label: t("event.tabs.details") },
                { href: `${base}/form`, label: t("event.tabs.form") },
              ]
            : []),
          { href: `${base}/registrants`, label: t("event.tabs.registrants") },
          { href: `${base}/report`, label: t("event.tabs.report") },
        ]}
      />
      <div className="mt-6">{children}</div>
    </div>
  );
}
