import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n/server-locale";

/** Layar "Halaman tidak ditemukan" untuk alamat yang salah atau sudah dihapus. */
export default async function NotFoundPage() {
  const { t } = await getServerTranslator();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="card max-w-md text-center">
        <p className="eyebrow text-brand-700">404</p>
        <h1 className="mt-2 text-2xl font-extrabold text-ink-900">{t("notFoundPage.title")}</h1>
        <p className="mt-2 text-ink-700">{t("notFoundPage.text")}</p>
        <Link href="/" className="btn-primary mt-6">{t("errorPage.home")}</Link>
      </div>
    </main>
  );
}
