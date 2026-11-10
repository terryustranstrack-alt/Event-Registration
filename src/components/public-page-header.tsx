import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale, Translate } from "@/lib/i18n/translate";

export function PublicPageHeader({
  orgName,
  logoUrl,
  locale,
  t,
}: {
  orgName: string;
  logoUrl: string | null;
  locale: Locale;
  t: Translate;
}) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded object-contain" />
          )}
          <span className="truncate font-semibold text-zinc-900">{orgName}</span>
        </div>
        <LanguageSwitcher locale={locale} label={t("lang.switch")} />
      </div>
    </header>
  );
}
