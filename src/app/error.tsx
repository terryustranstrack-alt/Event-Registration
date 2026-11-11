"use client";
import Link from "next/link";
import { useEffect } from "react";
import { getTranslator } from "@/lib/i18n/translate";
import { usePageLocale } from "@/lib/i18n/use-page-locale";

/**
 * Layar "Terjadi kesalahan" untuk semua halaman. Menggantikan halaman error
 * polos bawaan dengan kartu bermerek + tombol coba lagi.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = getTranslator(usePageLocale());

  // Catat error-nya di konsol supaya tetap bisa dilacak; pengunjung hanya melihat pesan ramah.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div role="alert" className="card max-w-md text-center">
        <h1 className="text-2xl font-extrabold text-ink-900">{t("errorPage.title")}</h1>
        <p className="mt-2 text-ink-700">{t("errorPage.text")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="btn-primary">
            {t("errorPage.retry")}
          </button>
          <Link href="/" className="btn-secondary">{t("errorPage.home")}</Link>
        </div>
      </div>
    </main>
  );
}
