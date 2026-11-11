import Link from "next/link";
import { requireOrgMembership } from "@/lib/auth-guards";
import { getOrgEvent } from "@/lib/event-data";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatDateTime } from "@/lib/i18n/format";
import { RegistrantRowActions } from "@/components/registrant-row-actions";
import type { Registration } from "@/lib/domain-types";

const PAGE_SIZE = 50;

/** Registrant table with search, filters and export (FR-9.4). */
export default async function RegistrantsPage({ params, searchParams }: PageProps<"/dashboard/[orgSlug]/events/[eventId]/registrants">) {
  const { orgSlug, eventId } = await params;
  const sp = await searchParams;
  const { org, role } = await requireOrgMembership(orgSlug);
  const event = await getOrgEvent(org.id, eventId);
  const { locale, t } = await getServerTranslator();
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "all";
  const checked = typeof sp.checked === "string" ? sp.checked : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("registrations")
    .select("id, full_name, email, status, created_at, checked_in_at, email_status, email_error, ticket_code", { count: "exact" })
    .eq("event_id", event.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  if (status === "registered" || status === "cancelled" || status === "waitlisted") query = query.eq("status", status);
  if (checked === "yes") query = query.not("checked_in_at", "is", null);
  if (checked === "no") query = query.is("checked_in_at", null);
  const { data, count } = await query;
  const rows = (data ?? []) as Registration[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const exportBase = `/api/events/${event.id}/export`;
  const pageHref = (p: number) => {
    const params = new URLSearchParams({ ...(q && { q }), status, checked, page: String(p) });
    return `?${params}`;
  };
  const emailBadge = { pending: "bg-zinc-100 text-zinc-700", sent: "bg-emerald-100 text-emerald-800", failed: "bg-red-100 text-red-800" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap items-end gap-2" role="search">
          <div>
            <label htmlFor="q" className="sr-only">{t("reg.searchPlaceholder")}</label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder={t("reg.searchPlaceholder")} className="input w-64" />
          </div>
          <select name="status" defaultValue={status} aria-label={t("reg.table.status")} className="input w-auto">
            <option value="all">{t("reg.filter.all")}</option>
            <option value="registered">{t("reg.status.registered")}</option>
            <option value="waitlisted">{t("reg.status.waitlisted")}</option>
            <option value="cancelled">{t("reg.status.cancelled")}</option>
          </select>
          <select name="checked" defaultValue={checked} aria-label={t("reg.table.checkedIn")} className="input w-auto">
            <option value="all">{t("reg.filter.all")}</option>
            <option value="yes">{t("reg.filter.checkedIn")}</option>
            <option value="no">{t("reg.filter.notCheckedIn")}</option>
          </select>
          <button className="btn-secondary">{t("checkin.search")}</button>
        </form>
        {role === "admin" && (
          <div className="flex gap-2">
            <a href={`${exportBase}?format=csv`} className="btn-secondary btn-sm">{t("reg.exportCsv")}</a>
            <a href={`${exportBase}?format=xlsx`} className="btn-secondary btn-sm">{t("reg.exportXlsx")}</a>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="card text-center text-ink-700">{t("reg.none")}</p>
      ) : (
        <div className="card overflow-x-auto p-0 pb-24">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50/70 text-xs font-bold uppercase tracking-wider text-ink-700">
              <tr>
                <th className="px-4 py-3">{t("reg.table.name")}</th>
                <th className="px-4 py-3">{t("reg.table.status")}</th>
                <th className="px-4 py-3">{t("reg.table.registeredAt")}</th>
                <th className="px-4 py-3">{t("reg.table.checkedIn")}</th>
                <th className="px-4 py-3">{t("reg.table.emailStatus")}</th>
                {role === "admin" && <th className="px-4 py-3 text-right">{t("common.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-brand-50 align-middle hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <p className="font-bold">{r.full_name}</p>
                    <p className="text-xs text-ink-700/75">{r.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${r.status === "registered" ? "bg-brand-50 text-brand-700" : r.status === "waitlisted" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"}`}>
                      {t(`reg.status.${r.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-700">{formatDateTime(r.created_at, locale, event.timezone)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.checked_in_at ? `✓ ${formatDateTime(r.checked_in_at, locale, event.timezone)}` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${emailBadge[r.email_status]}`} title={r.email_error ?? undefined}>{t(`reg.email.${r.email_status}`)}</span>
                  </td>
                  {role === "admin" && (
                    <td className="px-4 py-3 text-right">
                      <RegistrantRowActions
                        locale={locale}
                        orgSlug={org.slug}
                        eventId={event.id}
                        registration={{ id: r.id, full_name: r.full_name, email: r.email, status: r.status, checked_in_at: r.checked_in_at }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn-secondary btn-sm">←</Link>}
          <span>{page} / {totalPages}</span>
          {page < totalPages && <Link href={pageHref(page + 1)} className="btn-secondary btn-sm">→</Link>}
        </nav>
      )}
    </div>
  );
}
