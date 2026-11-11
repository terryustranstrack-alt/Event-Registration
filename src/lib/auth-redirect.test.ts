import { describe, expect, it } from "vitest";
import { isConfirmOtpType, nextFromConfirmParams, safeNextPath } from "./auth-redirect";

describe("auth redirect helpers", () => {
  it("blocks open redirects", () => {
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(safeNextPath("/invite/abc")).toBe("/invite/abc");
  });

  it("reads next from the Supabase RedirectTo URL", () => {
    expect(nextFromConfirmParams({ redirect_to: "https://racik-eventmu.vercel.app/auth/callback?next=%2Finvite%2Fabc" })).toBe("/invite/abc");
    expect(nextFromConfirmParams({ redirect_to: "https://x.app/auth/callback?next=https://evil.com" })).toBe("/dashboard");
    expect(nextFromConfirmParams({ redirect_to: "not a url" })).toBe("/dashboard");
    expect(nextFromConfirmParams({ next: "/dashboard/new-organization" })).toBe("/dashboard/new-organization");
  });

  it("only accepts known email OTP types", () => {
    expect(isConfirmOtpType("signup")).toBe(true);
    expect(isConfirmOtpType("sms")).toBe(false);
  });
});
