import type { Locale } from "./translate";

const intlLocale = (locale: Locale) => (locale === "id" ? "id-ID" : "en-US");

/** 20 Des 2026 / Dec 20, 2026 (FR-10.4) */
export function formatDate(value: string | Date, locale: Locale, timeZone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date, locale: Locale, timeZone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatTime(value: string | Date, locale: Locale, timeZone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

/** Rp 150.000 in both languages (FR-10.4) */
export function formatRupiah(amount: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(amount)}`;
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** Event range: same-day events show the date once. */
export function formatEventRange(start: string, end: string, locale: Locale, timeZone: string): string {
  const startDay = formatDate(start, locale, timeZone);
  const endDay = formatDate(end, locale, timeZone);
  if (startDay === endDay) {
    return `${formatDateTime(start, locale, timeZone)} – ${formatTime(end, locale, timeZone)}`;
  }
  return `${formatDateTime(start, locale, timeZone)} – ${formatDateTime(end, locale, timeZone)}`;
}
