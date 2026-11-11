"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/locale-actions";
import type { Locale } from "@/lib/i18n/translate";

/** EN/ID switch (FR-4.5). `dark` is for use on dark/colored backgrounds. */
export function LanguageSwitcher({ locale, label, dark = false }: { locale: Locale; label: string; dark?: boolean }) {
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
    <div
      role="group"
      aria-label={label}
      className={`inline-flex rounded-full p-0.5 text-xs font-bold ${dark ? "bg-white/15" : "bg-brand-50 ring-1 ring-brand-100"}`}
    >
      {(["en", "id"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          disabled={pending}
          aria-pressed={l === locale}
          className={`rounded-full px-3 py-1 uppercase transition ${
            l === locale
              ? dark
                ? "bg-white text-brand-700"
                : "bg-white text-brand-700 shadow-sm"
              : dark
                ? "text-white/85 hover:text-white"
                : "text-ink-700 hover:text-brand-700"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
