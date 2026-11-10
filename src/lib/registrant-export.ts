import type { FormField, Registration } from "@/lib/domain-types";
import { pickLocalized, type Locale } from "@/lib/i18n/translate";

/**
 * Turns registrations + answers into a flat table (FR-9.4). Archived
 * questions are included so old answers are never lost (FR-3.5).
 */
export function buildRegistrantTable(
  fields: FormField[],
  registrations: Pick<Registration, "full_name" | "email" | "language" | "status" | "created_at" | "checked_in_at" | "ticket_code" | "answers" | "consent_at">[],
  locale: Locale,
) {
  const header = [
    "Full name",
    "Email",
    "Language",
    "Status",
    "Registered at (UTC)",
    "Checked in at (UTC)",
    "Ticket code",
    "Consent at (UTC)",
    ...fields.map((f) => pickLocalized(locale, f.label_en, f.label_id) + (f.archived_at ? " (deleted)" : "")),
  ];
  const rows = registrations.map((r) => [
    r.full_name,
    r.email,
    r.language,
    r.status,
    r.created_at,
    r.checked_in_at ?? "",
    r.ticket_code,
    r.consent_at ?? "",
    ...fields.map((f) => formatAnswer(f, r.answers?.[f.id], locale)),
  ]);
  return { header, rows };
}

export function formatAnswer(field: FormField, value: unknown, locale: Locale): string {
  if (value === null || value === undefined) return "";
  const label = (v: string) => {
    const option = field.options.find((o) => o.value === v);
    return option ? pickLocalized(locale, option.label_en, option.label_id) || v : v;
  };
  if (Array.isArray(value)) return value.map((v) => label(String(v))).join("; ");
  if (typeof value === "object" && value && "name" in value) return String((value as { name: string }).name);
  if (["dropdown", "radio"].includes(field.type)) return label(String(value));
  return String(value);
}

function csvCell(value: string): string {
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: string[][]): string {
  // BOM so Excel opens UTF-8 (Indonesian names) correctly.
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
