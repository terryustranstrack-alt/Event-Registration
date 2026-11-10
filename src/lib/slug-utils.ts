export const RESERVED_ORG_SLUGS = new Set([
  "admin", "api", "auth", "checkin", "dashboard", "invite", "login",
  "signup", "t", "about", "privacy", "terms", "help", "static", "public",
]);

export const ORG_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/;
export const EVENT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export function slugify(text: string, maxLength = 50): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export function isValidOrgSlug(slug: string): boolean {
  return ORG_SLUG_RE.test(slug) && !RESERVED_ORG_SLUGS.has(slug);
}
