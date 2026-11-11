"use client";
import { useState } from "react";

/**
 * Kotak pilih gambar di editor acara: klik untuk memilih file, langsung
 * tampil pratinjaunya, plus kotak centang "hapus" kalau sudah ada gambar.
 * Dipakai untuk banner dan gambar di bagian "Tentang acara ini".
 */
export function EventImagePicker({
  name,
  removeName,
  label,
  help,
  chooseLabel,
  deleteLabel,
  initialUrl,
}: {
  name: string;
  removeName: string;
  label: string;
  help: string;
  chooseLabel: string;
  deleteLabel: string;
  initialUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(initialUrl);
  return (
    <div>
      <span className="field-label">{label}</span>
      <label
        htmlFor={name}
        className="bg-festival group relative flex aspect-video w-full max-w-md cursor-pointer items-center justify-center overflow-hidden rounded-2xl text-white"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span className="relative rounded-xl bg-black/35 px-4 py-2 text-sm font-bold backdrop-blur group-hover:bg-black/50">
          {chooseLabel}
        </span>
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-describedby={`${name}-help`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setPreview(URL.createObjectURL(file));
        }}
      />
      <p id={`${name}-help`} className="field-help">{help}</p>
      {initialUrl && (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name={removeName} /> {deleteLabel}
        </label>
      )}
    </div>
  );
}
