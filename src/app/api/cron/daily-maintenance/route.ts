import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";

/** Daily: anonymize registrant data past the retention window (NFR Privacy). */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return new NextResponse("Unauthorized", { status: 401 });
  const db = createSupabaseServiceRoleClient();
  const { data: anonymized, error } = await db.rpc("anonymize_expired_registrations");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ anonymized });
}
