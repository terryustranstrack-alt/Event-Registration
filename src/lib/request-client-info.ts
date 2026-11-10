import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

/** Rate-limit key without storing raw IPs (PDP Law data minimisation). */
export function hashForRateLimit(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
