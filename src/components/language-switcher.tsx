"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/locale-actions";
import type { Locale } from "@/lib/i18n/translate";

/** EN/ID switch for the header (FR-4.5). */
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-zinc-300 bg-white text-xs font-semibold">
      {(["id", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          disabled={pending}
          aria-pressed={l === locale}
          className={`px-2.5 py-1.5 uppercase ${l === locale ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
