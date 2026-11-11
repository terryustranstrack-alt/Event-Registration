import Link from "next/link";
import { requireOrgMembership } from "@/lib/auth-guards";
import { getOrgEvent } from "@/lib/event-data";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatEventRange } from "@/lib/i18n/format";
import { pickLocalized } from "@/lib/i18n/translate";
import { EventStatusBadge } from "@/components/event-status-badge";
import { EventTabs } from "@/components/event-tabs";
import { ArrowLeftIcon, CalendarIcon, ExternalIcon, ScanIcon } from "@/components/icons";
import { deleteDraftEventAction, setEventStatusAction } from "@/app/actions/event-actions";

export default async function EventLayout({ children, params }: LayoutProps<"/dashboard/[orgSlug]/events/[eventId]">) {
  const { orgSlug, eventId } = await params;
  const { org, role } = await requireOrgMembership(orgSlug);
  const event = await getOrgEvent(org.id, eventId);
  const { locale, t } = await getServerTranslator();
  const base = `/dashboard/${org.slug}/events/${event.id}`;
  const isAdmin = role === "admin";

  // Small form button that changes the event status (publish / close / reopen).
  const statusButton = (status: string, label: string, className: string) => (
    <form action={setEventStatusAction}>
      <input type="hidden" name="org_slug" value={org.slug} />
      <input type="hidden" name="event_id" value={event.id} />
      <input type="hidden" name="status" value={status} />
      <button className={className}>{label}</button>
    </form>
  );

  return (
    <div>
      <Link href={`/dashboard/${org.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700 hover:text-brand-700">
        <ArrowLeftIcon size={16} /> {t("nav.events")}
      </Link>

      <header className="bg-festival relative mt-3 overflow-hidden rounded-3xl text-white shadow-lg shadow-brand-700/20">
        {event.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {/* Dark wash so white text stays readable on any banner photo. */}
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-ink-900/90 via-ink-900/55 to-ink-900/20" />
        <div className="relative flex flex-wrap items-end justify-between gap-5 p-6 pt-16 sm:p-8 sm:pt-24">
          <div className="min-w-0">
            <EventStatusBadge status={event.status} t={t} />
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-4xl">{pickLocalized(locale, event.title_en, event.title_id)}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white/85">
              <CalendarIcon size={16} /> {formatEventRange(event.starts_at, event.ends_at, locale, event.timezone)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {event.status !== "draft" && (
              <a href={`/${org.slug}/${event.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm bg-white/15 text-white backdrop-blur hover:bg-white/25">
                <ExternalIcon size={15} /> {t("event.viewPublic")}
              </a>
            )}
            <Link href={`/checkin/${event.id}`} className="btn btn-sm bg-white/15 text-white backdrop-blur hover:bg-white/25">
              <ScanIcon size={15} /> {t("event.openScanner")}
            </Link>
            {isAdmin && event.status === "draft" && statusButton("published", t("event.publish"), "btn btn-sm bg-white text-brand-700 hover:bg-brand-50")}
            {isAdmin && event.status === "published" && statusButton("closed", t("event.close"), "btn btn-sm bg-white/15 text-white backdrop-blur hover:bg-white/25")}
            {isAdmin && event.status === "closed" && statusButton("published", t("event.reopen"), "btn btn-sm bg-white text-brand-700 hover:bg-brand-50")}
            {isAdmin && event.status === "draft" && (
              <form action={deleteDraftEventAction}>
                <input type="hidden" name="org_slug" value={org.slug} />
                <input type="hidden" name="event_id" value={event.id} />
                <button className="btn btn-sm text-white/85 hover:bg-red-600/80 hover:text-white">{t("event.delete")}</button>
              </form>
            )}
          </div>
        </div>
      </header>

      <div className="mt-6">
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
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
