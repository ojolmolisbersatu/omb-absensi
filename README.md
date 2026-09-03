# OMB ABSENSI V1 — Admin Dashboard

Frontend static untuk GitHub Pages menggunakan **HTML, CSS, Vanilla JavaScript, Supabase JS v2**.

## Struktur
```text
omb-absensi-admin-v1/
├── index.html
├── README.md
├── supabase.js
├── admin/
│   ├── login.html
│   ├── index.html
│   ├── events.html
│   └── sessions.html
├── css/style.css
└── js/
    ├── auth.js
    ├── dashboard.js
    ├── events.js
    └── sessions.js
```

## 1. Konfigurasi Supabase
Buka `supabase.js` dan isi:
```js
const SUPABASE_URL = "https://PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_ANON_OR_PUBLISHABLE_KEY";
```
Gunakan **anon/publishable key** saja. Jangan pernah memasukkan `service_role key`.

## 2. Menjalankan lokal
Karena ini website static, jalankan melalui local server, misalnya VS Code Live Server atau:
```bash
python -m http.server 8080
```
Lalu buka `http://localhost:8080`.

## 3. Upload ke GitHub Pages
1. Buat repository GitHub baru.
2. Upload seluruh isi folder ini ke root repository.
3. Commit dan push.
4. Buka **Settings → Pages**.
5. Pada Source pilih **Deploy from a branch**.
6. Pilih branch `main` dan folder `/ (root)`.
7. Save.
8. Buka URL GitHub Pages yang diberikan GitHub.

## 4. Login Admin
Akun harus:
- dibuat di Supabase Auth dengan email/password;
- memiliki `app_metadata.role = "admin"`.

Website memeriksa session dan role admin pada setiap halaman admin. Jika bukan admin, user akan sign out dan kembali ke login.

## 5. Membuat Event
1. Login admin.
2. Buka **Event Manager**.
3. Isi Nama Event, Tanggal, lokasi dan data lain.
4. Pilih status `draft` atau langsung `active`.
5. Klik **SIMPAN EVENT**.

## 6. Membuat Session
1. Dari Event Manager klik **Kelola Sesi**.
2. URL akan berbentuk `sessions.html?event=123`.
3. Isi nama session, contoh `Absensi Berangkat`.
4. Isi waktu mulai dan selesai.
5. Isi lokasi, koordinat, radius, dan status.
6. Klik **SIMPAN SESSION**.

## Catatan RLS
Project ini tidak mengubah RLS. Semua akses database tetap bergantung pada kebijakan RLS Supabase yang sudah Anda buat. Jika query gagal dengan pesan permission denied/RLS, periksa policy tabel untuk role admin.

## Tabel yang digunakan
- `public.anggota_omb` (read dashboard saja)
- `public.events`
- `public.event_sessions`
- `public.attendance` (read dashboard saja)

Tidak ada tabel baru dan tidak ada bypass RLS.
