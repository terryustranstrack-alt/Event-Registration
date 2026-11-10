import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getServerTranslator } from "@/lib/i18n/server-locale";

export default async function LandingPage() {
  const { t } = await getServerTranslator();
  const features = ["landing.f1", "landing.f2", "landing.f3", "landing.f4"] as const;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">{t("app.name")}</h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-700">{t("app.tagline")}</p>
        <Link href="/signup" className="btn-primary mt-8">
          {t("landing.cta")}
        </Link>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {features.map((key) => (
            <li key={key} className="card text-zinc-800">
              ✓ {t(key)}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
