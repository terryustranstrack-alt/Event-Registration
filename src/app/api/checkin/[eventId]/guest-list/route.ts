import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

/**
 * Guest list for the scanner's offline cache (FR-8.4). Staff see it
 * read-only through row-level security.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/checkin/[eventId]/guest-list">) {
  const { eventId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: event } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const guests: unknown[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("registrations")
      .select("ticket_code, full_name, email, status, checked_in_at")
      .eq("event_id", eventId)
      .order("created_at")
      .range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    guests.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return NextResponse.json({ guests, fetchedAt: new Date().toISOString() }, { headers: { "cache-control": "private, no-store" } });
}
