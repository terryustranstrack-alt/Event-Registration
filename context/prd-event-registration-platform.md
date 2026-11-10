# PRD summary — Event Registration Platform (source: PRD PDF, Nov 10 2026, @Terry)

Multi-org web platform: organizers publish free (v1.0, late Dec 2026) or paid (v1.1, early Feb 2027)
events with a custom form; registrants get an emailed QR ticket; staff scan at the door; organizers see
live registered / checked-in numbers. EN + ID everywhere.

## Personas
Platform owner (Terry, Racik Digital) · Org admin · Registrant (no account, mostly phone) · Check-in staff (phone, weak signal).

## v1.0 scope (implemented)
- FR-1 Orgs & access: email/password + Google; org profile (name, unique slug, logo, default language,
  contact email); roles admin/staff; multi-org switching; DB-level tenant isolation; owner console with suspend.
- FR-2 Events: EN/ID title + rich-text description, banner (≤5 MB, 16:9), start/end + timezone
  (default Asia/Jakarta), venue/maps or online link (online link only in ticket), ≤5 extra links,
  capacity, registration open/close, draft → published → closed, URL /{org}/{event}, slug editable only in draft.
- FR-3 Form builder: fixed name/email/language; short/long text, phone, number, dropdown, radio,
  checkbox, date, file (≤5 MB PDF/JPG/PNG); EN/ID labels, help, placeholder, required, min/max, options;
  reorder/duplicate/delete; live preview; deleted fields keep answers in exports; PDP consent.
- FR-4 Public page: mobile-first, countdown → "Happening now" → "Event ended", live "X of Y seats left"
  (total can be hidden), auto-close with reason, EN/ID switch (browser lang → org default).
- FR-5 Registration: validate + reserve seat in one transaction; 128-bit HMAC-signed ticket code, QR holds
  only the code; one registration per email by default; thank-you page with QR + add to calendar; admin
  cancel / edit / resend.
- FR-7 Ticket email via Brevo from tickets.racikdigital.com, queued with retries, failures resendable.
- FR-8 Check-in: /checkin/{event}, camera scan, green/amber/red in <3 s, manual search, offline guest-list
  cache + queued sync, admin undo, live counter.
- FR-9 Reports: registered/cancelled/checked-in/no-show/attendance/seats left, check-ins per 15 min,
  registrations per day, choice-answer summaries, filterable table + CSV/Excel export, org overview.
- FR-10 Bilingual UI and content with fallback; per-language date/currency formatting.

## NFRs
Page <2.5 s on 4G; submit <2 s; 200 registrations / 10 min with 0 overbooking; 99.5% uptime;
95% emails <1 min; RLS, HTTPS, Turnstile, rate limiting; PDP Law (consent, private uploads,
anonymize 12 months after event, configurable); WCAG 2.1 AA; swappable messaging/payment modules.

## Later
v1.1: FR-6 paid tickets (Midtrans/Xendit: QRIS, VA, e-wallet; 30-min hold; idempotent signed webhooks;
manual refunds), revenue reports, reminder email (1 day before), WhatsApp ticket button.
2027: waitlist, duplicate event, promo codes, certificates, custom domains, platform fee.

## Open questions (from PRD)
Money flow (platform merchant vs per-org account) · Midtrans or Xendit · platform fee model ·
product name/domain · 12-month retention default OK?
