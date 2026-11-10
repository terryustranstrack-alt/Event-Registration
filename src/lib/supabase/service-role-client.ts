import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client: bypasses row-level security. Only use it in server
 * code for public flows (event page, registration, ticket page) and
 * background jobs, and always select explicit, safe columns.
 */
export function createSupabaseServiceRoleClient() {
  return createClient(publicEnv.supabaseUrl, serverEnv().supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
