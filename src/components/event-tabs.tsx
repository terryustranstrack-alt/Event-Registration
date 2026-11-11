"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pill-style tabs for an event's sections. */
export function EventTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 ring-1 ring-brand-100" aria-label="Event sections">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${
              active ? "bg-linear-to-r from-brand-600 to-pop-600 text-white shadow" : "text-ink-700 hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
