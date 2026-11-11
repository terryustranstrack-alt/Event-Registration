import type { Translate } from "@/lib/i18n/translate";

/** Common questions, each opens on click. */
export function LandingFaq({ t }: { t: Translate }) {
  const items = [
    ["landing.faq1q", "landing.faq1a"],
    ["landing.faq2q", "landing.faq2a"],
    ["landing.faq3q", "landing.faq3a"],
    ["landing.faq4q", "landing.faq4a"],
    ["landing.faq5q", "landing.faq5a"],
  ] as const;
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 pb-20">
      <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">{t("landing.faqTitle")}</h2>
      <div className="mt-10 space-y-3">
        {items.map(([question, answer]) => (
          <details key={question} className="card group p-0 open:ring-2 open:ring-brand-200">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
              {t(question)}
              <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition group-open:rotate-45">+</span>
            </summary>
            <p className="px-5 pb-5 leading-relaxed text-ink-700">{t(answer)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
