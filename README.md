# Insight Laboratory - Backend

Sistem API dan backend untuk platform monitoring perangkat IoT "Biru Langit".

## Teknologi Utama
- **Framework:** Hono
- **Runtime & Deployment:** Cloudflare Workers (Edge Computing)
- **Database:** MySQL melalui Hyperdrive & Drizzle ORM
- **Keamanan:** JWT via HttpOnly Cookies, bcryptjs, Zod Validation

## Struktur Direktori
- `src/index.ts` - Entry point dan registrasi middlewares/router
- `src/db/` - Skema database (Drizzle ORM) dan inisialisasi koneksi
- `src/routes/` - Router untuk berbagai endpoint:
  - `auth.ts` - Login, logout
  - `data.ts` - Pengambilan riwayat telemetri sensor (Aqms & Soc) dengan opsi agregasi
  - `iot.ts` - Endpoint *ingestion* untuk perangkat IoT mengirim data sensor
  - `stations.ts` - Manajemen alat/stasiun dan pendaftaran perangkat baru
  - `users.ts` - Manajemen pengguna (Admin, Engineer, User)
  - `tickets.ts` - Manajemen *maintenance* tiket alat
  - `firmware.ts` - Manajemen rilis firmware (OTA)
  - `logs.ts` - Penyimpanan log alat IoT mentah

## Instalasi & Menjalankan (Development)
```bash
# Install dependencies
npm install

# Setup env variables
# Copy .dev.vars.example ke .dev.vars dan isikan konfigurasi DB & JWT Secret

# Menjalankan server lokal via Wrangler
npm run dev
```

## Konfigurasi Database (Hyperdrive)
Aplikasi ini di-desain untuk berjalan pada jaringan Cloudflare dengan *connection pooling* via Hyperdrive ke *database* MySQL eksternal (contoh: Neon atau layanan DB konvensional lainnya). Semua migrasi tabel di-*handle* via skema Drizzle ORM yang terdapat pada `src/db/schema.ts`.
