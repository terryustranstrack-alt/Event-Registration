import "server-only";

function required(name: string, ...fallbacks: string[]): string {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key];
    if (value) return value;
  }
  throw new Error(`Missing environment variable ${[name, ...fallbacks].join(" or ")}. See .env.example.`);
}

export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    // Legacy anon key, or the newer publishable key (the Vercel Supabase
    // integration sets NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  },
  get siteUrl() {
    // Explicit setting first, then Vercel's production domain, then local dev.
    const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const url =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (vercelProduction ? `https://${vercelProduction}` : "") ||
      "http://localhost:3000";
    return url.replace(/\/$/, "");
  },
  get turnstileSiteKey() {
    return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  },
};

export function serverEnv() {
  return {
    // Legacy service_role key, or the newer secret key (sb_secret_…).
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    ticketSigningSecret: required("TICKET_SIGNING_SECRET"),
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? "",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}
