import { NextResponse, type NextRequest } from "next/server";
import { getTicketByCode } from "@/lib/ticket-data";
import { buildIcsFile } from "@/lib/calendar-invite";
import { pickLocalized } from "@/lib/i18n/translate";
import { publicEnv } from "@/lib/env";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/tickets/[ticketCode]/calendar">) {
  const { ticketCode } = await ctx.params;
  const ticket = await getTicketByCode(ticketCode);
  if (!ticket) return new NextResponse("Not found", { status: 404 });
  const { event, registration } = ticket;
  const ics = buildIcsFile({
    uid: `${registration.id}@racik-eventmu`,
    title: pickLocalized(registration.language, event.title_en, event.title_id),
    location: event.online_url ?? ([event.venue_name, event.venue_address].filter(Boolean).join(", ") || undefined),
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    url: `${publicEnv.siteUrl}/t/${registration.ticket_code}`,
  });
  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${event.slug}.ics"`,
      "cache-control": "private, no-store",
    },
  });
}
