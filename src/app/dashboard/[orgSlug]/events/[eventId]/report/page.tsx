import { requireOrgMembership } from "@/lib/auth-guards";
import { getEventFormFields, getEventStats, getOrgEvent } from "@/lib/event-data";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatDate, formatNumber, formatTime } from "@/lib/i18n/format";
import { pickLocalized } from "@/lib/i18n/translate";
import { answerSummaries, checkInsPer15Minutes, registrationsPerDay } from "@/lib/event-report";
import { BarChart } from "@/components/bar-chart";
import { AutoRefresh } from "@/components/auto-refresh";
import type { RegistrationStatus } from "@/lib/domain-types";

/** Per-event dashboard (FR-9.1 – FR-9.3). */
export default async function EventReportPage({ params }: PageProps<"/dashboard/[orgSlug]/events/[eventId]/report">) {
  const { orgSlug, eventId } = await params;
  const { org } = await requireOrgMembership(orgSlug);
  const event = await getOrgEvent(org.id, eventId);
  const { locale, t } = await getServerTranslator();
  const [stats, fields] = await Promise.all([getEventStats(event.id), getEventFormFields(event.id)]);

  const supabase = await createSupabaseServerClient();
  const rows: { status: RegistrationStatus; created_at: string; checked_in_at: string | null; answers: Record<string, unknown> }[] = [];
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
  // Each number gets its own accent color so they're easy to tell apart at a glance.
  const cards = [
    { label: t("report.registered"), value: formatNumber(stats.registered, locale), accent: "from-brand-600 to-brand-500" },
    { label: t("report.checkedIn"), value: formatNumber(stats.checked_in, locale), accent: "from-emerald-500 to-emerald-400" },
    { label: t("report.noShow"), value: stats.event_ended ? formatNumber(stats.no_show, locale) : "—", accent: "from-zinc-400 to-zinc-300" },
    { label: t("report.attendanceRate"), value: `${attendance}%`, accent: "from-pop-600 to-pop-500" },
    { label: t("report.seatsLeft"), value: formatNumber(stats.seats_left, locale), accent: "from-sun-500 to-sun-400" },
    { label: t("report.cancelled"), value: formatNumber(stats.cancelled, locale), accent: "from-red-500 to-red-400" },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="card relative overflow-hidden p-4">
            <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 bg-linear-to-r ${c.accent}`} />
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-700/70">{c.label}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{c.value}</p>
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
          <h2 className="text-lg font-extrabold">{t("report.answerSummary")}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {answerSummaries(fields, rows).map(({ field, counts }) => {
              const total = Math.max(1, counts.reduce((s, c) => s + c.count, 0));
              return (
                <div key={field.id} className="card">
                  <h3 className="mb-3 font-bold">{pickLocalized(locale, field.label_en, field.label_id)}</h3>
                  <ul className="space-y-2 text-sm">
                    {counts.map(({ value, count }) => {
                      const option = field.options.find((o) => o.value === value);
                      return (
                        <li key={value}>
                          <div className="flex justify-between">
                            <span>{option ? pickLocalized(locale, option.label_en, option.label_id) || value : value}</span>
                            <span className="tabular-nums">{count}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-brand-50">
                            <div className="h-2 rounded-full bg-linear-to-r from-brand-600 to-pop-500" style={{ width: `${(count / total) * 100}%` }} />
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
