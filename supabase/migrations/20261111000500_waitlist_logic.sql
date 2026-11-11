-- ---------------------------------------------------------------------------
-- Daftar tunggu (waitlist), bagian 2: aturan pendaftaran dan naik antrean.
--
-- Cara kerjanya:
-- * Kursi penuh + daftar tunggu aktif -> pendaftar masuk daftar tunggu
--   (tanpa kursi, tanpa tiket) dan dapat email konfirmasi daftar tunggu.
-- * Begitu ada kursi kosong (pendaftar dibatalkan admin, atau kapasitas
--   dinaikkan), orang paling awal di daftar tunggu otomatis dapat kursi
--   dan tiketnya langsung dikirim lewat email.
-- ---------------------------------------------------------------------------

-- Pindahkan orang dari daftar tunggu ke kursi kosong, urut dari yang paling
-- awal mendaftar. Hanya untuk acara yang belum berakhir dan bukan draf.
create or replace function public.promote_waitlist(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_reg_id uuid;
  v_count integer := 0;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status = 'draft' or v_event.ends_at < now() then
    return 0;
  end if;

  while v_event.seats_taken < v_event.capacity loop
    v_reg_id := null;
    select r.id into v_reg_id
      from public.registrations r
     where r.event_id = p_event_id and r.status = 'waitlisted'
     order by r.created_at, r.id
     limit 1
     for update skip locked;
    exit when v_reg_id is null;

    update public.registrations set status = 'registered', updated_at = now() where id = v_reg_id;
    update public.events set seats_taken = seats_taken + 1 where id = p_event_id;
    insert into public.email_jobs (org_id, registration_id, kind) values (v_event.org_id, v_reg_id, 'ticket');

    v_event.seats_taken := v_event.seats_taken + 1;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.promote_waitlist(uuid) from public, anon, authenticated;

-- Pendaftaran publik: sama seperti sebelumnya, ditambah daftar tunggu saat penuh.
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
  v_full boolean;
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

  v_full := v_event.seats_taken >= v_event.capacity;
  if v_full and not v_event.waitlist_enabled then
    return query select null::uuid, 'sold_out'; return;
  end if;
  if v_event.consent_enabled and not coalesce(p_consent, false) then
    return query select null::uuid, 'consent_required'; return;
  end if;
  -- Orang yang sudah terdaftar atau sudah di daftar tunggu tidak bisa daftar lagi.
  if not v_event.allow_multiple_per_email and exists (
    select 1 from public.registrations r
    where r.event_id = p_event_id and r.email = p_email::citext and r.status in ('registered', 'waitlisted')
  ) then
    return query select null::uuid, 'already_registered'; return;
  end if;

  insert into public.registrations (
    event_id, org_id, full_name, email, language, answers, ticket_code, consent_at, status
  ) values (
    p_event_id, v_event.org_id, p_full_name, p_email, p_language, coalesce(p_answers, '{}'::jsonb),
    p_ticket_code, case when p_consent then now() end,
    case when v_full then 'waitlisted'::public.registration_status else 'registered'::public.registration_status end
  )
  returning id into v_reg_id;

  if v_full then
    insert into public.email_jobs (org_id, registration_id, kind) values (v_event.org_id, v_reg_id, 'waitlist');
  else
    update public.events set seats_taken = seats_taken + 1 where id = p_event_id;
    insert into public.email_jobs (org_id, registration_id, kind) values (v_event.org_id, v_reg_id, 'ticket');
  end if;

  return query select v_reg_id, null::text;
end;
$$;

-- Batalkan pendaftaran (admin). Kalau yang dibatalkan punya kursi, kursinya
-- langsung diberikan ke orang pertama di daftar tunggu.
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
  if v_reg.status = 'registered' then
    update public.events set seats_taken = greatest(seats_taken - 1, 0) where id = v_reg.event_id;
    perform public.promote_waitlist(v_reg.event_id);
  end if;
end;
$$;

-- Kapasitas dinaikkan atau acara dibuka lagi -> isi kursi kosong dari daftar tunggu.
create or replace function public.events_promote_waitlist_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.promote_waitlist(new.id);
  return null;
end;
$$;
revoke execute on function public.events_promote_waitlist_on_change() from public, anon, authenticated;
drop trigger if exists events_promote_waitlist on public.events;
create trigger events_promote_waitlist
  after update of capacity, status on public.events
  for each row
  when (new.capacity > old.capacity or (new.status = 'published' and old.status is distinct from 'published'))
  execute function public.events_promote_waitlist_on_change();

-- Check-in: tiket orang di daftar tunggu belum berlaku.
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
  if v_reg.status = 'waitlisted' then
    return query select 'waitlisted', v_reg.id, v_reg.full_name, v_reg.email::text, null::timestamptz, null::text; return;
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
