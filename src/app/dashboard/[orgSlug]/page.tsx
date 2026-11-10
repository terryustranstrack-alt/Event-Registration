import Link from "next/link";
import { requireOrgMembership } from "@/lib/auth-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { pickLocalized } from "@/lib/i18n/translate";
import { EventStatusBadge } from "@/components/event-status-badge";
import type { EventRow } from "@/lib/domain-types";

/** Org overview: all events with headline numbers (FR-9.5). */
export default async function OrgEventsPage({ params }: PageProps<"/dashboard/[orgSlug]">) {
  const { orgSlug } = await params;
  const { org, role } = await requireOrgMembership(orgSlug);
  const { locale, t } = await getServerTranslator(org.default_language);
  const supabase = await createSupabaseServerClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, slug, title_en, title_id, starts_at, timezone, status, capacity, seats_taken")
    .eq("org_id", org.id)
    .order("starts_at", { ascending: false });
  const eventIds = (events ?? []).map((e) => e.id);
  const { data: checkedRows } = eventIds.length
    ? await supabase.from("registrations").select("event_id").in("event_id", eventIds).eq("status", "registered").not("checked_in_at", "is", null)
    : { data: [] as { event_id: string }[] };
  const checkedByEvent = new Map<string, number>();
  for (const row of checkedRows ?? []) checkedByEvent.set(row.event_id, (checkedByEvent.get(row.event_id) ?? 0) + 1);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("nav.events")}</h1>
        {role === "admin" && (
          <Link href={`/dashboard/${org.slug}/events/new`} className="btn-primary">+ {t("event.new")}</Link>
        )}
      </div>
      {(events ?? []).length === 0 ? (
        <p className="card text-zinc-600">{t("event.none")}</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3">{t("nav.events")}</th>
                <th className="px-4 py-3">{t("event.startsAt")}</th>
                <th className="px-4 py-3">{t("event.status")}</th>
                <th className="px-4 py-3 text-right">{t("report.registered")}</th>
                <th className="px-4 py-3 text-right">{t("report.checkedIn")}</th>
                <th className="px-4 py-3 text-right">{t("report.seatsLeft")}</th>
              </tr>
            </thead>
            <tbody>
              {(events as EventRow[]).map((e) => (
                <tr key={e.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/dashboard/${org.slug}/events/${e.id}${role === "admin" ? "" : "/registrants"}`} className="text-brand-700 hover:underline">
                      {pickLocalized(locale, e.title_en, e.title_id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{formatDateTime(e.starts_at, locale, e.timezone)}</td>
                  <td className="px-4 py-3"><EventStatusBadge status={e.status} t={t} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(e.seats_taken, locale)} / {formatNumber(e.capacity, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(checkedByEvent.get(e.id) ?? 0, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(Math.max(e.capacity - e.seats_taken, 0), locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
