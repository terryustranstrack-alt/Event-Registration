import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTicketByCode } from "@/lib/ticket-data";
import { getTranslator, isLocale, LOCALE_COOKIE, pickLocalized } from "@/lib/i18n/translate";
import { formatDateTime, formatEventRange } from "@/lib/i18n/format";
import { qrCodeSvg } from "@/lib/qr-code-image";
import { googleCalendarUrl } from "@/lib/calendar-invite";
import { publicEnv } from "@/lib/env";
import { PublicPageHeader } from "@/components/public-page-header";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket", robots: { index: false, follow: false } };

/** Thank-you page and web ticket (FR-5.4). */
export default async function TicketPage({ params, searchParams }: PageProps<"/t/[ticketCode]">) {
  const { ticketCode } = await params;
  const { new: isNew } = await searchParams;
  const ticket = await getTicketByCode(ticketCode);
  if (!ticket || ticket.org.status !== "active") notFound();

  const { registration, event, org } = ticket;
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : registration.language;
  const t = getTranslator(locale);
  const title = pickLocalized(locale, event.title_en, event.title_id);
  const venue = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const cancelled = registration.status === "cancelled";
  const qrSvg = cancelled ? "" : await qrCodeSvg(registration.ticket_code);
  const ticketUrl = `${publicEnv.siteUrl}/t/${registration.ticket_code}`;
  const calendarInput = {
    uid: registration.id,
    title,
    location: event.online_url ?? (venue || undefined),
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    url: ticketUrl,
  };

  return (
    <>
      <PublicPageHeader orgName={org.name} logoUrl={org.logo_url} locale={locale} t={t} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        {isNew === "1" && !cancelled && (
          <div role="status" className="mb-6 rounded-xl bg-green-50 p-4 text-green-900">
            <p className="text-lg font-bold">🎉 {t("ticket.thanks")}</p>
            <p className="text-sm">{t("ticket.emailSent", { email: registration.email })}</p>
          </div>
        )}
        <div className="card overflow-hidden p-0">
          <div className="bg-zinc-900 px-5 py-4 text-white">
            <p className="text-xs uppercase tracking-wide text-zinc-300">{t("ticket.title")}</p>
            <h1 className="text-xl font-bold">{title}</h1>
          </div>
          <div className="space-y-4 p-5">
            {cancelled ? (
              <p role="alert" className="rounded-lg bg-red-50 p-4 text-center font-semibold text-red-800">{t("ticket.cancelled")}</p>
            ) : (
              <figure className="text-center">
                <div
                  className="mx-auto w-64 max-w-full [&>svg]:h-auto [&>svg]:w-full"
                  role="img"
                  aria-label={`QR ${t("ticket.code")}`}
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <figcaption className="mt-2 text-sm text-zinc-600">{t("ticket.show")}</figcaption>
              </figure>
            )}
            {registration.checked_in_at && (
              <p className="rounded-lg bg-green-50 p-2 text-center text-sm font-medium text-green-800">
                ✓ {t("ticket.checkedIn", { time: formatDateTime(registration.checked_in_at, locale, event.timezone) })}
              </p>
            )}
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-zinc-500">{t("ticket.name")}</dt>
                <dd className="font-semibold">{registration.full_name}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">{t("event.startsAt")}</dt>
                <dd>{formatEventRange(event.starts_at, event.ends_at, locale, event.timezone)}</dd>
              </div>
              {venue && (
                <div>
                  <dt className="text-zinc-500">{t("event.venueName")}</dt>
                  <dd>
                    {venue}
                    {event.maps_url && (
                      <> · <a href={event.maps_url} className="text-brand-700 underline" target="_blank" rel="noreferrer">Maps</a></>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-zinc-500">{t("ticket.code")}</dt>
                <dd className="break-all font-mono text-xs">{registration.ticket_code}</dd>
              </div>
            </dl>
            {!cancelled && (
              <div className="flex flex-col gap-2">
                {event.online_url && (
                  <a href={event.online_url} target="_blank" rel="noreferrer" className="btn-primary">💻 {t("ticket.joinOnline")}</a>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <a href={`/api/tickets/${registration.ticket_code}/calendar`} className="btn-secondary">📅 .ics</a>
                  <a href={googleCalendarUrl(calendarInput)} target="_blank" rel="noreferrer" className="btn-secondary">Google Calendar</a>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-sm">
          <a href={`/${org.slug}/${event.slug}`} className="text-brand-700 underline">← {title}</a>
        </p>
      </main>
    </>
  );
}
