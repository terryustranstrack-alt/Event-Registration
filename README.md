# Racik EventMu

Live: https://racik-eventmu.vercel.app

Multi-organization web platform for Indonesian organizers: publish an event with a custom
registration form, attendees get a QR ticket by email, staff scan it at the door, organizers see
registered vs. checked-in numbers live. English + Bahasa Indonesia throughout.

This repository implements **v1.0 (free events)** from the PRD — see
[`context/prd-event-registration-platform.md`](context/prd-event-registration-platform.md).

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + RLS, Auth, Storage) · Tailwind CSS v4 ·
Brevo (email) · Cloudflare Turnstile · Vercel (hosting + cron).

## Quick start (local)

```bash
npm install
npx supabase start          # needs Docker; applies supabase/migrations
cp .env.example .env.local  # fill in the keys printed by `supabase start`
npm run dev
```

Without `BREVO_API_KEY` emails are logged to the console; without Turnstile keys the captcha is
skipped. Make yourself platform owner:

```sql
update profiles set is_platform_owner = true where email = 'you@example.com';
```

## Checks

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (ticket signing, validation, i18n, timezones, export, reports) |
| `npm run test:db` | Schema + RLS + concurrency tests on a throwaway local Postgres (200 parallel registrations for 50 seats → exactly 50) |
| `npm run typecheck` / `npm run lint` / `npm run build` | Types, lint, production build |

## Where things live

| Area (PRD) | Code |
| --- | --- |
| Database, RLS, seat locking, check-in, retention | `supabase/migrations/20261110000000_initial_schema.sql` |
| FR-1 orgs, roles, invites, owner console | `src/app/dashboard/[orgSlug]/{team,settings}`, `src/app/admin`, `src/app/actions/organization-actions.ts` |
| FR-2 event setup | `src/components/event-editor-form.tsx`, `src/app/actions/event-actions.ts` |
| FR-3 form builder | `src/components/form-builder.tsx`, `src/components/registration-form-fields.tsx` |
| FR-4 public page, countdown, live seats | `src/app/[orgSlug]/[eventSlug]`, `src/components/public-registration-panel.tsx` |
| FR-5 registration + signed tickets | `src/app/api/events/[eventId]/register`, `src/lib/ticket-codes.ts`, `src/app/t/[ticketCode]` |
| FR-7 email queue (Brevo) | `src/lib/messaging/*`, `src/app/api/cron/process-email-queue` |
| FR-8 offline-capable scanner | `src/components/check-in-scanner.tsx`, `src/app/api/checkin/[eventId]` |
| FR-9 reports + CSV/Excel export | `src/app/dashboard/[orgSlug]/events/[eventId]/{registrants,report}`, `src/app/api/events/[eventId]/export` |
| FR-10 bilingual | `src/lib/i18n/*` |

## Security notes

- Every tenant table has row-level security, so data from another organization can't be read.
  Seat counts, ticket codes and check-in state can only change through `SECURITY DEFINER` functions.
- Anonymous visitors never use the anon key against tables directly; the public page and registration run
  server-side and select explicit safe columns (online links appear only on tickets).
- Ticket codes are 128-bit random tokens with an HMAC signature; the QR code contains only the
  ticket code. Forged codes are rejected before any database lookup.
- Registration is rate-limited per IP hash + event and protected by Turnstile.

## Deploying (Vercel + Supabase)

1. Create the Supabase project, run `npx supabase link` and `npx supabase db push`. Enable Google in Auth
   providers and add `https://<domain>/auth/callback` to the redirect URLs.
2. Set every variable from `.env.example` in Vercel (generate `TICKET_SIGNING_SECRET` and `CRON_SECRET`).
3. Verify `tickets.racikdigital.com` in Brevo (SPF, DKIM, DMARC).
4. `vercel.json` runs both cron jobs once a day so it deploys on the Hobby plan (Hobby only allows daily
   crons). Tickets are still sent right after registration, and every registration also retries a few
   pending/failed emails. On Vercel Pro, change the email-queue schedule to `* * * * *` for faster retries.
