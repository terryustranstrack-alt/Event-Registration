import { CheckIcon } from "@/components/icons";
import type { Translate } from "@/lib/i18n/translate";

/** "Made for events in Indonesia" band. */
export function LandingLocal({ t }: { t: Translate }) {
  const points = ["landing.local1", "landing.local2", "landing.local3", "landing.local4", "landing.local5"] as const;
  return (
    <section className="bg-festival relative overflow-hidden py-20 text-white">
      <div aria-hidden="true" className="absolute inset-0 bg-ink-900/30" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <h2 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t("landing.localTitle")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {points.map((key) => (
            <li key={key} className="flex items-start gap-3 rounded-2xl bg-white/12 p-4 font-semibold ring-1 ring-white/20 backdrop-blur">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-brand-700"><CheckIcon size={14} /></span>
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
