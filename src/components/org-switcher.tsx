"use client";
import { useRouter } from "next/navigation";

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
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
      value={current}
      onChange={(e) => {
        const value = e.target.value;
        if (value === "__new") return router.push("/dashboard/new-organization");
        document.cookie = `active_org=${value}; path=/; max-age=31536000; samesite=lax`;
        router.push(`/dashboard/${value}`);
      }}
    >
      {options.map((o) => (
        <option key={o.slug} value={o.slug}>{o.name}</option>
      ))}
      <option value="__new">+ {createLabel}</option>
    </select>
  );
}
