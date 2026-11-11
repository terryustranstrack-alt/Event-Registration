/**
 * Cek isi asli file unggahan (bukan hanya jenis yang dilaporkan browser).
 *
 * Browser cukup menebak jenis file dari namanya, jadi file berbahaya yang
 * diganti nama jadi "foto.jpg" tetap akan dilaporkan sebagai JPG. Setiap
 * jenis file punya beberapa byte "tanda pengenal" di awal isinya — itu yang
 * kita periksa di sini.
 */

// Tanda pengenal di awal isi file untuk tiap jenis yang diizinkan (PDF, JPG, PNG).
const SIGNATURES: { type: string; bytes: number[] }[] = [
  { type: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

// Cukup baca sedikit byte pertama; tanda pengenal terpanjang hanya 8 byte.
const HEADER_LENGTH = 8;

/** Tebak jenis file dari byte awalnya. Hasil `null` = bukan PDF/JPG/PNG. */
export function detectUploadType(header: Uint8Array): string | null {
  const match = SIGNATURES.find(({ bytes }) => bytes.every((byte, i) => header[i] === byte));
  return match?.type ?? null;
}

/** Baca byte awal file unggahan. */
async function readFileHeader(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, HEADER_LENGTH).arrayBuffer());
}

/**
 * Benar kalau isi file memang sesuai jenis yang diakui (mis. file yang
 * mengaku PDF benar-benar berisi PDF).
 */
export async function fileContentMatchesType(file: Blob): Promise<boolean> {
  return detectUploadType(await readFileHeader(file)) === file.type;
}
