import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale, Translate } from "@/lib/i18n/translate";

/** Organizer-branded header for public event and ticket pages. Sits on a dark background. */
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
    <header className="relative z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1" />
          ) : (
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 font-extrabold text-white">
              {orgName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate font-bold text-white">{orgName}</span>
        </div>
        <LanguageSwitcher locale={locale} label={t("lang.switch")} dark />
      </div>
    </header>
  );
}
