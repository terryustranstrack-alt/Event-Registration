import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { processEmailQueue } from "@/lib/messaging/email-queue-worker";

export const maxDuration = 60;

/** Safety net for the email queue (FR-7.2): retries and anything missed. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return new NextResponse("Unauthorized", { status: 401 });
  const results = await processEmailQueue({ limit: 50 });
  return NextResponse.json({ processed: results.length, sent: results.filter((r) => r.ok).length });
}
