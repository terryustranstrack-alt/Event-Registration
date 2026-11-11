"use client";
import { useSyncExternalStore } from "react";
import { isLocale, type Locale } from "./translate";

// Bahasa halaman tidak pernah berubah selama layar error tampil, jadi tidak
// perlu "mendengarkan" perubahan apa pun.
function subscribeNothing() {
  return () => {};
}

// Ambil bahasa dari tag <html lang="..."> yang sudah diisi oleh layout utama.
function readHtmlLang(): Locale {
  const lang = document.documentElement.lang;
  return isLocale(lang) ? lang : "en";
}

// Saat dibuat di server belum ada halaman untuk dibaca, jadi pakai bahasa bawaan (Inggris).
function serverLocale(): Locale {
  return "en";
}

/**
 * Bahasa yang sedang dipakai halaman, untuk komponen di browser yang tidak
 * bisa membaca cookie bahasa di server (mis. layar error).
 */
export function usePageLocale(): Locale {
  return useSyncExternalStore(subscribeNothing, readHtmlLang, serverLocale);
}
