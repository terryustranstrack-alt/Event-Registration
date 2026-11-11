import Link from "next/link";

/**
 * Racik EventMu logo (icon + name). `light` = white version for dark or
 * colored backgrounds; the default is the dark version for light backgrounds.
 */
export function BrandLogo({ href = "/", light = false, className = "h-12" }: { href?: string; light?: boolean; className?: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Racik EventMu — home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={light ? "/brand/racik-eventmu-logo-light.png" : "/brand/racik-eventmu-logo-dark.png"}
        alt="Racik EventMu"
        width={1200}
        height={410}
        className={`${className} w-auto`}
      />
    </Link>
  );
}
