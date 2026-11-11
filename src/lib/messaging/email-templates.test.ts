import { describe, expect, it } from "vitest";
import { reminderEmail, ticketEmail, type TicketEmailInput } from "./email-templates";

const base: TicketEmailInput = {
  locale: "en",
  orgName: "Racik Digital",
  orgLogoUrl: null,
  registrantName: "Budi <Santoso>",
  eventTitle: "Tech Meetup",
  startsAt: "2026-12-01T10:00:00Z",
  endsAt: "2026-12-01T12:00:00Z",
  timezone: "Asia/Jakarta",
  venue: "Jakarta",
  mapsUrl: null,
  onlineUrl: null,
  ticketUrl: "https://example.com/t/abc",
  qrImageUrl: "https://example.com/api/tickets/abc/qr-code",
  ticketCode: "abc",
};

describe("reminderEmail", () => {
  it("uses a reminder subject in the registrant's language", () => {
    expect(reminderEmail(base).subject).toBe("Reminder: Tech Meetup");
    expect(reminderEmail({ ...base, locale: "id" }).subject).toBe("Pengingat: Tech Meetup");
  });

  it("includes the QR code and the ticket link, like the ticket email", () => {
    const { html, text } = reminderEmail(base);
    expect(html).toContain(base.qrImageUrl);
    expect(html).toContain(base.ticketUrl);
    expect(text).toContain(base.ticketUrl);
  });

  it("escapes names so they can't inject HTML", () => {
    expect(reminderEmail(base).html).toContain("Budi &lt;Santoso&gt;");
  });
});

describe("ticketEmail", () => {
  it("still sends the ticket subject and QR code", () => {
    const { subject, html } = ticketEmail(base);
    expect(subject).toBe("Your ticket: Tech Meetup");
    expect(html).toContain(base.qrImageUrl);
  });

  it("includes a Send ticket to WhatsApp link with the ticket address", () => {
    const { html, text } = ticketEmail(base);
    expect(html).toContain("https://wa.me/?text=");
    expect(html).toContain(encodeURIComponent(base.ticketUrl));
    expect(text).toContain("Send ticket to WhatsApp");
  });
});
