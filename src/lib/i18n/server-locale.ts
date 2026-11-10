import "server-only";
import { cookies, headers } from "next/headers";
import { getTranslator, isLocale, localeFromAcceptLanguage, LOCALE_COOKIE, type Locale } from "./translate";

/**
 * Locale order (FR-4.5): explicit choice (cookie) → browser language →
 * organization default → Indonesian.
 */
export async function getRequestLocale(orgDefault?: Locale | null): Promise<Locale> {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieValue)) return cookieValue;
  const fromBrowser = localeFromAcceptLanguage((await headers()).get("accept-language"));
  return fromBrowser ?? orgDefault ?? "id";
}

export async function getServerTranslator(orgDefault?: Locale | null) {
  const locale = await getRequestLocale(orgDefault);
  return { locale, t: getTranslator(locale) };
}
