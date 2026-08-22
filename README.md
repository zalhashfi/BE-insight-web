# Insight Laboratory - Backend

Backend API untuk platform monitoring perangkat IoT "Biru Langit" (Insight Laboratory). Menerima data telemetri dari perangkat **AQMS** (kualitas udara) dan **SOC** (tanah/sol), menyediakan autentikasi, manajemen perangkat, query data sensor, dan distribusi firmware **OTA**.

## Teknologi Utama
- **Runtime:** Node.js (ESM)
- **Framework:** Express.js 4
- **Bahasa:** TypeScript
- **Database:** MySQL (Hostinger Shared Hosting) via `mysql2/promise` — **Pure SQL, tanpa ORM**
- **Keamanan:** JWT (`jsonwebtoken`) via HttpOnly cookie, `bcryptjs`, validasi `zod`
- **Test:** Vitest + Supertest

## Arsitektur

```
Perangkat IoT (ESP32)
   │  header: x-device-secret / x-api-key
   ▼
┌──────────────────────────────────────────────────────┐
│  BE-insight-web (Express.js, Node.js)                 │
│                                                        │
│  /api/iot      → identity, ingest, ota   (secret/api-key)
│  /api/auth     → register, login, /me                   │
│  /api/data     → query telemetri sensor    (JWT)        │
│  /api/devices  → CRUD perangkat            (admin)      │
│  /api/firmware → CRUD rilis OTA            (admin)      │
└──────────────────────────────────────────────────────┘
   │  mysql2 connection pool (parameterized query)
   ▼
MySQL (Hostinger) — skema Pure SQL di src/db/schema.sql
   device · raw_data_log · aqms_reading · soc_reading
   firmware_release · unregistered_device · user
```

- **Cold path:** tiap payload disimpan mentah di `raw_data_log`, lalu di-parse ke `aqms_reading` / `soc_reading` berdasarkan `device.type`.
- **Auth & role:** user memiliki role `admin` / `user`; endpoint `/api/devices` dan `/api/firmware` dilindungi `requireAdmin`.
- **Device identity:** perangkat mengenali diri via `POST /api/iot/identity` (`x-device-secret` + `mac_address`); mengirim data via `POST /api/iot/ingest` (`x-api-key` = device uuid); mengecek OTA via `GET /api/iot/ota`.
- **OTA:** `GET /api/iot/ota` membandingkan `current_version` perangkat dengan rilis terbaru per `project_name` dan mengembalikan `bin_file_url` bila ada update.

## Struktur Direktori
- `src/index.ts` - Entry point, mount router & middleware
- `src/db/pool.ts` - MySQL connection pool (`mysql2/promise`)
- `src/db/schema.sql` - Skema database (Pure SQL)
- `src/db/init.ts` - Inisialisasi/migrasi skema dari `schema.sql`
- `src/middleware/auth.ts` - `authenticateJWT`, `requireAdmin`
- `src/routes/`
  - `iot.ts` - identity, ingest, ota (endpoint perangkat)
  - `auth.ts` - register, login, `/me`
  - `data.ts` - query riwayat telemetri per device (`aqms`/`soc`)
  - `devices.ts` - CRUD perangkat (admin) + daftar `unregistered_device`
  - `firmware.ts` - CRUD rilis firmware OTA (admin)
- `tests/app.test.ts` - integration test (Vitest + Supertest)

## Instalasi & Menjalankan (Development)
```bash
# Install dependencies
npm install

# Setup env variables
cp .env.example .env   # isi DB_HOST/USER/PASSWORD/NAME & JWT_SECRET, IOT_DEVICE_SECRET

# Inisialisasi skema di MySQL
npm run db:init

# Menjalankan server lokal (tsx watch)
npm run dev
```

## Konfigurasi Database (Hostinger MySQL)
Aplikasi berjalan di **Hostinger Shared Hosting** dengan MySQL. Koneksi menggunakan `mysql2` connection pool dengan *parameterized query* (aman dari SQL injection). Skema dikelola langsung via `src/db/schema.sql` + `npm run db:init` — tidak ada ORM maupun migration tool terpisah.
