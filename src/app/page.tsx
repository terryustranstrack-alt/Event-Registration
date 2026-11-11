import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CalendarIcon, ChartIcon, MapPinIcon, ScanIcon, SparklesIcon, TicketIcon } from "@/components/icons";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const { error_code: errorCode } = await searchParams;
  const { t } = await getServerTranslator();
  const features = [
    { key: "landing.f1", icon: SparklesIcon, tint: "bg-brand-100 text-brand-700" },
    { key: "landing.f2", icon: TicketIcon, tint: "bg-pink-100 text-pop-600" },
    { key: "landing.f3", icon: ScanIcon, tint: "bg-orange-100 text-orange-700" },
    { key: "landing.f4", icon: ChartIcon, tint: "bg-emerald-100 text-emerald-700" },
  ] as const;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {typeof errorCode === "string" && (
          <p role="alert" className="mx-auto mt-6 max-w-6xl rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
            {t("auth.linkExpired")}{" "}
            <Link href="/login" className="font-bold underline">{t("nav.signIn")}</Link>
          </p>
        )}

        {/* Hero: dark stage with colored "stage lights" glow behind. */}
        <section className="relative overflow-hidden bg-ink-900 text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/50 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-pop-600/40 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sun-500/30 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
            <div>
              <p className="eyebrow text-sun-400">{t("app.name")}</p>
              <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                {t("landing.heroTitle")}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/80">{t("landing.heroSubtitle")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="btn-primary px-6 py-3 text-base">{t("landing.cta")}</Link>
                <Link href="/login" className="btn border-2 border-white/25 px-6 py-3 text-base text-white hover:bg-white/10">
                  {t("landing.secondaryCta")}
                </Link>
              </div>
            </div>
            <SampleTicket label={t("landing.ticketSample")} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight">{t("landing.featuresTitle")}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ key, icon: FeatureIcon, tint }) => (
              <li key={key} className="card transition hover:-translate-y-1">
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${tint}`}>
                  <FeatureIcon size={22} />
                </span>
                <p className="mt-4 font-semibold leading-snug text-ink-800">{t(key)}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

/** Decorative ticket mock-up for the hero (not real data). */
function SampleTicket({ label }: { label: string }) {
  return (
    <div aria-label={label} role="img" className="mx-auto w-full max-w-sm rotate-2 transition hover:rotate-0">
      <div className="overflow-hidden rounded-3xl bg-white text-ink-900 shadow-2xl shadow-black/40">
        <div className="bg-festival px-6 pb-6 pt-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">Live music · Jakarta</p>
          <p className="mt-1 text-2xl font-extrabold">Sunset Sessions 2026</p>
        </div>
        <div className="relative flex items-center gap-4 border-t-2 border-dashed border-brand-100 px-6 py-5">
          <span aria-hidden="true" className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-ink-900" />
          <span aria-hidden="true" className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-ink-900" />
          <div className="grid h-20 w-20 shrink-0 grid-cols-5 gap-0.5 rounded-lg bg-white p-1.5 ring-2 ring-ink-900">
            {Array.from({ length: 25 }, (_, i) => (
              <span key={i} className={[0, 1, 3, 5, 6, 8, 12, 14, 16, 18, 19, 20, 22, 24].includes(i) ? "bg-ink-900" : ""} />
            ))}
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="flex items-center gap-1.5 font-semibold"><CalendarIcon size={16} className="text-brand-600" /> Sat, 20 Dec · 19:00</p>
            <p className="flex items-center gap-1.5 font-semibold"><MapPinIcon size={16} className="text-pop-600" /> Kota Tua, Jakarta</p>
          </div>
        </div>
      </div>
    </div>
  );
}
