import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get turnstileSiteKey() {
    return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  },
};

export function serverEnv() {
  return {
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    ticketSigningSecret: required("TICKET_SIGNING_SECRET"),
    brevoApiKey: process.env.BREVO_API_KEY ?? "",
    emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? "tickets@tickets.racikdigital.com",
    emailFromName: process.env.EMAIL_FROM_NAME ?? "Racik Tickets",
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? "",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}
