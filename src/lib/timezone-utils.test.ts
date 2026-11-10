import { describe, expect, it } from "vitest";
import { utcIsoToZonedLocal, zonedLocalToUtcIso } from "./timezone-utils";

describe("timezone utils", () => {
  it("converts WIB (UTC+7) local time to UTC and back", () => {
    expect(zonedLocalToUtcIso("2026-12-20T09:00", "Asia/Jakarta")).toBe("2026-12-20T02:00:00.000Z");
    expect(utcIsoToZonedLocal("2026-12-20T02:00:00.000Z", "Asia/Jakarta")).toBe("2026-12-20T09:00");
  });
  it("handles WITA and WIT", () => {
    expect(zonedLocalToUtcIso("2026-12-20T09:00", "Asia/Makassar")).toBe("2026-12-20T01:00:00.000Z");
    expect(zonedLocalToUtcIso("2026-12-20T09:00", "Asia/Jayapura")).toBe("2026-12-20T00:00:00.000Z");
  });
  it("rejects bad input", () => {
    expect(zonedLocalToUtcIso("nope", "Asia/Jakarta")).toBeNull();
  });
});
