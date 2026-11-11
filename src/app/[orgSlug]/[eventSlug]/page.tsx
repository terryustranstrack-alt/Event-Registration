import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEvent } from "@/lib/public-event-data";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { pickLocalized } from "@/lib/i18n/translate";
import { formatEventRange } from "@/lib/i18n/format";
import { renderSimpleRichText } from "@/lib/simple-rich-text";
import { getClosedReason, seatsLeft } from "@/lib/event-availability";
import { publicEnv } from "@/lib/env";
import { EventCountdown } from "@/components/event-countdown";
import { PublicRegistrationPanel } from "@/components/public-registration-panel";
import { PublicPageHeader } from "@/components/public-page-header";
import { BrandLogo } from "@/components/brand-logo";
import { CalendarIcon, MapPinIcon, TicketIcon, VideoIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[orgSlug]/[eventSlug]">): Promise<Metadata> {
  const { orgSlug, eventSlug } = await params;
  const result = await getPublicEvent(orgSlug, eventSlug);
  if (result.kind !== "ok") return { title: "Event", robots: { index: false } };
  const { locale } = await getServerTranslator();
  const title = pickLocalized(locale, result.event.title_en, result.event.title_id);
  const description = pickLocalized(locale, result.event.description_en, result.event.description_id).slice(0, 160);
  return {
    title,
    description,
    openGraph: { title, description, images: result.event.banner_url ? [result.event.banner_url] : undefined },
  };
}

/** Public, mobile-first event page (FR-4). */
export default async function PublicEventPage({ params }: PageProps<"/[orgSlug]/[eventSlug]">) {
  const { orgSlug, eventSlug } = await params;
  const result = await getPublicEvent(orgSlug, eventSlug);
  if (result.kind === "not_found") notFound();

  const { locale, t } = await getServerTranslator();
  if (result.kind === "unavailable") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <p className="card text-center text-lg font-semibold text-ink-700">{t("public.unavailable")}</p>
      </main>
    );
  }

  const { org, event, fields } = result;
  const title = pickLocalized(locale, event.title_en, event.title_id);
  const description = renderSimpleRichText(pickLocalized(locale, event.description_en, event.description_id));
  const venue = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const closedReason = getClosedReason(event);

  return (
    <>
      {/* Bagian atas: banner ditampilkan utuh (tidak terpotong, tidak digelapkan),
          lalu judul, tanggal, dan hitung mundur di bawahnya — bukan di atas gambar. */}
      <div className="relative overflow-hidden bg-ink-900 text-white">
        {!event.banner_url && <div aria-hidden="true" className="bg-festival absolute inset-0 opacity-90" />}
        <PublicPageHeader orgName={org.name} logoUrl={org.logo_url} locale={locale} t={t} />
        {event.banner_url && (
          <div className="relative mx-auto max-w-6xl px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.banner_url}
              alt={title}
              className="h-auto w-full rounded-3xl shadow-2xl shadow-black/40"
              fetchPriority="high"
            />
          </div>
        )}
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-8 lg:pb-36">
          <p className="eyebrow text-sun-400">{t("public.organizedBy", { org: org.name })}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{title}</h1>
          <ul className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
            <li className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 backdrop-blur">
              <CalendarIcon size={16} className="text-sun-400" />
              {formatEventRange(event.starts_at, event.ends_at, locale, event.timezone)}
            </li>
            {venue && (
              <li className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 backdrop-blur">
                <MapPinIcon size={16} className="text-sun-400" />
                {event.maps_url ? (
                  <a href={event.maps_url} target="_blank" rel="noreferrer" className="underline decoration-white/40 underline-offset-2 hover:decoration-white">{venue}</a>
                ) : (
                  venue
                )}
              </li>
            )}
            {event.has_online_link && (
              <li className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 backdrop-blur">
                <VideoIcon size={16} className="text-sun-400" /> {t("public.online")}
              </li>
            )}
          </ul>
          <div className="mt-8 flex flex-wrap items-end gap-6">
            <EventCountdown startsAt={event.starts_at} endsAt={event.ends_at} locale={locale} />
            {!closedReason && (
              <a href="#register" className="btn-primary px-6 py-3 text-base lg:hidden">
                <TicketIcon size={18} /> {t("public.registerNow")}
              </a>
            )}
          </div>
        </div>
      </div>

      <main className="relative mx-auto -mt-20 grid w-full max-w-6xl flex-1 gap-6 px-4 pb-16 lg:-mt-24 lg:grid-cols-[minmax(0,1fr)_420px]">
        <article className="card min-w-0 space-y-6 p-6 sm:p-8 lg:self-start">
          <h2 className="text-2xl font-extrabold tracking-tight">{t("public.about")}</h2>
          {/* Gambar kedua dari penyelenggara (mis. poster/rundown), ditampilkan utuh di atas deskripsi. */}
          {event.about_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.about_image_url} alt="" loading="lazy" className="h-auto w-full rounded-2xl ring-1 ring-brand-100" />
          )}
          {description && <div className="prose-event text-[17px] text-ink-800" dangerouslySetInnerHTML={{ __html: description }} />}
          {event.extra_links.length > 0 && (
            <section>
              <h3 className="mb-3 font-bold">{t("public.links")}</h3>
              <ul className="flex flex-wrap gap-2">
                {event.extra_links.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                      {pickLocalized(locale, link.label_en, link.label_id) || link.url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
        <div id="register" className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
          <PublicRegistrationPanel
            eventId={event.id}
            locale={locale}
            fields={fields}
            orgName={org.name}
            privacyUrl={org.privacy_policy_url}
            consentEnabled={event.consent_enabled}
            initial={{
              seatsLeft: seatsLeft(event),
              capacity: event.hide_capacity_total ? null : event.capacity,
              closedReason,
            }}
            opensAt={event.registration_opens_at}
            timezone={event.timezone}
            turnstileSiteKey={publicEnv.turnstileSiteKey}
            waitlistEnabled={event.waitlist_enabled}
          />
        </div>
      </main>
      <footer className="flex items-center justify-center gap-2 pb-10 text-xs font-semibold text-ink-700/70">
        {t("public.poweredBy")} <BrandLogo className="h-7" />
      </footer>
    </>
  );
}
