import Link from "next/link";
import { TicketIcon } from "@/components/icons";

/** Racik EventMu logo: gradient ticket badge + name. */
export function BrandLogo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Racik EventMu — home">
      <span className="bg-festival grid h-9 w-9 place-items-center rounded-xl text-white shadow-md shadow-pop-600/30">
        <TicketIcon size={20} />
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-ink-900"}`}>
        Racik <span className={light ? "text-sun-400" : "text-festival"}>EventMu</span>
      </span>
    </Link>
  );
}
