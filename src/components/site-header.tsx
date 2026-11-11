import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { getCurrentUser } from "@/lib/auth-guards";

/** Top bar for public pages (landing, sign-in, ticket helpers). */
export async function SiteHeader() {
  const { locale, t } = await getServerTranslator();
  const user = await getCurrentUser().catch(() => null);
  return (
    <header className="sticky top-0 z-30 border-b border-brand-100/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <BrandLogo />
        <nav className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} label={t("lang.switch")} />
          {user ? (
            <Link href="/dashboard" className="btn-primary btn-sm">
              {t("nav.dashboard")}
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost btn-sm">
                {t("nav.signIn")}
              </Link>
              <Link href="/signup" className="btn-primary btn-sm hidden sm:inline-flex">
                {t("nav.signUp")}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
