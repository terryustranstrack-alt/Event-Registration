"use client";
import { useEffect, useState } from "react";
import { getTranslator, type Locale } from "@/lib/i18n/translate";

/** Countdown to start; "Happening now" / "Event ended" afterwards (FR-4.2). */
export function EventCountdown({ startsAt, endsAt, locale }: { startsAt: string; endsAt: string; locale: Locale }) {
  const t = getTranslator(locale);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (now === null) return <div className="h-16" aria-hidden="true" />;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (now >= end) return <p className="rounded-lg bg-zinc-100 px-4 py-3 text-center font-semibold text-zinc-700">{t("public.ended")}</p>;
  if (now >= start)
    return <p className="rounded-lg bg-green-100 px-4 py-3 text-center font-semibold text-green-800">● {t("public.happeningNow")}</p>;

  const total = Math.floor((start - now) / 1000);
  const parts = [
    { value: Math.floor(total / 86400), label: t("public.days") },
    { value: Math.floor((total % 86400) / 3600), label: t("public.hours") },
    { value: Math.floor((total % 3600) / 60), label: t("public.minutes") },
    { value: total % 60, label: t("public.seconds") },
  ];
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-600">{t("public.startsIn")}</p>
      <div className="grid grid-cols-4 gap-2" role="timer" aria-live="off">
        {parts.map((p) => (
          <div key={p.label} className="rounded-lg bg-zinc-900 px-2 py-2 text-center text-white">
            <div className="text-2xl font-bold tabular-nums">{String(p.value).padStart(2, "0")}</div>
            <div className="text-xs uppercase text-zinc-300">{p.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
