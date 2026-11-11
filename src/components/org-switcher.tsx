"use client";
import { useRouter } from "next/navigation";

/** Dropdown to jump between your organizations (or create a new one). */
export function OrgSwitcher({
  current,
  options,
  label,
  createLabel,
}: {
  current: string;
  options: { slug: string; name: string }[];
  label: string;
  createLabel: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label={label}
      className="w-full cursor-pointer rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white focus:outline-2 focus:outline-white/50"
      value={current}
      onChange={(e) => {
        const value = e.target.value;
        if (value === "__new") return router.push("/dashboard/new-organization");
        // Remember the choice so /dashboard opens this organization next time.
        document.cookie = `active_org=${value}; path=/; max-age=31536000; samesite=lax`;
        router.push(`/dashboard/${value}`);
      }}
    >
      {options.map((o) => (
        <option key={o.slug} value={o.slug} className="text-ink-900">{o.name}</option>
      ))}
      <option value="__new" className="text-ink-900">+ {createLabel}</option>
    </select>
  );
}
