-- =============================================================================
-- Event Registration Platform — initial schema (v1.0, free events)
-- Covers PRD FR-1 .. FR-5, FR-7 (email queue), FR-8, FR-9, owner console.
--
-- Security model
--   * Every tenant table carries org_id and has row-level security enabled.
--   * Membership checks go through SECURITY DEFINER helpers so policies stay
--     cheap and cannot recurse.
--   * Public (anonymous) access never touches tables directly: the public
--     event page and registration go through server code using the service
--     role and the narrow functions below, so online links / registrant data
--     can never leak through the anon key.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_language as enum ('en', 'id');
create type public.org_role as enum ('admin', 'staff');
create type public.org_status as enum ('active', 'suspended');
create type public.event_status as enum ('draft', 'published', 'closed');
create type public.registration_status as enum ('registered', 'cancelled');
create type public.delivery_status as enum ('pending', 'sent', 'failed');
create type public.form_field_type as enum (
  'short_text', 'long_text', 'phone', 'number', 'dropdown',
  'radio', 'checkbox', 'date', 'file'
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null,
  full_name text,
  is_platform_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Organizations & membership (FR-1)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug citext not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$')
    -- top-level app routes cannot be used as org slugs (public URL is /{org}/{event})
    check (slug not in ('admin', 'api', 'auth', 'checkin', 'dashboard', 'invite', 'login',
                        'signup', 't', 'about', 'privacy', 'terms', 'help', 'static', 'public')),
  logo_url text,
  default_language public.app_language not null default 'id',
  contact_email citext,
  privacy_policy_url text,
  status public.org_status not null default 'active',
  suspended_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email citext not null,
  role public.org_role not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index invitations_org_idx on public.invitations (org_id);

-- Helper functions used by policies -----------------------------------------
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_owner from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.has_org_role(p_org_id uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.role = any (p_roles)
  );
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select public.has_org_role(p_org_id, array['admin', 'staff']::public.org_role[]);
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select public.has_org_role(p_org_id, array['admin']::public.org_role[]);
$$;

-- Create an org and make the caller its first admin, atomically.
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_default_language public.app_language default 'id',
  p_contact_email text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.organizations (name, slug, default_language, contact_email, created_by)
  values (p_name, lower(p_slug), p_default_language, p_contact_email, auth.uid())
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'admin');

  return v_org;
end;
$$;

-- Accept an invitation addressed to the caller's email.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
  v_email citext;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  select * into v_inv from public.invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invitation_already_used';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'invitation_expired';
  end if;
  if v_inv.email <> v_email then
    raise exception 'invitation_email_mismatch';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_inv.org_id, auth.uid(), v_inv.role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  update public.invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.org_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Events (FR-2)
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  slug citext not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$'),
  title_en text,
  title_id text,
  description_en text,
  description_id text,
  banner_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Jakarta',
  venue_name text,
  venue_address text,
  maps_url text,
  online_url text,               -- only ever shown in the ticket (FR-2.2)
  extra_links jsonb not null default '[]'::jsonb,  -- [{label_en,label_id,url}] max 5
  capacity integer not null check (capacity > 0 and capacity <= 100000),
  seats_taken integer not null default 0 check (seats_taken >= 0),
  hide_capacity_total boolean not null default false,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  status public.event_status not null default 'draft',
  allow_multiple_per_email boolean not null default false,
  consent_enabled boolean not null default true,
  retention_months integer not null default 12 check (retention_months between 1 and 120),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug),
  check (ends_at > starts_at),
  check (title_en is not null or title_id is not null),
  check (jsonb_typeof(extra_links) = 'array' and jsonb_array_length(extra_links) <= 5),
  constraint seats_within_capacity check (seats_taken <= capacity)
);
create index events_org_idx on public.events (org_id, starts_at desc);

-- Slug can only change while the event is a draft (FR-2.5).
create or replace function public.events_guard_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is distinct from old.slug and old.status <> 'draft' then
    raise exception 'slug_locked_after_publish';
  end if;
  if new.status = 'published' and old.status = 'draft' then
    new.published_at := coalesce(old.published_at, now());
  end if;
  if new.capacity < old.seats_taken then
    raise exception 'capacity_below_registrations';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_guard_slug
  before update on public.events
  for each row execute function public.events_guard_slug();

-- ---------------------------------------------------------------------------
-- Form fields (FR-3)
-- Fixed fields (full name, email, language) live on registrations directly.
-- Deleting a field archives it so old answers stay in exports (FR-3.5).
-- ---------------------------------------------------------------------------
create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  position integer not null default 0,
  type public.form_field_type not null,
  label_en text,
  label_id text,
  help_en text,
  help_id text,
  placeholder_en text,
  placeholder_id text,
  required boolean not null default false,
  min_value numeric,
  max_value numeric,
  options jsonb not null default '[]'::jsonb,  -- [{value,label_en,label_id}]
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (label_en is not null or label_id is not null),
  check (jsonb_typeof(options) = 'array')
);
create index form_fields_event_idx on public.form_fields (event_id, position);

