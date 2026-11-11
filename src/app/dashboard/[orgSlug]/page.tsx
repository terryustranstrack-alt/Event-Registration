import Link from "next/link";
import { requireOrgMembership } from "@/lib/auth-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { pickLocalized, type Locale, type Translate } from "@/lib/i18n/translate";
import { EventStatusBadge } from "@/components/event-status-badge";
import { PageHeader } from "@/components/page-header";
import { CalendarIcon, CheckIcon, PlusIcon, TicketIcon } from "@/components/icons";
import type { EventRow } from "@/lib/domain-types";

type EventCardData = Pick<EventRow, "id" | "title_en" | "title_id" | "starts_at" | "timezone" | "status" | "capacity" | "seats_taken" | "banner_url">;

/** Organization overview: all events with headline numbers (FR-9.5). */
export default async function OrgEventsPage({ params }: PageProps<"/dashboard/[orgSlug]">) {
  const { orgSlug } = await params;
  const { org, role } = await requireOrgMembership(orgSlug);
  const { locale, t } = await getServerTranslator();
  const events = await loadEvents(org.id);
  const checkedIn = await loadCheckedInCounts(events.map((e) => e.id));
  const newEventHref = `/dashboard/${org.slug}/events/new`;

  return (
    <div>
      <PageHeader
        eyebrow={org.name}
        title={t("nav.events")}
        actions={role === "admin" && <Link href={newEventHref} className="btn-primary"><PlusIcon size={18} /> {t("event.new")}</Link>}
      />
      {events.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="bg-festival grid h-14 w-14 place-items-center rounded-2xl text-white"><TicketIcon size={28} /></span>
          <p className="mt-4 text-lg font-bold">{t("event.none")}</p>
          <p className="mt-1 text-ink-700">{t("event.noneHint")}</p>
          {role === "admin" && <Link href={newEventHref} className="btn-primary mt-6"><PlusIcon size={18} /> {t("event.new")}</Link>}
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <li key={e.id}>
              <EventCard
                event={e}
                checkedIn={checkedIn.get(e.id) ?? 0}
                href={`/dashboard/${org.slug}/events/${e.id}${role === "admin" ? "" : "/registrants"}`}
                locale={locale}
                t={t}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function loadEvents(orgId: string): Promise<EventCardData[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, title_en, title_id, starts_at, timezone, status, capacity, seats_taken, banner_url")
    .eq("org_id", orgId)
    .order("starts_at", { ascending: false });
  return (data ?? []) as EventCardData[];
}

/** Number of checked-in guests per event. */
async function loadCheckedInCounts(eventIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (eventIds.length === 0) return counts;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("registrations")
    .select("event_id")
    .in("event_id", eventIds)
    .eq("status", "registered")
    .not("checked_in_at", "is", null);
  for (const row of data ?? []) counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
  return counts;
}

function EventCard({ event, checkedIn, href, locale, t }: { event: EventCardData; checkedIn: number; href: string; locale: Locale; t: Translate }) {
  const filled = Math.min(100, Math.round((event.seats_taken / Math.max(event.capacity, 1)) * 100));
  return (
    <Link href={href} className="card group block h-full overflow-hidden p-0 transition hover:-translate-y-1 hover:shadow-xl">
      <div className="bg-festival relative aspect-[16/7] overflow-hidden">
        {event.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.banner_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        )}
        <div className="absolute left-3 top-3"><EventStatusBadge status={event.status} t={t} /></div>
      </div>
      <div className="p-5">
        <h2 className="line-clamp-2 text-lg font-extrabold leading-snug text-ink-900 group-hover:text-brand-700">
          {pickLocalized(locale, event.title_en, event.title_id)}
        </h2>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-700">
          <CalendarIcon size={15} className="text-pop-600" /> {formatDateTime(event.starts_at, locale, event.timezone)}
        </p>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-brand-50">
            <div className="h-full rounded-full bg-linear-to-r from-brand-600 to-pop-500" style={{ width: `${filled}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs font-semibold text-ink-700">
            <span>{t("event.seatsFilled", { taken: formatNumber(event.seats_taken, locale), total: formatNumber(event.capacity, locale) })}</span>
            <span className="flex items-center gap-1 text-emerald-700"><CheckIcon size={14} /> {formatNumber(checkedIn, locale)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
