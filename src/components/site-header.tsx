import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { getCurrentUser } from "@/lib/auth-guards";

export async function SiteHeader() {
  const { locale, t } = await getServerTranslator();
  const user = await getCurrentUser().catch(() => null);
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-700">
          {t("app.name")}
        </Link>
        <nav className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} label={t("lang.switch")} />
          {user ? (
            <Link href="/dashboard" className="btn-secondary btn-sm">
              {t("nav.dashboard")}
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-secondary btn-sm">
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
