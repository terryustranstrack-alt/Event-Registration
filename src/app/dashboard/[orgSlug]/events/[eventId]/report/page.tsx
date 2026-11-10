import { requireOrgMembership } from "@/lib/auth-guards";
import { getEventFormFields, getEventStats, getOrgEvent } from "@/lib/event-data";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatDate, formatNumber, formatTime } from "@/lib/i18n/format";
import { pickLocalized } from "@/lib/i18n/translate";
import { answerSummaries, checkInsPer15Minutes, registrationsPerDay } from "@/lib/event-report";
import { BarChart } from "@/components/bar-chart";
import { AutoRefresh } from "@/components/auto-refresh";

/** Per-event dashboard (FR-9.1 – FR-9.3). */
export default async function EventReportPage({ params }: PageProps<"/dashboard/[orgSlug]/events/[eventId]/report">) {
  const { orgSlug, eventId } = await params;
  const { org } = await requireOrgMembership(orgSlug);
  const event = await getOrgEvent(org.id, eventId);
  const { locale, t } = await getServerTranslator(org.default_language);
  const [stats, fields] = await Promise.all([getEventStats(event.id), getEventFormFields(event.id)]);

  const supabase = await createSupabaseServerClient();
  const rows: { status: "registered" | "cancelled"; created_at: string; checked_in_at: string | null; answers: Record<string, unknown> }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("registrations")
      .select("status, created_at, checked_in_at, answers")
      .eq("event_id", event.id)
      .range(from, from + 999);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }

  const attendance = stats.registered > 0 ? Math.round((stats.checked_in / stats.registered) * 100) : 0;
  const cards = [
    { label: t("report.registered"), value: formatNumber(stats.registered, locale) },
    { label: t("report.checkedIn"), value: formatNumber(stats.checked_in, locale) },
    { label: t("report.noShow"), value: stats.event_ended ? formatNumber(stats.no_show, locale) : "—" },
    { label: t("report.attendanceRate"), value: `${attendance}%` },
    { label: t("report.seatsLeft"), value: formatNumber(stats.seats_left, locale) },
    { label: t("report.cancelled"), value: formatNumber(stats.cancelled, locale) },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs font-medium uppercase text-zinc-600">{c.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart
          title={t("report.checkinsOverTime")}
          emptyLabel={t("report.noData")}
          data={checkInsPer15Minutes(rows).map((b) => ({ label: formatTime(b.key, locale, event.timezone), count: b.count }))}
        />
        <BarChart
          title={t("report.registrationsPerDay")}
          emptyLabel={t("report.noData")}
          data={registrationsPerDay(rows, event.timezone).map((d) => ({ label: formatDate(`${d.key}T12:00:00Z`, locale, "UTC"), count: d.count }))}
        />
      </div>
      {fields.some((f) => ["dropdown", "radio", "checkbox"].includes(f.type)) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("report.answerSummary")}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {answerSummaries(fields, rows).map(({ field, counts }) => {
              const total = Math.max(1, counts.reduce((s, c) => s + c.count, 0));
              return (
                <div key={field.id} className="card">
                  <h3 className="mb-3 font-medium">{pickLocalized(locale, field.label_en, field.label_id)}</h3>
                  <ul className="space-y-2 text-sm">
                    {counts.map(({ value, count }) => {
                      const option = field.options.find((o) => o.value === value);
                      return (
                        <li key={value}>
                          <div className="flex justify-between">
                            <span>{option ? pickLocalized(locale, option.label_en, option.label_id) || value : value}</span>
                            <span className="tabular-nums">{count}</span>
                          </div>
                          <div className="mt-1 h-2 rounded bg-zinc-100">
                            <div className="h-2 rounded bg-brand-500" style={{ width: `${(count / total) * 100}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
