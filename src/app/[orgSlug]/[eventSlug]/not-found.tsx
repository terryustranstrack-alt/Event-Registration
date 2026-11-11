import { getServerTranslator } from "@/lib/i18n/server-locale";

export default async function EventNotFound() {
  const { t } = await getServerTranslator();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <p className="card text-center text-lg font-medium text-ink-700">{t("public.notFound")}</p>
    </main>
  );
}
