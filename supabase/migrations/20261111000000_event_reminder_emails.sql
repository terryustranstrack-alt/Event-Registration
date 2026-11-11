-- ---------------------------------------------------------------------------
-- Email pengingat sehari sebelum acara (v1.1).
--
-- Pengingat masuk ke antrean email yang sama dengan tiket, jadi ikut dapat
-- percobaan ulang otomatis kalau pengirimannya gagal.
-- ---------------------------------------------------------------------------

-- Izinkan jenis email baru: 'reminder'.
alter table public.email_jobs drop constraint email_jobs_kind_check;
alter table public.email_jobs
  add constraint email_jobs_kind_check check (kind in ('ticket', 'invitation', 'reminder'));

-- Setiap pendaftar paling banyak dapat satu pengingat per pendaftaran,
-- walaupun tugas hariannya jalan dua kali.
create unique index email_jobs_one_reminder_per_registration
  on public.email_jobs (registration_id)
  where kind = 'reminder';

-- Masukkan pengingat ke antrean untuk acara yang mulai 12–36 jam lagi.
-- Tugas ini jalan sekali sehari, jadi jendela 24 jam ini memastikan setiap
-- acara tertangkap tepat satu kali, kira-kira sehari sebelum mulai.
-- Yang dilewati: pendaftaran yang dibatalkan, sudah dianonimkan, sudah
-- check-in, acara draf, dan organisasi yang sedang ditangguhkan.
create or replace function public.queue_event_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.email_jobs (org_id, registration_id, kind)
  select r.org_id, r.id, 'reminder'
    from public.registrations r
    join public.events e on e.id = r.event_id
    join public.organizations o on o.id = r.org_id
   where r.status = 'registered'
     and r.anonymized_at is null
     and r.checked_in_at is null
     and e.status <> 'draft'
     and o.status = 'active'
     and e.starts_at > now() + interval '12 hours'
     and e.starts_at <= now() + interval '36 hours'
  on conflict (registration_id) where kind = 'reminder' do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.queue_event_reminders() from public, anon, authenticated;
