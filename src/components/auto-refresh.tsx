"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-render the server component periodically for live numbers (FR-9.1, US-11). */
export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
