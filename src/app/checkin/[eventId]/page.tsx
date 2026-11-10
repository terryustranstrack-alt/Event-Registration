import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { pickLocalized } from "@/lib/i18n/translate";
import { CheckInScannerLoader } from "@/components/check-in-scanner-loader";

export const metadata: Metadata = { title: "Check-in", robots: { index: false } };

/** Staff-only scanner (FR-8.1). Access = membership via row-level security. */
export default async function CheckInPage({ params }: PageProps<"/checkin/[eventId]">) {
  const { eventId } = await params;
  await requireUser(`/checkin/${eventId}`);
  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title_en, title_id, timezone, org:organizations(slug, name, default_language)")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) notFound();
  const org = event.org as unknown as { slug: string; name: string; default_language: "en" | "id" };
  const { locale } = await getServerTranslator(org.default_language);
  return (
    <CheckInScannerLoader
      eventId={event.id}
      eventTitle={pickLocalized(locale, event.title_en, event.title_id)}
      backHref={`/dashboard/${org.slug}/events/${event.id}/registrants`}
      locale={locale}
      timezone={event.timezone}
    />
  );
}
