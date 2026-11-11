"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartIcon, SettingsIcon, ShieldIcon, TicketIcon, UsersIcon } from "@/components/icons";

const ICONS = { events: TicketIcon, team: UsersIcon, settings: SettingsIcon, owner: ShieldIcon, report: ChartIcon };
export type NavIcon = keyof typeof ICONS;

/**
 * Dashboard menu links. Highlights the section you're in. "Events" stays
 * highlighted inside an event's pages too.
 */
export function DashboardNav({ items }: { items: { href: string; label: string; icon: NavIcon; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href || pathname.startsWith(`${item.href}/events`)
          : pathname.startsWith(item.href);
        const NavIconComponent = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? "bg-white/15 text-white shadow-inner" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <NavIconComponent size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
