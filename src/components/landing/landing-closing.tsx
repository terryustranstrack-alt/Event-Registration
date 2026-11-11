import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import type { Translate } from "@/lib/i18n/translate";

/** Last call to sign up, then the page footer. */
export function LandingClosing({ t }: { t: Translate }) {
  return (
    <>
      <section className="px-4 pb-20">
        <div className="bg-festival relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-16 text-center text-white shadow-2xl shadow-pop-600/25 sm:px-12">
          <div aria-hidden="true" className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
          <div aria-hidden="true" className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-ink-900/30 blur-2xl" />
          <h2 className="relative text-4xl font-extrabold tracking-tight sm:text-5xl">{t("landing.closingTitle")}</h2>
          <p className="relative mt-3 text-lg text-white/90">{t("landing.closingText")}</p>
          <Link href="/signup" className="btn relative mt-8 bg-white px-8 py-3.5 text-base text-brand-700 shadow-lg hover:bg-brand-50">
            {t("landing.cta")}
          </Link>
        </div>
      </section>
      <footer className="border-t border-brand-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-10">
          <div className="max-w-sm">
            <BrandLogo />
            <p className="mt-3 text-sm text-ink-700">{t("landing.footerTagline")}</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link href="/login" className="btn-ghost btn-sm">{t("nav.signIn")}</Link>
            <Link href="/signup" className="btn-secondary btn-sm">{t("nav.signUp")}</Link>
          </nav>
        </div>
        <p className="border-t border-brand-50 py-5 text-center text-xs font-semibold text-ink-700/70">© {new Date().getFullYear()} Racik Digital</p>
      </footer>
    </>
  );
}
