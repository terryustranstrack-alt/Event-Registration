import { NextResponse, type NextRequest } from "next/server";
import { isValidTicketCode } from "@/lib/ticket-codes";
import { serverEnv } from "@/lib/env";
import { qrCodePngBuffer } from "@/lib/qr-code-image";

/** QR PNG for emails. Encodes only the ticket code (FR-5.2). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/tickets/[ticketCode]/qr-code">) {
  const { ticketCode } = await ctx.params;
  if (!isValidTicketCode(ticketCode, serverEnv().ticketSigningSecret)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const png = await qrCodePngBuffer(ticketCode);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "private, max-age=31536000, immutable",
      "x-robots-tag": "noindex",
    },
  });
}
