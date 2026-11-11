import { describe, expect, it } from "vitest";
import { whatsAppShareUrl, whatsAppTicketMessage } from "./whatsapp-share";

describe("whatsAppTicketMessage", () => {
  it("includes title, time, venue and ticket link", () => {
    const text = whatsAppTicketMessage({
      title: "Tech Meetup",
      when: "Sat, 12 Dec 2026, 09:00",
      venue: "Hall A, Jakarta",
      ticketUrl: "https://example.com/t/ABC",
    });
    expect(text).toBe("🎟️ Tech Meetup\n🗓️ Sat, 12 Dec 2026, 09:00\n📍 Hall A, Jakarta\n\nhttps://example.com/t/ABC");
  });

  it("skips the venue line for online events", () => {
    const text = whatsAppTicketMessage({ title: "Webinar", when: "Today", ticketUrl: "https://example.com/t/X" });
    expect(text).not.toContain("📍");
  });
});

describe("whatsAppShareUrl", () => {
  it("encodes the message for wa.me", () => {
    expect(whatsAppShareUrl("a b\n&c")).toBe("https://wa.me/?text=a%20b%0A%26c");
  });
});
