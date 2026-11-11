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

  if (now === null) return <div className="h-20" aria-hidden="true" />;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (now >= end) return <p className="inline-flex rounded-full bg-white/15 px-4 py-2 font-bold text-white">{t("public.ended")}</p>;
  if (now >= start)
    return (
      <p className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 font-extrabold text-emerald-950">
        <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-emerald-950" /> {t("public.happeningNow")}
      </p>
    );

  const total = Math.floor((start - now) / 1000);
  const parts = [
    { value: Math.floor(total / 86400), label: t("public.days") },
    { value: Math.floor((total % 86400) / 3600), label: t("public.hours") },
    { value: Math.floor((total % 3600) / 60), label: t("public.minutes") },
    { value: total % 60, label: t("public.seconds") },
  ];
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/75">{t("public.startsIn")}</p>
      <div className="grid max-w-md grid-cols-4 gap-2" role="timer" aria-live="off">
        {parts.map((p) => (
          <div key={p.label} className="rounded-2xl bg-white/12 px-2 py-3 text-center text-white ring-1 ring-white/20 backdrop-blur">
            <div className="text-3xl font-extrabold tabular-nums">{String(p.value).padStart(2, "0")}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/75">{p.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
