import { getServerTranslator } from "@/lib/i18n/server-locale";

/**
 * Tanda "sedang memuat" untuk halaman dasbor penyelenggara, supaya layar
 * tidak terlihat macet saat data acara masih diambil.
 * Sengaja hanya di dasbor: halaman acara publik tetap tampil langsung utuh.
 */
export default async function DashboardLoading() {
  const { t } = await getServerTranslator();
  return (
    <div role="status" className="flex flex-1 items-center justify-center gap-3 px-4 py-20 text-ink-700">
      <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" />
      <span className="font-medium">{t("loading.label")}</span>
    </div>
  );
}
