// Browser-safe helpers (no node:crypto) shared by the scanner and the server.

/** Accepts either a raw code or a ticket URL (…/t/<code>) scanned from a QR. */
export function extractTicketCode(scanned: string): string {
  const trimmed = scanned.trim();
  const match = trimmed.match(/\/t\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
  return match ? match[1] : trimmed;
}
