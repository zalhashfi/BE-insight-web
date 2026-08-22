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

## Deployment (Hostinger Shared / Cloud Hosting)

Backend ini berjalan sebagai **Node.js App** di Hostinger (Express.js + Pure SQL / `mysql2`), bukan Cloudflare Workers. Panduan lengkap ada di [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md). Ringkasannya:

1. **Upload source code** ke folder *Application Root* (mis. `domains/namadomain.com/backend`) via Git/File Manager/FTP.
2. **Build command:**
   ```bash
   npm install
   npm run build   # tsc -> output ke folder dist/
   ```
3. **Publish / Build directory:** `dist` (hasil compile `src/` → `dist/`).
4. **Application startup file:** `dist/index.js`
5. **Menjalankan:** `npm start` (menjalankan `node dist/index.js`), atau tombol **Restart** di menu Node.js hPanel.
6. **Environment config** — buat file `.env` di root proyek (lihat `.env.example`):
   ```env
   PORT=3000
   NODE_ENV=production
   DB_HOST=localhost
   DB_USER=u1234567_dbuser
   DB_PASSWORD=PasswordKuatDB123!
   DB_NAME=u1234567_insight_db
   DB_PORT=3306
   JWT_SECRET=rahasia_jwt_produksi_sangat_panjang_dan_aman
   IOT_DEVICE_SECRET=rahasia_iot_device_shared_key
   ```
7. **Verifikasi:** `curl https://api.namadomain.com/health` harus mengembalikan `{"status":"ok","timestamp":"..."}`.

## Konfigurasi Database
Aplikasi terhubung langsung ke MySQL di Hostinger via `mysql2/promise` (lihat `src/db/`). Semua query ditulis dengan *Pure SQL* (tanpa ORM). Inisialisasi tabel via `npm run db:init` (menjalankan `src/db/init.ts`).
