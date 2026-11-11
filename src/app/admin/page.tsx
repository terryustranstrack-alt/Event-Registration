import Link from "next/link";
import { requirePlatformOwner } from "@/lib/auth-guards";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role-client";
import { getServerTranslator } from "@/lib/i18n/server-locale";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { setOrganizationStatusAction } from "@/app/actions/owner-actions";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Owner console", robots: { index: false } };

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Platform owner console (FR-1.5): orgs, volumes, email health, suspend. */
export default async function OwnerConsolePage() {
  await requirePlatformOwner();
  const { locale, t } = await getServerTranslator();
  const db = createSupabaseServiceRoleClient();
  const weekAgo = daysAgoIso(7);

  const [{ data: orgs }, { data: events }, { count: regCount }, { count: failedEmails }, { count: pendingEmails }] = await Promise.all([
    db.from("organizations").select("id, name, slug, status, created_at, contact_email").order("created_at", { ascending: false }),
    db.from("events").select("org_id, seats_taken, status"),
    db.from("registrations").select("id", { count: "exact", head: true }),
    db.from("email_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", weekAgo),
    db.from("email_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const perOrg = new Map<string, { events: number; registrations: number }>();
  for (const e of events ?? []) {
    const cur = perOrg.get(e.org_id) ?? { events: 0, registrations: 0 };
    cur.events += 1;
    cur.registrations += e.seats_taken;
    perOrg.set(e.org_id, cur);
  }
  const cards = [
    { label: t("owner.orgs"), value: orgs?.length ?? 0 },
    { label: t("owner.events"), value: events?.length ?? 0 },
    { label: t("owner.registrations"), value: regCount ?? 0 },
    { label: t("owner.emailFailures"), value: failedEmails ?? 0 },
    { label: "Email queue", value: pendingEmails ?? 0 },
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("owner.title")}</h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-700">{c.label}</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{formatNumber(c.value, locale)}</p>
            </div>
          ))}
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50/70 text-ink-700">
              <tr>
                <th className="px-4 py-3">{t("owner.orgs")}</th>
                <th className="px-4 py-3">{t("owner.status")}</th>
                <th className="px-4 py-3 text-right">{t("owner.events")}</th>
                <th className="px-4 py-3 text-right">{t("owner.registrations")}</th>
                <th className="px-4 py-3">{t("reg.table.registeredAt")}</th>
                <th className="px-4 py-3 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(orgs ?? []).map((o) => {
                const stats = perOrg.get(o.id) ?? { events: 0, registrations: 0 };
                const suspended = o.status === "suspended";
                return (
                  <tr key={o.id} className="border-t border-brand-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/${o.slug}`} className="font-medium text-brand-700 hover:underline">{o.name}</Link>
                      <p className="text-xs text-ink-700">/{o.slug} · {o.contact_email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${suspended ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{stats.events}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{stats.registrations}</td>
                    <td className="px-4 py-3">{formatDate(o.created_at, locale)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={setOrganizationStatusAction} className="inline-flex gap-2">
                        <input type="hidden" name="org_id" value={o.id} />
                        <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
                        <button className={suspended ? "btn-secondary btn-sm" : "btn-danger btn-sm"}>
                          {suspended ? t("owner.unsuspend") : t("owner.suspend")}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
