-- ---------------------------------------------------------------------------
-- Daftar tunggu (waitlist), bagian 1: siapkan status dan pengaturannya.
-- (Status baru dipisah ke file sendiri karena Postgres baru bisa memakai
-- nilai baru sebuah daftar pilihan setelah perubahan ini selesai disimpan.)
-- ---------------------------------------------------------------------------

-- Status pendaftaran baru: 'waitlisted' = masuk daftar tunggu, belum dapat kursi/tiket.
alter type public.registration_status add value if not exists 'waitlisted';

-- Penyelenggara memilih per acara apakah daftar tunggu dibuka saat kursi penuh.
alter table public.events add column if not exists waitlist_enabled boolean not null default false;

-- Jenis email baru: 'waitlist' = konfirmasi "Anda masuk daftar tunggu".
alter table public.email_jobs drop constraint email_jobs_kind_check;
alter table public.email_jobs
  add constraint email_jobs_kind_check check (kind in ('ticket', 'invitation', 'reminder', 'waitlist'));
