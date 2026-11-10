import type { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/session-proxy";

export async function proxy(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  // Only routes that use the logged-in session. Public event pages, tickets
  // and API webhooks skip the extra auth round-trip.
  matcher: ["/dashboard/:path*", "/checkin/:path*", "/admin/:path*", "/invite/:path*", "/login", "/signup", "/auth/:path*"],
};
