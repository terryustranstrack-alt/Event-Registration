import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { extractTicketCode, isValidTicketCode } from "@/lib/ticket-codes";
import { serverEnv } from "@/lib/env";

const itemSchema = z.object({
  code: z.string().min(1).max(500),
  method: z.enum(["scan", "manual", "offline_sync"]).default("scan"),
  at: z.string().datetime().optional(),
});
const bodySchema = z.union([itemSchema, z.object({ items: z.array(itemSchema).max(500) })]);

export interface CheckInResult {
  code: string;
  result: "valid" | "already_checked_in" | "cancelled" | "wrong_event" | "not_found" | "invalid";
  fullName?: string | null;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
}

/** Check in one ticket, or sync a batch queued offline (FR-8.2, FR-8.4). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/checkin/[eventId]">) {
  const { eventId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const items = "items" in parsed.data ? parsed.data.items : [parsed.data];
  const secret = serverEnv().ticketSigningSecret;

  const results: CheckInResult[] = [];
  for (const item of items) {
    const code = extractTicketCode(item.code);
    if (!isValidTicketCode(code, secret)) {
      results.push({ code, result: "invalid" });
      continue;
    }
    const { data, error } = await supabase
      .rpc("check_in_ticket", { p_event_id: eventId, p_ticket_code: code, p_method: item.method, p_at: item.at ?? null })
      .single<{ result: CheckInResult["result"]; full_name: string | null; checked_in_at: string | null; checked_in_by_name: string | null }>();
    if (error) {
      if (error.code === "42501") return NextResponse.json({ error: "forbidden" }, { status: 403 });
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    results.push({
      code,
      result: data.result,
      fullName: data.full_name,
      checkedInAt: data.checked_in_at,
      checkedInBy: data.checked_in_by_name,
    });
  }
  return NextResponse.json({ results });
}
