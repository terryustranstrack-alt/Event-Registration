-- ---------------------------------------------------------------------------
-- Daftar rombongan: satu pendaftaran (satu email) bisa membawa beberapa orang.
--
-- * Penyelenggara menentukan batas orang per pendaftaran (1 = fitur mati).
-- * Setiap orang tetap jadi satu baris pendaftaran sendiri, dengan tiket/QR
--   sendiri (jadi bisa check-in masing-masing) dan memakai satu kursi.
-- * Tamu ditautkan ke pendaftar utama lewat group_id dan memakai email yang sama.
-- * Kursi tidak cukup untuk seluruh rombongan: masuk daftar tunggu bersama
--   (kalau aktif), dan naik dari daftar tunggu juga bersama-sama.
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists max_group_size integer not null default 1
  check (max_group_size between 1 and 20);

alter table public.registrations
  add column if not exists group_id uuid references public.registrations (id) on delete set null;
create index if not exists registrations_group_idx on public.registrations (group_id) where group_id is not null;

-- Fungsi lama diganti (ada tambahan isian nama tamu), jadi dihapus dulu.
drop function if exists public.register_for_event(uuid, text, text, public.app_language, jsonb, text, boolean);

create function public.register_for_event(
  p_event_id uuid,
  p_full_name text,
  p_email text,
  p_language public.app_language,
  p_answers jsonb,
  p_ticket_code text,
  p_consent boolean,
  p_guest_names text[] default '{}',
  p_guest_ticket_codes text[] default '{}'
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
  v_guest_id uuid;
  v_guests integer := coalesce(array_length(p_guest_names, 1), 0);
  v_party integer;
  v_fits boolean;
  v_status public.registration_status;
begin
  v_party := 1 + v_guests;
  if v_guests <> coalesce(array_length(p_guest_ticket_codes, 1), 0) then
    return query select null::uuid, 'bad_request'; return;
  end if;

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
  if v_party > v_event.max_group_size then
    return query select null::uuid, 'too_many_guests'; return;
  end if;

  -- Cukup kursi untuk seluruh rombongan? Kalau tidak: daftar tunggu (kalau aktif),
  -- atau ditolak dengan alasan "penuh" / "kursi tidak cukup".
  v_fits := v_event.seats_taken + v_party <= v_event.capacity;
  if not v_fits and not v_event.waitlist_enabled then
    if v_event.seats_taken >= v_event.capacity then
      return query select null::uuid, 'sold_out'; return;
    end if;
    return query select null::uuid, 'not_enough_seats'; return;
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

  v_status := case when v_fits then 'registered'::public.registration_status else 'waitlisted'::public.registration_status end;

  -- Pendaftar utama.
  insert into public.registrations (
    event_id, org_id, full_name, email, language, answers, ticket_code, consent_at, status
  ) values (
    p_event_id, v_event.org_id, p_full_name, p_email, p_language, coalesce(p_answers, '{}'::jsonb),
    p_ticket_code, case when p_consent then now() end, v_status
  )
  returning id into v_reg_id;
  if v_fits then
    insert into public.email_jobs (org_id, registration_id, kind) values (v_event.org_id, v_reg_id, 'ticket');
  else
    insert into public.email_jobs (org_id, registration_id, kind) values (v_event.org_id, v_reg_id, 'waitlist');
  end if;

  -- Tamu: nama sendiri, email sama, tiket sendiri. Jawaban formulir hanya milik pendaftar utama.
  for i in 1..v_guests loop
    insert into public.registrations (
      event_id, org_id, full_name, email, language, answers, ticket_code, consent_at, status, group_id
    ) values (
      p_event_id, v_event.org_id, p_guest_names[i], p_email, p_language, '{}'::jsonb,
      p_guest_ticket_codes[i], case when p_consent then now() end, v_status, v_reg_id
    )
    returning id into v_guest_id;
    if v_fits then
      insert into public.email_jobs (org_id, registration_id, kind) values (v_event.org_id, v_guest_id, 'ticket');
    end if;
  end loop;

  if v_fits then
    update public.events set seats_taken = seats_taken + v_party where id = p_event_id;
  end if;

  return query select v_reg_id, null::text;
end;
$$;
revoke execute on function public.register_for_event(uuid, text, text, public.app_language, jsonb, text, boolean, text[], text[]) from public, anon, authenticated;

-- Naik dari daftar tunggu, sekarang per rombongan: satu rombongan hanya naik
-- kalau kursinya cukup untuk semua anggotanya yang masih menunggu. Urutan tetap
-- adil: kalau rombongan terdepan belum muat, yang di belakangnya tidak menyalip.
create or replace function public.promote_waitlist(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_group uuid;
  v_size integer;
  v_count integer := 0;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status = 'draft' or v_event.ends_at < now() then
    return 0;
  end if;

  loop
    v_group := null;
    select coalesce(r.group_id, r.id) into v_group
      from public.registrations r
     where r.event_id = p_event_id and r.status = 'waitlisted'
     order by r.created_at, r.id
     limit 1;
    exit when v_group is null;

    select count(*) into v_size
      from public.registrations r
     where r.event_id = p_event_id and r.status = 'waitlisted'
       and (r.id = v_group or r.group_id = v_group);
    exit when v_event.seats_taken + v_size > v_event.capacity;

    insert into public.email_jobs (org_id, registration_id, kind)
    select v_event.org_id, r.id, 'ticket'
      from public.registrations r
     where r.event_id = p_event_id and r.status = 'waitlisted'
       and (r.id = v_group or r.group_id = v_group);
    update public.registrations r set status = 'registered', updated_at = now()
     where r.event_id = p_event_id and r.status = 'waitlisted'
       and (r.id = v_group or r.group_id = v_group);
    update public.events set seats_taken = seats_taken + v_size where id = p_event_id;

    v_event.seats_taken := v_event.seats_taken + v_size;
    v_count := v_count + v_size;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.promote_waitlist(uuid) from public, anon, authenticated;
