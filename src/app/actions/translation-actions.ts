"use server";
import { requireOrgMembership } from "@/lib/auth-guards";
import { translateToIndonesian, TranslationNotConfiguredError } from "@/lib/translation";

export interface TranslateResult {
  texts?: string[];
  error?: "not_configured" | "too_long" | "failed";
}

const MAX_TEXTS = 200;
const MAX_TOTAL_CHARACTERS = 50000;

/**
 * Powers the "Translate to Indonesian" buttons. Only admins of the
 * organization may use it, so the free translation quota can't be drained
 * by strangers. Empty texts are skipped and come back empty.
 */
export async function translateTextsAction(orgSlug: string, texts: string[]): Promise<TranslateResult> {
  await requireOrgMembership(orgSlug, ["admin"]);
  const totalLength = texts.reduce((sum, t) => sum + (t?.length ?? 0), 0);
  if (texts.length > MAX_TEXTS || totalLength > MAX_TOTAL_CHARACTERS) return { error: "too_long" };

  const toTranslate = texts.map((t, i) => ({ i, t: (t ?? "").trim() })).filter((x) => x.t);
  try {
    const translated = await translateToIndonesian(toTranslate.map((x) => x.t));
    const result = texts.map(() => "");
    toTranslate.forEach((x, n) => (result[x.i] = translated[n]));
    return { texts: result };
  } catch (err) {
    if (err instanceof TranslationNotConfiguredError) return { error: "not_configured" };
    console.error("translation failed", err);
    return { error: "failed" };
  }
}
