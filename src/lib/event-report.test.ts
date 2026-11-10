import { describe, expect, it } from "vitest";
import { checkInsPer15Minutes, registrationsPerDay } from "./event-report";

const row = (created_at: string, checked_in_at: string | null = null) => ({ status: "registered" as const, created_at, checked_in_at, answers: {} });

describe("event report", () => {
  it("groups registrations by local day", () => {
    // 2026-12-01T18:00Z is Dec 2 in Jakarta (UTC+7)
    expect(registrationsPerDay([row("2026-12-01T10:00:00Z"), row("2026-12-01T18:00:00Z")], "Asia/Jakarta")).toEqual([
      { key: "2026-12-01", count: 1 },
      { key: "2026-12-02", count: 1 },
    ]);
  });
  it("fills empty 15-minute buckets", () => {
    const result = checkInsPer15Minutes([row("x", "2026-12-20T02:01:00Z"), row("x", "2026-12-20T02:40:00Z"), row("x", "2026-12-20T02:44:00Z")]);
    expect(result.map((r) => r.count)).toEqual([1, 0, 2]);
  });
});
