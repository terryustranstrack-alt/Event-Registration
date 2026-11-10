import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Cloudflare Turnstile check (NFR Security). When no secret key is
 * configured (local development) the check is skipped.
 */
export async function verifyTurnstileToken(token: string | null, ip?: string | null): Promise<boolean> {
  const secret = serverEnv().turnstileSecretKey;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
