import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingSteps } from "@/components/landing/landing-steps";
import { LandingShowcase } from "@/components/landing/landing-showcase";
import { LandingLocal } from "@/components/landing/landing-local";
import { LandingUseCases } from "@/components/landing/landing-use-cases";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingClosing } from "@/components/landing/landing-closing";
import { getServerTranslator } from "@/lib/i18n/server-locale";

/** Front page. Each section lives in its own file under components/landing. */
export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const { error_code: errorCode } = await searchParams;
  const { t } = await getServerTranslator();
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Supabase sends expired sign-up links here with error_code in the address. */}
        {typeof errorCode === "string" && (
          <p role="alert" className="mx-auto mt-6 max-w-6xl rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
            {t("auth.linkExpired")}{" "}
            <Link href="/login" className="font-bold underline">{t("nav.signIn")}</Link>
          </p>
        )}
        <LandingHero t={t} />
        <LandingSteps t={t} />
        <LandingShowcase t={t} />
        <LandingLocal t={t} />
        <LandingUseCases t={t} />
        <LandingFaq t={t} />
        <LandingClosing t={t} />
      </main>
    </>
  );
}
