"use client";
import { useEffect } from "react";
import { getTranslator } from "@/lib/i18n/translate";
import "./globals.css";

const en = getTranslator("en");
const id = getTranslator("id");

/**
 * Cadangan terakhir: dipakai kalau kerangka utama situs sendiri yang rusak.
 * Di titik ini bahasa pengunjung tidak bisa diketahui, jadi pesan ditampilkan
 * dalam dua bahasa sekaligus.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  // Catat error-nya di konsol supaya tetap bisa dilacak.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-4 py-20">
        <title>{`${en("errorPage.title")} · Racik EventMu`}</title>
        <div role="alert" className="card max-w-md text-center">
          <h1 className="text-2xl font-extrabold text-ink-900">{en("errorPage.title")}</h1>
          <p className="mt-2 text-ink-700">{en("errorPage.text")}</p>
          <p lang="id" className="mt-4 text-ink-700">
            <strong>{id("errorPage.title")}.</strong> {id("errorPage.text")}
          </p>
          <button type="button" onClick={() => retry()} className="btn-primary mt-6">
            {en("errorPage.retry")} / {id("errorPage.retry")}
          </button>
        </div>
      </body>
    </html>
  );
}
