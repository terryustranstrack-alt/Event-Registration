import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import type { DictionaryKey } from "@/lib/i18n/dictionary-en";

export const metadata: Metadata = { title: "Privacy Policy" };

// Alamat email untuk pertanyaan soal data pribadi (juga diminta Google untuk login Google).
const PRIVACY_CONTACT_EMAIL = "racikdigital@gmail.com";

// Urutan bagian kebijakan privasi: judul + isi, teksnya ada di kamus EN/ID.
const SECTIONS: { title: DictionaryKey; text: DictionaryKey }[] = [
  { title: "privacy.collectTitle", text: "privacy.collectText" },
  { title: "privacy.useTitle", text: "privacy.useText" },
  { title: "privacy.googleTitle", text: "privacy.googleText" },
  { title: "privacy.shareTitle", text: "privacy.shareText" },
  { title: "privacy.securityTitle", text: "privacy.securityText" },
  { title: "privacy.keepTitle", text: "privacy.keepText" },
  { title: "privacy.rightsTitle", text: "privacy.rightsText" },
  { title: "privacy.contactTitle", text: "privacy.contactText" },
];

/** Halaman Kebijakan Privasi publik (wajib ada untuk login dengan Google). */
export default async function PrivacyPage() {
  const { t } = await getServerTranslator();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("privacy.title")}</h1>
        <p className="mt-2 text-sm font-semibold text-ink-700/70">{t("privacy.updated")}</p>
        <p className="mt-6 text-ink-700">{t("privacy.intro")}</p>
        {SECTIONS.map((section) => (
          <section key={section.title} className="mt-8">
            <h2 className="text-xl font-extrabold">{t(section.title)}</h2>
            <p className="mt-2 whitespace-pre-line text-ink-700">{t(section.text, { email: PRIVACY_CONTACT_EMAIL })}</p>
          </section>
        ))}
      </main>
    </>
  );
}
