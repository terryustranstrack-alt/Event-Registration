-- Gambar kedua untuk acara, ditampilkan di bagian "Tentang acara ini"
-- (di atas deskripsi). Boleh kosong; acara lama tidak berubah.
alter table public.events add column if not exists about_image_url text;
