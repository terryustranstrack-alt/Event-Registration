import { dictionaryEn, type DictionaryKey } from "./dictionary-en";
import { dictionaryId } from "./dictionary-id";

export type Locale = "en" | "id";
export const LOCALES: Locale[] = ["en", "id"];
export const LOCALE_COOKIE = "lang";

const dictionaries = { en: dictionaryEn, id: dictionaryId } as const;

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "id";
}

export type Translate = (key: DictionaryKey, vars?: Record<string, string | number>) => string;

export function getTranslator(locale: Locale): Translate {
  const dict = dictionaries[locale];
  return (key, vars) => {
    let text: string = dict[key] ?? dictionaryEn[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

/**
 * Org-entered bilingual content (FR-10.2): show the requested language,
 * falling back to the other one when empty.
 */
export function pickLocalized(locale: Locale, en?: string | null, id?: string | null): string {
  const primary = locale === "id" ? id : en;
  const fallback = locale === "id" ? en : id;
  return (primary?.trim() ? primary : fallback?.trim() ? fallback : "") ?? "";
}

/** Pick a locale from an Accept-Language header, or null. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    if (tag.startsWith("id") || tag.startsWith("in")) return "id";
    if (tag.startsWith("en")) return "en";
  }
  return null;
}
