import Link from "next/link";
import { CalendarIcon, CheckIcon, MapPinIcon, TicketIcon } from "@/components/icons";
import type { Translate } from "@/lib/i18n/translate";

/** Top of the front page: headline, sign-up buttons and a sample ticket. */
export function LandingHero({ t }: { t: Translate }) {
  const points = ["landing.heroPoint1", "landing.heroPoint2", "landing.heroPoint3"] as const;
  return (
    <section className="relative overflow-hidden bg-ink-900 text-white">
      {/* Colored "stage lights" glowing behind the content. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-600/50 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full bg-pop-600/40 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-sun-500/30 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-sun-400 ring-1 ring-white/15">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sun-400" /> {t("landing.heroBadge")}
          </p>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">{t("landing.heroTitle")}</h1>
          <p className="mt-6 max-w-xl text-lg text-white/80 sm:text-xl">{t("landing.heroSubtitle")}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary px-7 py-3.5 text-base">{t("landing.cta")}</Link>
            <Link href="/login" className="btn border-2 border-white/25 px-7 py-3.5 text-base text-white hover:bg-white/10">
              {t("landing.secondaryCta")}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/80">
            {points.map((key) => (
              <li key={key} className="flex items-center gap-2">
                <CheckIcon size={16} className="text-emerald-400" /> {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <SampleTicket t={t} />
      </div>
    </section>
  );
}

/** Decorative ticket with floating "checked in" and "seats left" tags (not real data). */
function SampleTicket({ t }: { t: Translate }) {
  return (
    <div role="img" aria-label={t("landing.ticketSample")} className="relative mx-auto mt-8 w-full max-w-sm lg:mt-0">
      <div className="rotate-2 overflow-hidden rounded-3xl bg-white text-ink-900 shadow-2xl shadow-black/50 transition hover:rotate-0">
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
      <p className="absolute -left-2 -top-11 flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-extrabold text-emerald-950 shadow-xl sm:-left-8">
        <CheckIcon size={16} /> {t("landing.mockCheckedIn")}
      </p>
      <p className="absolute -bottom-6 -right-1 flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-orange-700 shadow-xl sm:-right-8">
        <TicketIcon size={16} /> {t("landing.mockSeats")}
      </p>
    </div>
  );
}
