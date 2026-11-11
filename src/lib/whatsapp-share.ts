/** WhatsApp "send my ticket" link for the ticket page. */
export interface WhatsAppTicketInput {
  title: string;
  when: string;
  venue?: string;
  ticketUrl: string;
}

/** Builds the message text: event name, time, place (if any) and the web ticket link. */
export function whatsAppTicketMessage(input: WhatsAppTicketInput): string {
  const lines = [`🎟️ ${input.title}`, `🗓️ ${input.when}`];
  if (input.venue) lines.push(`📍 ${input.venue}`);
  lines.push("", input.ticketUrl);
  return lines.join("\n");
}

/**
 * wa.me without a phone number opens WhatsApp and lets the person pick who
 * to send it to (themselves, a friend, a group). Works on phone and desktop.
 */
export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
