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

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[orgSlug]/[eventSlug]">): Promise<Metadata> {
  const { orgSlug, eventSlug } = await params;
  const result = await getPublicEvent(orgSlug, eventSlug);
  if (result.kind !== "ok") return { title: "Event", robots: { index: false } };
  const { locale } = await getServerTranslator(result.org.default_language);
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

  const { locale, t } = await getServerTranslator(result.org.default_language);
  if (result.kind === "unavailable") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <p className="card text-center text-lg font-medium text-zinc-700">{t("public.unavailable")}</p>
      </main>
    );
  }

  const { org, event, fields } = result;
  const title = pickLocalized(locale, event.title_en, event.title_id);
  const description = renderSimpleRichText(pickLocalized(locale, event.description_en, event.description_id));
  const venue = [event.venue_name, event.venue_address].filter(Boolean).join(", ");

  return (
    <>
      <PublicPageHeader orgName={org.name} logoUrl={org.logo_url} locale={locale} t={t} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        {event.banner_url && (
          <div className="-mx-4 aspect-video overflow-hidden bg-zinc-200 sm:mx-0 sm:mt-6 sm:rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.banner_url} alt="" className="h-full w-full object-cover" fetchPriority="high" />
          </div>
        )}
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <article className="min-w-0 space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
              <p className="mt-1 text-sm text-zinc-600">{t("public.organizedBy", { org: org.name })}</p>
            </div>
            <dl className="space-y-2 text-zinc-800">
              <div className="flex gap-2">
                <dt aria-label={t("event.startsAt")}>📅</dt>
                <dd>{formatEventRange(event.starts_at, event.ends_at, locale, event.timezone)}</dd>
              </div>
              {venue && (
                <div className="flex gap-2">
                  <dt aria-label={t("event.venueName")}>📍</dt>
                  <dd>
                    {venue}
                    {event.maps_url && (
                      <>
                        {" · "}
                        <a href={event.maps_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">Maps</a>
                      </>
                    )}
                  </dd>
                </div>
              )}
              {event.has_online_link && (
                <div className="flex gap-2">
                  <dt aria-hidden="true">💻</dt>
                  <dd>{t("public.online")}</dd>
                </div>
              )}
            </dl>
            <EventCountdown startsAt={event.starts_at} endsAt={event.ends_at} locale={locale} />
            {description && <div className="prose-event text-zinc-800" dangerouslySetInnerHTML={{ __html: description }} />}
            {event.extra_links.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold">{t("public.links")}</h2>
                <ul className="space-y-1">
                  {event.extra_links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                        {pickLocalized(locale, link.label_en, link.label_id) || link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
          <div className="lg:sticky lg:top-6 lg:self-start">
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
                closedReason: getClosedReason(event),
              }}
              opensAt={event.registration_opens_at}
              timezone={event.timezone}
              turnstileSiteKey={publicEnv.turnstileSiteKey}
            />
          </div>
        </div>
      </main>
    </>
  );
}
