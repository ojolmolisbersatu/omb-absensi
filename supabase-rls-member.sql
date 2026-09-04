-- ============================================================
-- OMB ABSENSI V1 — RLS untuk halaman absensi member (tanpa login)
-- Jalankan di Supabase SQL Editor. Tidak mengubah policy admin yang sudah ada.
-- ============================================================

-- 1) View publik terbatas untuk pencarian member.
--    Hanya kolom yang perlu untuk pencarian & tampilan, TANPA data
--    domisili/motor/aplikasi_ojol dsb yang tidak perlu diekspos publik.
create or replace view public.anggota_omb_public as
select id, nama, nama_panggilan, id_anggota, status
from public.anggota_omb
where status = 'Aktif';

grant select on public.anggota_omb_public to anon;

-- 2) Anon boleh baca event & session yang statusnya 'active' saja
--    (supaya halaman absensi bisa menampilkan info sesi & validasi radius).
alter table public.events enable row level security;
alter table public.event_sessions enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "anon_select_active_events" on public.events;
create policy "anon_select_active_events" on public.events
for select to anon
using (status = 'active');

drop policy if exists "anon_select_active_sessions" on public.event_sessions;
create policy "anon_select_active_sessions" on public.event_sessions
for select to anon
using (status = 'active');

grant select on public.events to anon;
grant select on public.event_sessions to anon;

-- 3) Anon boleh INSERT ke attendance (submit absensi), tidak boleh update/delete/select.
drop policy if exists "anon_insert_attendance" on public.attendance;
create policy "anon_insert_attendance" on public.attendance
for insert to anon
with check (true);

grant insert on public.attendance to anon;

-- 4) Admin (authenticated + role admin) perlu SELECT ke attendance untuk halaman
--    "Lihat Kehadiran" di admin. Pola ini mengikuti konsep yang sudah dipakai
--    project ini: session.user.app_metadata.role === 'admin'.
--    Sesuaikan nama policy/kondisi ini jika pola RLS admin kamu berbeda.
drop policy if exists "admin_select_attendance" on public.attendance;
create policy "admin_select_attendance" on public.attendance
for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.attendance to authenticated;

-- Catatan:
-- - Policy admin yang sudah ada (untuk role authenticated/admin) TIDAK disentuh oleh script ini.
-- - Jika RLS di tabel events/event_sessions/attendance SUDAH aktif sebelumnya dengan
--   policy lain untuk admin, policy anon di atas akan berjalan BERDAMPINGAN (bukan menggantikan).
-- - anon TIDAK diberi izin SELECT ke attendance, jadi member tidak bisa melihat data
--   absensi member lain lewat anon key.
