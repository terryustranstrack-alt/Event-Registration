import { getTranslator, type Locale } from "@/lib/i18n/translate";
import { formatEventRange } from "@/lib/i18n/format";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(orgName: string, orgLogoUrl: string | null, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e4e4e7">
${orgLogoUrl ? `<img src="${esc(orgLogoUrl)}" alt="${esc(orgName)}" height="40" style="height:40px;vertical-align:middle;margin-right:8px">` : ""}
<strong style="font-size:16px;vertical-align:middle">${esc(orgName)}</strong></td></tr>
<tr><td style="padding:24px">${body}</td></tr>
</table></td></tr></table></body></html>`;
}

export interface TicketEmailInput {
  locale: Locale;
  orgName: string;
  orgLogoUrl: string | null;
  registrantName: string;
  eventTitle: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venue: string | null;
  mapsUrl: string | null;
  onlineUrl: string | null;
  ticketUrl: string;
  qrImageUrl: string;
  ticketCode: string;
}

export function ticketEmail(input: TicketEmailInput) {
  const t = getTranslator(input.locale);
  const subject = `${t("ticket.title")}: ${input.eventTitle}`;
  const intro = `<h1 style="font-size:22px;margin:0 0 8px">${esc(t("ticket.thanks"))}</h1>
<p style="margin:0 0 16px">${esc(input.registrantName)}</p>`;
  return {
    subject,
    html: layout(input.orgName, input.orgLogoUrl, intro + ticketDetailsHtml(input)),
    text: [t("ticket.thanks"), input.registrantName, "", ticketDetailsText(input)].join("\n"),
  };
}

/**
 * Email pengingat sehari sebelum acara: isinya sama dengan tiket (jadwal,
 * lokasi, kode QR), hanya judul dan kalimat pembukanya yang berbeda.
 */
export function reminderEmail(input: TicketEmailInput) {
  const t = getTranslator(input.locale);
  const subject = t("reminder.subject", { title: input.eventTitle });
  const intro = `<h1 style="font-size:22px;margin:0 0 8px">${esc(t("reminder.heading"))}</h1>
<p style="margin:0 0 4px">${esc(input.registrantName)}</p>
<p style="margin:0 0 16px;color:#52525b">${esc(t("reminder.text"))}</p>`;
  return {
    subject,
    html: layout(input.orgName, input.orgLogoUrl, intro + ticketDetailsHtml(input)),
    text: [t("reminder.heading"), input.registrantName, t("reminder.text"), "", ticketDetailsText(input)].join("\n"),
  };
}

// Bagian detail tiket (acara, jadwal, lokasi, QR, tombol) yang dipakai bersama
// oleh email tiket dan email pengingat.
function ticketDetailsHtml(input: TicketEmailInput): string {
  const t = getTranslator(input.locale);
  const when = formatEventRange(input.startsAt, input.endsAt, input.locale, input.timezone);
  return `<h2 style="font-size:18px;margin:0 0 4px">${esc(input.eventTitle)}</h2>
<p style="margin:0 0 4px">📅 ${esc(when)}</p>
${input.venue ? `<p style="margin:0 0 4px">📍 ${esc(input.venue)}${input.mapsUrl ? ` — <a href="${esc(input.mapsUrl)}">Maps</a>` : ""}</p>` : ""}
${input.onlineUrl ? `<p style="margin:0 0 4px">💻 <a href="${esc(input.onlineUrl)}">${esc(t("ticket.joinOnline"))}</a></p>` : ""}
<div style="text-align:center;margin:24px 0">
<img src="${esc(input.qrImageUrl)}" alt="QR" width="240" height="240" style="width:240px;height:240px">
<p style="font-size:13px;color:#52525b;margin:8px 0 0">${esc(t("ticket.show"))}</p>
<p style="font-family:monospace;font-size:11px;color:#71717a;word-break:break-all">${esc(input.ticketCode)}</p>
</div>
<p style="text-align:center"><a href="${esc(input.ticketUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${esc(t("ticket.open"))}</a></p>`;
}

// Versi teks biasa dari detail tiket, untuk aplikasi email yang tidak menampilkan HTML.
function ticketDetailsText(input: TicketEmailInput): string {
  const t = getTranslator(input.locale);
  const when = formatEventRange(input.startsAt, input.endsAt, input.locale, input.timezone);
  return [
    input.eventTitle,
    when,
    input.venue ?? "",
    input.onlineUrl ? `${t("ticket.joinOnline")}: ${input.onlineUrl}` : "",
    "",
    `${t("ticket.open")}: ${input.ticketUrl}`,
    `${t("ticket.code")}: ${input.ticketCode}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function invitationEmail(input: {
  locale: Locale;
  orgName: string;
  orgLogoUrl: string | null;
  roleLabel: string;
  acceptUrl: string;
}) {
  const t = getTranslator(input.locale);
  const subject = `${t("invite.title")}: ${input.orgName}`;
  const html = layout(
    input.orgName,
    input.orgLogoUrl,
    `<h1 style="font-size:22px;margin:0 0 8px">${esc(t("invite.title"))}</h1>
<p>${esc(input.orgName)} — ${esc(input.roleLabel)}</p>
<p><a href="${esc(input.acceptUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${esc(t("invite.accept"))}</a></p>`,
  );
  return { subject, html, text: `${t("invite.title")}: ${input.orgName} (${input.roleLabel})\n${input.acceptUrl}` };
}
