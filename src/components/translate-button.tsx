"use client";
import { useState, useTransition } from "react";
import { translateTextsAction } from "@/app/actions/translation-actions";
import { LanguagesIcon } from "@/components/icons";
import type { Translate } from "@/lib/i18n/translate";

/**
 * "Translate to Indonesian" button. `getTexts` returns the English texts to
 * translate; `onTranslated` receives the Indonesian texts in the same order.
 */
export function TranslateButton({
  orgSlug,
  t,
  label,
  getTexts,
  onTranslated,
}: {
  orgSlug: string;
  t: Translate;
  label?: string;
  getTexts: () => string[];
  onTranslated: (texts: string[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function run() {
    const texts = getTexts();
    if (!texts.some((x) => x.trim())) return setMessage({ tone: "error", text: t("translate.nothing") });
    setMessage(null);
    startTransition(async () => {
      const result = await translateTextsAction(orgSlug, texts);
      if (result.texts) {
        onTranslated(result.texts);
        setMessage({ tone: "ok", text: t("translate.done") });
      } else {
        const key = result.error === "not_configured" ? "translate.notConfigured" : result.error === "too_long" ? "translate.tooLong" : "translate.failed";
        setMessage({ tone: "error", text: t(key) });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={pending} className="btn bg-ink-900 text-white hover:bg-ink-800">
        <LanguagesIcon size={17} /> {pending ? t("translate.working") : (label ?? t("translate.button"))}
      </button>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm font-semibold ${message.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
