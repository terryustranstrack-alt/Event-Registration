import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getGroupTickets, getTicketByCode } from "@/lib/ticket-data";
import { getTranslator, isLocale, LOCALE_COOKIE, pickLocalized } from "@/lib/i18n/translate";
import { formatDateTime, formatEventRange } from "@/lib/i18n/format";
import { qrCodeSvg } from "@/lib/qr-code-image";
import { googleCalendarUrl } from "@/lib/calendar-invite";
import { whatsAppShareUrl, whatsAppTicketMessage } from "@/lib/whatsapp-share";
import { publicEnv } from "@/lib/env";
import { PublicPageHeader } from "@/components/public-page-header";
import { ArrowLeftIcon, CalendarIcon, CheckIcon, MapPinIcon, VideoIcon } from "@/components/icons";

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
  // Di daftar tunggu: belum punya kursi, jadi QR dan tombol-tombol tiket belum ditampilkan.
  const waitlisted = registration.status === "waitlisted";
  const hasValidTicket = !cancelled && !waitlisted;
  const qrSvg = hasValidTicket ? await qrCodeSvg(registration.ticket_code) : "";
  const groupTickets = await getGroupTickets(registration);
  const ticketUrl = `${publicEnv.siteUrl}/t/${registration.ticket_code}`;
  const calendarInput = {
    uid: registration.id,
    title,
    location: event.online_url ?? (venue || undefined),
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    url: ticketUrl,
  };
  // Pesan WhatsApp berisi info acara + link tiket web, supaya tiket gampang dibuka lagi dari chat.
  const whatsAppUrl = whatsAppShareUrl(
    whatsAppTicketMessage({
      title,
      when: formatEventRange(event.starts_at, event.ends_at, locale, event.timezone),
      venue: venue || undefined,
      ticketUrl,
    }),
  );

  return (
    <div className="bg-festival relative flex min-h-full flex-1 flex-col">
      <div aria-hidden="true" className="absolute inset-0 bg-ink-900/55" />
      <PublicPageHeader orgName={org.name} logoUrl={org.logo_url} locale={locale} t={t} />
      <main className="relative mx-auto w-full max-w-md flex-1 px-4 pb-12 pt-4">
        {isNew === "1" && hasValidTicket && (
          <div role="status" className="mb-5 rounded-2xl bg-white/15 p-4 text-white ring-1 ring-white/25 backdrop-blur">
            <p className="text-xl font-extrabold">🎉 {t("ticket.thanks")}</p>
            <p className="text-sm text-white/90">{t("ticket.emailSent", { email: registration.email })}</p>
          </div>
        )}

        {/* The ticket: colored top, perforated tear line, QR stub. */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/40">
          <div className="bg-festival px-6 pb-6 pt-5 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">{t("ticket.title")}</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight">{title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white/90">
              <CalendarIcon size={16} /> {formatEventRange(event.starts_at, event.ends_at, locale, event.timezone)}
            </p>
            {venue && (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-white/90">
                <MapPinIcon size={16} />
                {event.maps_url ? (
                  <a href={event.maps_url} className="underline decoration-white/50" target="_blank" rel="noreferrer">{venue}</a>
                ) : (
                  venue
                )}
              </p>
            )}
          </div>
          <div className="relative border-t-2 border-dashed border-brand-100">
            <span aria-hidden="true" className="absolute -left-4 -top-4 h-8 w-8 rounded-full bg-ink-800" />
            <span aria-hidden="true" className="absolute -right-4 -top-4 h-8 w-8 rounded-full bg-ink-800" />
          </div>
          <div className="space-y-5 p-6">
            {waitlisted ? (
              <div role="status" className="rounded-xl bg-amber-50 p-4 text-center text-amber-900">
                <p className="text-lg font-extrabold">{t("ticket.waitlistedTitle")}</p>
                <p className="mt-1 text-sm">{t("ticket.waitlistedText", { email: registration.email })}</p>
              </div>
            ) : cancelled ? (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-center font-bold text-red-800">{t("ticket.cancelled")}</p>
            ) : (
              <figure className="text-center">
                <div
                  className="mx-auto w-60 max-w-full rounded-2xl p-2 ring-2 ring-brand-100 [&>svg]:h-auto [&>svg]:w-full"
                  role="img"
                  aria-label={`QR ${t("ticket.code")}`}
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <figcaption className="mt-3 text-sm font-semibold text-ink-700">{t("ticket.show")}</figcaption>
              </figure>
            )}
            {registration.checked_in_at && (
              <p className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 p-2.5 text-sm font-bold text-emerald-800">
                <CheckIcon size={16} /> {t("ticket.checkedIn", { time: formatDateTime(registration.checked_in_at, locale, event.timezone) })}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wider text-ink-700/60">{t("ticket.name")}</dt>
                <dd className="text-lg font-extrabold">{registration.full_name}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wider text-ink-700/60">{t("ticket.code")}</dt>
                <dd className="break-all font-mono text-xs text-ink-700">{registration.ticket_code}</dd>
              </div>
            </dl>
            {hasValidTicket && (
              <div className="flex flex-col gap-2">
                {event.online_url && (
                  <a href={event.online_url} target="_blank" rel="noreferrer" className="btn-primary py-3">
                    <VideoIcon size={18} /> {t("ticket.joinOnline")}
                  </a>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <a href={`/api/tickets/${registration.ticket_code}/calendar`} className="btn-secondary">
                    <CalendarIcon size={16} /> .ics
                  </a>
                  <a href={googleCalendarUrl(calendarInput)} target="_blank" rel="noreferrer" className="btn-secondary">Google Calendar</a>
                </div>
                <a href={whatsAppUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                  {t("ticket.whatsapp")}
                </a>
              </div>
            )}
          </div>
        </div>
        {/* Rombongan: link ke tiket orang-orang lain yang didaftarkan bersama (satu email). */}
        {groupTickets.length > 0 && (
          <section className="mt-5 rounded-2xl bg-white/15 p-4 text-white ring-1 ring-white/25 backdrop-blur">
            <h2 className="font-extrabold">{t("ticket.groupTitle", { n: groupTickets.length + 1 })}</h2>
            <ul className="mt-2 space-y-1.5">
              {groupTickets.map((g) => (
                <li key={g.ticket_code}>
                  <a href={`/t/${g.ticket_code}`} className="flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2 font-semibold hover:bg-white/20">
                    <span className="truncate">{g.full_name}</span>
                    <span className="shrink-0 text-sm underline">{g.status === "registered" ? t("ticket.groupOpen") : t(`reg.status.${g.status as "cancelled" | "waitlisted"}`)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-6 text-center text-sm">
          <a href={`/${org.slug}/${event.slug}`} className="inline-flex items-center gap-1.5 font-semibold text-white/90 underline decoration-white/40 hover:text-white">
            <ArrowLeftIcon size={15} /> {title}
          </a>
        </p>
      </main>
    </div>
  );
}
