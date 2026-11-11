import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { CheckIcon } from "@/components/icons";
import { getServerTranslator } from "@/lib/i18n/server-locale";

/** Sign-in / sign-up: form on the left, colorful brand panel on the right (desktop). */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { locale, t } = await getServerTranslator();
  const points = ["landing.f1", "landing.f2", "landing.f3"] as const;
  return (
    <div className="grid min-h-full flex-1 lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <BrandLogo />
          <LanguageSwitcher locale={locale} label={t("lang.switch")} />
        </div>
        <main className="flex flex-1 items-center justify-center py-10">{children}</main>
      </div>
      <aside className="bg-festival relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="absolute bottom-24 -left-16 h-64 w-64 rounded-full bg-ink-900/25 blur-2xl" />
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">{t("auth.panelTitle")}</h2>
          <p className="mt-3 max-w-md text-lg text-white/90">{t("auth.panelText")}</p>
          <ul className="mt-8 space-y-3">
            {points.map((key) => (
              <li key={key} className="flex items-start gap-3 font-semibold">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20"><CheckIcon size={14} /></span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
