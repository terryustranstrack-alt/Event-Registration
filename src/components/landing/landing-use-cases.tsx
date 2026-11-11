import type { Translate } from "@/lib/i18n/translate";

/** Kinds of events the platform fits, as colorful tiles. */
export function LandingUseCases({ t }: { t: Translate }) {
  const cases = [
    { key: "landing.use1", emoji: "🧑‍🏫", tint: "bg-brand-100" },
    { key: "landing.use2", emoji: "🤝", tint: "bg-pink-100" },
    { key: "landing.use3", emoji: "🎓", tint: "bg-orange-100" },
    { key: "landing.use4", emoji: "🎤", tint: "bg-emerald-100" },
    { key: "landing.use5", emoji: "🚀", tint: "bg-sky-100" },
    { key: "landing.use6", emoji: "🎸", tint: "bg-amber-100" },
  ] as const;
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("landing.useTitle")}</h2>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {cases.map((c) => (
          <li key={c.key} className="card flex items-center gap-4 transition hover:-translate-y-1">
            <span aria-hidden="true" className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${c.tint}`}>{c.emoji}</span>
            <span className="font-bold leading-snug">{t(c.key)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
