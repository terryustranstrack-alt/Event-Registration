/** Only allow same-site relative paths as post-auth destinations (no open redirects). */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}

/**
 * The Supabase email template passes {{ .RedirectTo }} as `redirect_to`, which
 * is the app's own callback URL (…/auth/callback?next=/somewhere). Pull the
 * `next` path out of it; fall back to `next` given directly.
 */
export function nextFromConfirmParams(params: { next?: string | null; redirect_to?: string | null }): string {
  if (params.next) return safeNextPath(params.next);
  if (params.redirect_to) {
    try {
      return safeNextPath(new URL(params.redirect_to).searchParams.get("next"));
    } catch {
      // not a URL: ignore
    }
  }
  return "/dashboard";
}

export const EMAIL_OTP_TYPES = ["signup", "email", "invite", "magiclink", "recovery", "email_change"] as const;
export type ConfirmOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function isConfirmOtpType(value: unknown): value is ConfirmOtpType {
  return typeof value === "string" && (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}
