"use client";
import { useState } from "react";
import { PlusIcon } from "@/components/icons";
import type { Translate } from "@/lib/i18n/translate";
import type { FieldError } from "@/lib/registration-validation";

/**
 * Bagian "Daftarkan orang lain juga" di formulir publik: tombol tambah orang,
 * lalu satu kotak nama per orang. Semua orang memakai email pendaftar utama
 * dan masing-masing dapat tiket sendiri. Hanya tampil kalau acara mengizinkan
 * lebih dari 1 orang per pendaftaran.
 */
export function GuestNameFields({
  maxGroupSize,
  t,
  errors,
  idPrefix = "reg",
}: {
  maxGroupSize: number;
  t: Translate;
  errors: Record<string, FieldError>;
  idPrefix?: string;
}) {
  // Setiap kotak punya nomor tetap (key) supaya isian tidak tertukar saat ada yang dihapus.
  const [rows, setRows] = useState<number[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const maxGuests = maxGroupSize - 1;
  if (maxGuests < 1) return null;

  function addRow() {
    setRows((r) => [...r, nextKey]);
    setNextKey((k) => k + 1);
  }
  const err = (key: string) => (errors[key] ? t(errors[key].key, errors[key].vars) : null);

  return (
    <fieldset className="mt-5 space-y-3 rounded-2xl bg-brand-50/60 p-4 ring-1 ring-brand-100">
      <legend className="sr-only">{t("public.guestsTitle")}</legend>
      <div>
        <p className="font-bold">{t("public.guestsTitle")}</p>
        <p className="text-sm text-ink-700">{t("public.guestsHelp", { n: maxGuests })}</p>
      </div>
      {rows.map((key, index) => {
        const id = `${idPrefix}-guest-${key}`;
        const error = err(`guest_${index}`);
        return (
          <div key={key}>
            <label htmlFor={id} className="field-label">{t("public.guestName", { n: index + 2 })}</label>
            <div className="flex gap-2">
              <input
                id={id}
                name="guest_name"
                autoComplete="off"
                maxLength={120}
                className="input"
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => setRows((r) => r.filter((k) => k !== key))}>
                {t("public.guestRemove")}
              </button>
            </div>
            {error && <p id={`${id}-error`} className="field-error">{error}</p>}
          </div>
        );
      })}
      {err("guests") && <p className="field-error">{err("guests")}</p>}
      {rows.length < maxGuests && (
        <button type="button" className="btn-secondary btn-sm" onClick={addRow}>
          <PlusIcon size={15} /> {t("public.guestAdd")}
        </button>
      )}
    </fieldset>
  );
}
