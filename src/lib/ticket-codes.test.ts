import { describe, expect, it } from "vitest";
import { extractTicketCode, generateTicketCode, isValidTicketCode } from "./ticket-codes";

const secret = "test-secret-please-change";

describe("ticket codes", () => {
  it("generates unique codes that verify", () => {
    const a = generateTicketCode(secret);
    const b = generateTicketCode(secret);
    expect(a).not.toEqual(b);
    expect(isValidTicketCode(a, secret)).toBe(true);
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/);
  });

  it("rejects tampered codes and wrong secrets", () => {
    const code = generateTicketCode(secret);
    const [token, sig] = code.split(".");
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(isValidTicketCode(`${flipped}.${sig}`, secret)).toBe(false);
    expect(isValidTicketCode(code, "other-secret")).toBe(false);
    expect(isValidTicketCode("garbage", secret)).toBe(false);
    expect(isValidTicketCode(`${code}.x`, secret)).toBe(false);
  });

  it("extracts codes from ticket URLs", () => {
    const code = generateTicketCode(secret);
    expect(extractTicketCode(`https://example.com/t/${code}`)).toBe(code);
    expect(extractTicketCode(`  ${code} `)).toBe(code);
  });
});
