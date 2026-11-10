import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Ticket codes (FR-5.2): a random 128-bit token plus a truncated HMAC-SHA256
 * signature, both base64url. The QR encodes only this string — no personal
 * data. Forged or mistyped codes are rejected before any database lookup.
 *
 *   <22 chars token>.<22 chars signature>
 */
const TOKEN_BYTES = 16;
const SIGNATURE_BYTES = 16;

function sign(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest().subarray(0, SIGNATURE_BYTES).toString("base64url");
}

export function generateTicketCode(secret: string): string {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return `${token}.${sign(token, secret)}`;
}

export function isValidTicketCode(code: string, secret: string): boolean {
  if (typeof code !== "string" || code.length > 64) return false;
  const [token, signature, extra] = code.trim().split(".");
  if (!token || !signature || extra !== undefined) return false;
  const expected = Buffer.from(sign(token, secret));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export { extractTicketCode } from "./ticket-code-format";