-- ---------------------------------------------------------------------------
-- Registrations & tickets (FR-5)
-- ---------------------------------------------------------------------------
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  email citext not null,
  language public.app_language not null default 'id',
  answers jsonb not null default '{}'::jsonb,  -- { field_id: value }
  status public.registration_status not null default 'registered',
  ticket_code text not null unique,            -- signed 128-bit token (see src/lib/tickets)
  consent_at timestamptz,
  email_status public.delivery_status not null default 'pending',
  email_error text,
  email_sent_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index registrations_event_idx on public.registrations (event_id, created_at desc);
create index registrations_event_email_idx on public.registrations (event_id, email);
create index registrations_event_name_idx on public.registrations (event_id, lower(full_name));

create table public.check_in_log (
  id bigint generated always as identity primary key,
  registration_id uuid not null references public.registrations (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  action text not null check (action in ('check_in', 'undo')),
  method text not null check (method in ('scan', 'manual', 'offline_sync', 'admin')),
  performed_by uuid references auth.users (id) on delete set null,
  performed_at timestamptz not null default now()
);
create index check_in_log_event_idx on public.check_in_log (event_id, performed_at);

-- ---------------------------------------------------------------------------
-- Messaging queue (FR-7)
-- ---------------------------------------------------------------------------
create table public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  registration_id uuid references public.registrations (id) on delete cascade,
  invitation_id uuid references public.invitations (id) on delete cascade,
  kind text not null check (kind in ('ticket', 'invitation')),
  status public.delivery_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  provider_message_id text,
  run_after timestamptz not null default now(),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_jobs_pending_idx on public.email_jobs (run_after) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, keyed by e.g. hashed IP)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create or replace function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean  -- true = allowed
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  -- opportunistic cleanup
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registration: seat reservation in one transaction (FR-5.1, NFR 0 overbooking)
-- Called only by the server (service role) after validation + captcha.
-- ---------------------------------------------------------------------------
create or replace function public.register_for_event(
  p_event_id uuid,
  p_full_name text,
  p_email text,
  p_language public.app_language,
  p_answers jsonb,
  p_ticket_code text,
  p_consent boolean
)
returns table (registration_id uuid, error_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_org public.organizations;
  v_reg_id uuid;
begin
  -- Row lock serialises concurrent registrations for the same event.
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    return query select null::uuid, 'event_not_found'; return;
  end if;

  select * into v_org from public.organizations where id = v_event.org_id;
  if v_org.status <> 'active' then
    return query select null::uuid, 'org_unavailable'; return;
  end if;
  if v_event.status <> 'published' then
    return query select null::uuid, 'event_closed'; return;
  end if;
  if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
    return query select null::uuid, 'not_open_yet'; return;
  end if;
  if (v_event.registration_closes_at is not null and now() > v_event.registration_closes_at)
     or now() > v_event.ends_at then
    return query select null::uuid, 'registration_closed'; return;
  end if;
  if v_event.seats_taken >= v_event.capacity then
    return query select null::uuid, 'sold_out'; return;
  end if;
  if v_event.consent_enabled and not coalesce(p_consent, false) then
    return query select null::uuid, 'consent_required'; return;
  end if;
  if not v_event.allow_multiple_per_email and exists (
    select 1 from public.registrations r
    where r.event_id = p_event_id and r.email = p_email::citext and r.status = 'registered'
  ) then
    return query select null::uuid, 'already_registered'; return;
  end if;

  insert into public.registrations (
    event_id, org_id, full_name, email, language, answers, ticket_code, consent_at
  ) values (
    p_event_id, v_event.org_id, p_full_name, p_email, p_language, coalesce(p_answers, '{}'::jsonb),
    p_ticket_code, case when p_consent then now() end
  )
  returning id into v_reg_id;

  update public.events set seats_taken = seats_taken + 1 where id = p_event_id;

  insert into public.email_jobs (org_id, registration_id, kind)
  values (v_event.org_id, v_reg_id, 'ticket');

  return query select v_reg_id, null::text;
end;
$$;

-- Cancel a registration and free its seat (FR-5.5). Admins only.
create or replace function public.cancel_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations;
begin
  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found then raise exception 'registration_not_found'; end if;
  if not public.is_org_admin(v_reg.org_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_reg.status = 'cancelled' then return; end if;

  perform 1 from public.events where id = v_reg.event_id for update;
  update public.registrations
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = p_registration_id;
  update public.events set seats_taken = greatest(seats_taken - 1, 0) where id = v_reg.event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in (FR-8). Staff or admin of the event's org.
-- Result: valid | already_checked_in | cancelled | wrong_event | not_found
-- ---------------------------------------------------------------------------
create or replace function public.check_in_ticket(
  p_event_id uuid,
  p_ticket_code text,
  p_method text default 'scan',
  p_at timestamptz default null
)
returns table (
  result text,
  registration_id uuid,
  full_name text,
  email text,
  checked_in_at timestamptz,
  checked_in_by_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_reg public.registrations;
  v_at timestamptz := least(coalesce(p_at, now()), now());
begin
  select * into v_event from public.events where id = p_event_id;
  if not found or not public.is_org_member(v_event.org_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_reg from public.registrations where ticket_code = p_ticket_code for update;
  if not found then
    return query select 'not_found', null::uuid, null::text, null::text, null::timestamptz, null::text; return;
  end if;
  if v_reg.event_id <> p_event_id then
    return query select 'wrong_event', null::uuid, null::text, null::text, null::timestamptz, null::text; return;
  end if;
  if v_reg.status = 'cancelled' then
    return query select 'cancelled', v_reg.id, v_reg.full_name, v_reg.email::text, null::timestamptz, null::text; return;
  end if;
  if v_reg.checked_in_at is not null then
    return query
      select 'already_checked_in', v_reg.id, v_reg.full_name, v_reg.email::text, v_reg.checked_in_at,
             (select coalesce(p.full_name, p.email::text) from public.profiles p where p.id = v_reg.checked_in_by);
    return;
  end if;

  update public.registrations
    set checked_in_at = v_at, checked_in_by = auth.uid(), updated_at = now()
    where id = v_reg.id;

  insert into public.check_in_log (registration_id, event_id, org_id, action, method, performed_by, performed_at)
  values (v_reg.id, p_event_id, v_event.org_id, 'check_in', p_method, auth.uid(), v_at);

  return query select 'valid', v_reg.id, v_reg.full_name, v_reg.email::text, v_at, null::text;
end;
$$;

create or replace function public.undo_check_in(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.registrations;
begin
  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found then raise exception 'registration_not_found'; end if;
  if not public.is_org_admin(v_reg.org_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_reg.checked_in_at is null then return; end if;

  update public.registrations
    set checked_in_at = null, checked_in_by = null, updated_at = now()
    where id = p_registration_id;
  insert into public.check_in_log (registration_id, event_id, org_id, action, method, performed_by)
  values (v_reg.id, v_reg.event_id, v_reg.org_id, 'undo', 'admin', auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports (FR-9)
-- ---------------------------------------------------------------------------
create or replace function public.event_stats(p_event_id uuid)
returns table (
  registered bigint,
  cancelled bigint,
  checked_in bigint,
  no_show bigint,
  capacity integer,
  seats_left integer,
  event_ended boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (where r.status = 'registered'),
    count(*) filter (where r.status = 'cancelled'),
    count(*) filter (where r.status = 'registered' and r.checked_in_at is not null),
    case when e.ends_at < now()
      then count(*) filter (where r.status = 'registered' and r.checked_in_at is null)
      else 0 end,
    e.capacity,
    greatest(e.capacity - e.seats_taken, 0),
    e.ends_at < now()
  from public.events e
  left join public.registrations r on r.event_id = e.id
  where e.id = p_event_id
  group by e.id;
$$;

-- ---------------------------------------------------------------------------
-- Privacy retention (NFR Privacy): anonymize registrant data N months after
-- the event ends. Run daily from the cron endpoint.
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_expired_registrations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.registrations r
    set full_name = 'Anonymized',
        email = ('anon-' || r.id || '@invalid.local')::citext,
        answers = '{}'::jsonb,
        anonymized_at = now(),
        updated_at = now()
  from public.events e
  where e.id = r.event_id
    and r.anonymized_at is null
    and e.ends_at + make_interval(months => e.retention_months) < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.events enable row level security;
alter table public.form_fields enable row level security;
alter table public.registrations enable row level security;
alter table public.check_in_log enable row level security;
alter table public.email_jobs enable row level security;
alter table public.rate_limits enable row level security;

-- profiles: see yourself, teammates, or everything as platform owner
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_platform_owner()
    or exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.org_id = mine.org_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_platform_owner = (select p.is_platform_owner from public.profiles p where p.id = auth.uid()));

-- organizations
create policy orgs_select on public.organizations for select to authenticated
  using (public.is_org_member(id) or public.is_platform_owner());
create policy orgs_update_admin on public.organizations for update to authenticated
  using (public.is_org_admin(id) or public.is_platform_owner())
  with check (public.is_org_admin(id) or public.is_platform_owner());

-- Admins must not be able to un-suspend themselves.
create or replace function public.organizations_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status or new.suspended_reason is distinct from old.suspended_reason)
     and auth.uid() is not null and not public.is_platform_owner() then
    raise exception 'only_platform_owner_can_change_status' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger organizations_guard_status
  before update on public.organizations
  for each row execute function public.organizations_guard_status();

-- memberships
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(org_id) or public.is_platform_owner());
create policy memberships_admin_update on public.memberships for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy memberships_admin_delete on public.memberships for delete to authenticated
  using (public.is_org_admin(org_id) and user_id <> auth.uid());

-- invitations
create policy invitations_admin_all on public.invitations for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- events
create policy events_select on public.events for select to authenticated
  using (public.is_org_member(org_id) or public.is_platform_owner());
create policy events_admin_insert on public.events for insert to authenticated
  with check (public.is_org_admin(org_id));
create policy events_admin_update on public.events for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy events_admin_delete on public.events for delete to authenticated
  using (public.is_org_admin(org_id) and status = 'draft');

-- seats_taken is maintained only by the SECURITY DEFINER functions above
-- (which run as the table owner). Block direct changes from API roles.
create or replace function public.events_guard_counters()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.seats_taken := 0;
    elsif new.seats_taken is distinct from old.seats_taken then
      raise exception 'seats_taken_is_managed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger events_guard_counters
  before insert or update on public.events
  for each row execute function public.events_guard_counters();

-- form fields
create policy form_fields_select on public.form_fields for select to authenticated
  using (public.is_org_member(org_id));
create policy form_fields_admin_write on public.form_fields for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- registrations: staff get read-only guest list, admins can edit name/email
create policy registrations_select on public.registrations for select to authenticated
  using (public.is_org_member(org_id) or public.is_platform_owner());
create policy registrations_admin_update on public.registrations for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
-- Direct API updates may only touch name/email/language (FR-5.5). Status,
-- check-in and ticket changes go through the functions above.
create or replace function public.registrations_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.status is distinct from old.status
    or new.ticket_code is distinct from old.ticket_code
    or new.checked_in_at is distinct from old.checked_in_at
    or new.checked_in_by is distinct from old.checked_in_by
    or new.event_id is distinct from old.event_id
    or new.org_id is distinct from old.org_id
    or new.answers is distinct from old.answers
  ) then
    raise exception 'registration_column_is_managed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger registrations_guard_columns
  before update on public.registrations
  for each row execute function public.registrations_guard_columns();

-- check-in log: members read
create policy check_in_log_select on public.check_in_log for select to authenticated
  using (public.is_org_member(org_id));

-- email_jobs / rate_limits: no policies -> service role only.

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.register_for_event(uuid, text, text, public.app_language, jsonb, text, boolean) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.anonymize_expired_registrations() from public, anon, authenticated;
revoke execute on function public.create_organization(text, text, public.app_language, text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.check_in_ticket(uuid, text, text, timestamptz) from public, anon;
revoke execute on function public.undo_check_in(uuid) from public, anon;
revoke execute on function public.cancel_registration(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Storage
--   org-assets (public read): {org_id}/logo-*, {org_id}/events/{event_id}/banner-*
--   registration-uploads (private): {org_id}/{event_id}/{uuid}-{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('org-assets', 'org-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('registration-uploads', 'registration-uploads', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy org_assets_admin_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'org-assets'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );
create policy org_assets_admin_update on storage.objects for update to authenticated
  using (
    bucket_id = 'org-assets'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );
create policy org_assets_admin_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'org-assets'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );
create policy registration_uploads_member_read on storage.objects for select to authenticated
  using (
    bucket_id = 'registration-uploads'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Email queue claiming (FR-7.2). Workers claim a batch with SKIP LOCKED so
-- concurrent cron runs / immediate sends never double-send.
-- ---------------------------------------------------------------------------
create or replace function public.claim_email_jobs(p_limit integer default 20, p_only_id uuid default null)
returns setof public.email_jobs
language sql
security definer
set search_path = public
as $$
  update public.email_jobs j
     set locked_until = now() + interval '2 minutes',
         attempts = j.attempts + 1
   where j.id in (
     select id from public.email_jobs
      where status = 'pending'
        and run_after <= now()
        and (locked_until is null or locked_until < now())
        and (p_only_id is null or id = p_only_id)
      order by run_after
      limit p_limit
      for update skip locked
   )
  returning j.*;
$$;
revoke execute on function public.claim_email_jobs(integer, uuid) from public, anon, authenticated;
