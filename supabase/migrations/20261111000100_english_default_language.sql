-- Bahasa bawaan sekarang Inggris di seluruh situs, termasuk di database.
-- Hanya berlaku untuk data baru yang tidak menyebut bahasa; organisasi dan
-- pendaftar yang sudah ada tetap memakai bahasa pilihan mereka.
alter table public.organizations alter column default_language set default 'en';
alter table public.registrations alter column language set default 'en';
