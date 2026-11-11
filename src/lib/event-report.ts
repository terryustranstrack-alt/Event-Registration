import type { FormField, RegistrationStatus } from "@/lib/domain-types";

interface ReportRow {
  status: RegistrationStatus;
  created_at: string;
  checked_in_at: string | null;
  answers: Record<string, unknown>;
}

/** Local calendar day (YYYY-MM-DD) in the event's time zone. */
function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Registrations per day (FR-9.2). */
export function registrationsPerDay(rows: ReportRow[], timeZone: string) {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(dayKey(r.created_at, timeZone), (counts.get(dayKey(r.created_at, timeZone)) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count }));
}

/** Check-ins per 15-minute bucket (FR-9.2). Returns bucket start ISO strings. */
export function checkInsPer15Minutes(rows: ReportRow[]) {
  const bucketMs = 15 * 60 * 1000;
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (r.status !== "registered" || !r.checked_in_at) continue;
    const bucket = Math.floor(new Date(r.checked_in_at).getTime() / bucketMs) * bucketMs;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const keys = [...counts.keys()].sort((a, b) => a - b);
  const result: { key: string; count: number }[] = [];
  for (let t = keys[0]; t <= keys[keys.length - 1]; t += bucketMs) {
    result.push({ key: new Date(t).toISOString(), count: counts.get(t) ?? 0 });
  }
  return result;
}

/** Counts per option for choice questions (FR-9.3). Registered only. */
export function answerSummaries(fields: FormField[], rows: ReportRow[]) {
  return fields
    .filter((f) => ["dropdown", "radio", "checkbox"].includes(f.type))
    .map((field) => {
      const counts = new Map<string, number>(field.options.map((o) => [o.value, 0]));
      for (const r of rows) {
        if (r.status !== "registered") continue;
        const value = r.answers?.[field.id];
        const values = Array.isArray(value) ? value : value != null ? [value] : [];
        for (const v of values) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
      }
      return { field, counts: [...counts.entries()].map(([value, count]) => ({ value, count })) };
    });
}
