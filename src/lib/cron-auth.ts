import "server-only";
import type { NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = serverEnv().cronSecret;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
