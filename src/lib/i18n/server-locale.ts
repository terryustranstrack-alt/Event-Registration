import "server-only";
import { cookies } from "next/headers";
import { getTranslator, isLocale, LOCALE_COOKIE, type Locale } from "./translate";

/**
 * Which language to show: the visitor's own choice from the ID/EN switch
 * (saved in a cookie), otherwise English.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(cookieValue) ? cookieValue : "en";
}

export async function getServerTranslator() {
  const locale = await getRequestLocale();
  return { locale, t: getTranslator(locale) };
}
