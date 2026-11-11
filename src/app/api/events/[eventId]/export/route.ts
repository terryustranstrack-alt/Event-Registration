import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { buildRegistrantTable, toCsv } from "@/lib/registrant-export";
import type { FormField, Registration } from "@/lib/domain-types";
import type { Locale } from "@/lib/i18n/translate";

/** CSV / Excel export of registrants and all answers (FR-9.4, US-12). Admins only. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/events/[eventId]/export">) {
  const { eventId } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: event } = await supabase
    .from("events")
    .select("id, slug, org_id, org:organizations(default_language)")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return new NextResponse("Not found", { status: 404 });
  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: event.org_id });
  if (!isAdmin) return new NextResponse("Forbidden", { status: 403 });

  const { data: fields } = await supabase.from("form_fields").select("*").eq("event_id", eventId).order("archived_at", { nullsFirst: true }).order("position");
  const registrations: Registration[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("registrations")
      .select("full_name, email, language, status, created_at, checked_in_at, ticket_code, answers, consent_at")
      .eq("event_id", eventId)
      .order("created_at")
      .range(from, from + 999);
    registrations.push(...((data ?? []) as Registration[]));
    if (!data || data.length < 1000) break;
  }

  const locale = ((event.org as unknown as { default_language: Locale })?.default_language ?? "en") as Locale;
  const { header, rows } = buildRegistrantTable((fields ?? []) as FormField[], registrations, locale);
  const filename = `${event.slug}-registrants-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    return new NextResponse(toCsv(header, rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Registrants");
  sheet.addRow(header).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((col) => (col.width = 22));
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}
