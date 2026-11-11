import type { Translate } from "@/lib/i18n/translate";

/** "Live in three steps": create, share, scan. */
export function LandingSteps({ t }: { t: Translate }) {
  const steps = [
    { title: "landing.step1Title", text: "landing.step1Text" },
    { title: "landing.step2Title", text: "landing.step2Text" },
    { title: "landing.step3Title", text: "landing.step3Text" },
  ] as const;
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20">
      <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">{t("landing.stepsTitle")}</h2>
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="card relative pt-10">
            <span className="bg-festival absolute -top-6 left-5 grid h-12 w-12 place-items-center rounded-2xl text-xl font-extrabold text-white shadow-lg shadow-pop-600/30">
              {i + 1}
            </span>
            <h3 className="text-xl font-extrabold">{t(step.title)}</h3>
            <p className="mt-2 leading-relaxed text-ink-700">{t(step.text)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
