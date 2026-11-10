import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { getClosedReason, seatsLeft } from "@/lib/event-availability";

/** Live seats-left for the public page (FR-4.3), polled every few seconds. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/events/[eventId]/availability">) {
  const { eventId } = await ctx.params;
  const supabase = createSupabaseServiceRoleClient();
  const { data: event } = await supabase
    .from("events")
    .select("status, capacity, seats_taken, hide_capacity_total, registration_opens_at, registration_closes_at, ends_at, org:organizations(status)")
    .eq("id", eventId)
    .in("status", ["published", "closed"])
    .maybeSingle();
  if (!event || (event.org as unknown as { status: string })?.status !== "active") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      seatsLeft: seatsLeft(event),
      capacity: event.hide_capacity_total ? null : event.capacity,
      closedReason: getClosedReason(event),
    },
    { headers: { "cache-control": "public, max-age=3, s-maxage=3, stale-while-revalidate=10" } },
  );
}
