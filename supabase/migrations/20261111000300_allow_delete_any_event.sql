-- Admin sekarang boleh menghapus acara apa pun (bukan hanya draf).
-- Pendaftar, check-in, email, dan pertanyaan formulir acara itu ikut terhapus
-- otomatis. Di aplikasi, penghapusan selalu lewat konfirmasi dua langkah.
drop policy if exists events_admin_delete on public.events;
create policy events_admin_delete on public.events for delete to authenticated
  using (public.is_org_admin(org_id));
