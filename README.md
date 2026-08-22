# Insight Laboratory - Backend (BE-insight-web)

RESTful API backend untuk ekosistem monitoring lingkungan IoT "Biru Langit"
(AQMS = Air Quality Monitoring System, SOC = Soil/Water Quality Monitoring).

Menerima telemetri sensor mentah dari mikrokontroler **ESP32**, menyajikannya ke
dashboard web, menangani autentikasi user, dan menyediakan pembaruan firmware
**OTA** (Over-The-Air).

## Tech Stack

- **Runtime:** Node.js (ESM)
- **Framework:** Express.js 4
- **Bahasa:** TypeScript
- **Database:** MySQL (Hostinger Shared Hosting) via `mysql2/promise` — **Pure SQL, tanpa ORM**
- **Auth:** JWT (`jsonwebtoken`) di header `Authorization: Bearer <token>`, `bcryptjs`, validasi manual (tanpa zod)
- **Test:** Vitest + Supertest

## Arsitektur

```
Perangkat IoT (ESP32)
   │  header: x-device-secret / x-api-key (uuid)
   ▼
┌──────────────────────────────────────────────────────┐
│  BE-insight-web (Express.js, Node.js)                 │
│                                                        │
│  /api/iot      → identity, ingest, ota   (secret/api-key)
│  /api/auth     → register, login, /me     (bebas / JWT)
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

- **Cold path:** tiap payload disimpan mentah di `raw_data_log`, lalu di-parse ke
  `aqms_reading` / `soc_reading` berdasarkan `device.type`.
- **Auth & role:** user memiliki role `admin` / `viewer`; endpoint `/api/devices`
  dan `/api/firmware` dilindungi `requireAdmin`.
- **Device identity:** perangkat mengenali diri via `POST /api/iot/identity`
  (`x-device-secret` + `mac_address`); mengirim data via `POST /api/iot/ingest`
  (`x-api-key` = device uuid); mengecek OTA via `GET /api/iot/ota`.
- **OTA:** `GET /api/iot/ota` membandingkan `current_version` perangkat dengan rilis
  terbaru per `project_name` dan mengembalikan `bin_file_url` bila ada update.

## Struktur Direktori

- `src/index.ts` - Entry point, mount router & middleware
- `src/db/pool.ts` - MySQL connection pool (`mysql2/promise`)
- `src/db/schema.sql` - Skema database (Pure SQL)
- `src/db/init.ts` - Inisialisasi skema dari `schema.sql` (`npm run db:init`)
- `src/middleware/auth.ts` - `authenticateJWT`, `requireAdmin`
- `src/routes/`
  - `iot.ts` - identity, ingest, ota (endpoint perangkat)
  - `auth.ts` - register, login, `/me`
  - `data.ts` - query riwayat telemetri per device (`aqms`/`soc`)
  - `devices.ts` - CRUD perangkat (admin) + daftar `unregistered_device`
  - `firmware.ts` - CRUD rilis firmware OTA (admin)
- `tests/app.test.ts` - integration test (Vitest + Supertest)

## Environment Variables

Salin `.env.example` ke `.env` dan isi nilainya. Semua variabel dibaca di
`src/index.ts`, `src/db/pool.ts`, `src/routes/iot.ts`, dan `src/middleware/auth.ts`.

| Variabel           | Wajib | Default            | Deskripsi                                                                 |
|--------------------|-------|--------------------|---------------------------------------------------------------------------|
| `PORT`             | tidak | `3000`             | Port TCP tempat Express mendengarkan.                                      |
| `NODE_ENV`         | tidak | `development`      | Environment aplikasi. Set `production` di Hostinger. Saat `test`, server tidak auto-listen. |
| `DB_HOST`          | tidak | `localhost`        | Host MySQL (Hostinger: `localhost` untuk DB di server yang sama).         |
| `DB_USER`          | tidak | `root`             | Username MySQL.                                                            |
| `DB_PASSWORD`      | tidak | `''` (kosong)      | Password MySQL. **Wajib diisi kuat di production.**                       |
| `DB_NAME`          | tidak | `insight_web_db`   | Nama database MySQL.                                                       |
| `DB_PORT`          | tidak | `3306`             | Port MySQL.                                                                |
| `JWT_SECRET`       | ya*   | `secret` (fallback)| Secret untuk sign/verify JWT. **Wajib diisi nilai acak panjang di production.** Bila kosong, kode fallback ke `'secret'` (tidak aman). |
| `IOT_DEVICE_SECRET`| ya*   | — (kosong)         | Shared secret yang dikirim device di header `x-device-secret` pada `POST /api/iot/identity`. Bila kosong, tidak ada device yang bisa autentikasi. |

\* `JWT_SECRET` dan `IOT_DEVICE_SECRET` punya fallback/perilaku tidak aman bila kosong;
selalu isi keduanya di deployment nyata.

## Database Setup

1. Buat database MySQL di Hostinger (atau lokal).
2. Jalankan skema sekali:
   ```bash
   npm run db:init
   ```
   Menjalankan `src/db/schema.sql` (membuat tabel: `user`, `device`,
   `unregistered_device`, `raw_data_log`, `aqms_reading`, `soc_reading`,
   `firmware_release`).

## Instalasi & Menjalankan (Development)

```bash
# Install dependencies
npm install

# Setup environment (edit .env)
cp .env.example .env

# Inisialisasi skema DB (pertama kali / setelah perubahan skema)
npm run db:init

# Menjalankan server lokal dengan hot reload
npm run dev

# Production build + start
npm run build
npm start
```

## Authentication Model

Ada **tiga** batas trust, masing-masing dengan kredensial sendiri:

1. **User JWT** — user dashboard. Diperoleh via `POST /api/auth/login`, lalu kirim
   `Authorization: Bearer <token>` di route yang dilindungi.
2. **Device API key** — `uuid` device dikirim di header `x-api-key` untuk
   `POST /api/iot/ingest` dan `GET /api/iot/ota`.
3. **Device shared secret** — dikirim di header `x-device-secret` pada
   `POST /api/iot/identity` (satu key bersama dari `IOT_DEVICE_SECRET`).

Route khusus admin juga mewajibkan JWT user memiliki `role = 'admin'`.

## API Endpoints

Base path route versi adalah `/api`. Health check penuh ada di root.

### Health
| Method | Path       | Auth | Tujuan                                                    |
|--------|------------|------|-----------------------------------------------------------|
| GET    | `/health`  | none | Liveness check. Mengembalikan `{ status: "ok", timestamp }`. |

### Endpoint perangkat IoT — di-mount di `/api/iot`
| Method | Path                 | Auth header        | Tujuan                                                                                  |
|--------|----------------------|--------------------|-----------------------------------------------------------------------------------------|
| POST   | `/api/iot/identity`  | `x-device-secret`  | Device boot: kirim `mac_address`, dapat `{ uuid, type, project_name }`. 401 bila secret salah; 404 bila MAC belum terdaftar. |
| POST   | `/api/iot/ingest`    | `x-api-key` (=uuid)| Terima JSON sensor. Disimpan mentah di `raw_data_log` lalu di-parse ke `aqms_reading`/`soc_reading` berdasar `type`. |
| GET    | `/api/iot/ota`       | `x-api-key` (=uuid)| Cek OTA. Query `?current_version=`. Mengembalikan `update_available`, `latest_version`, `bin_file_url` bila ada rilis lebih baru untuk project device. |

### Auth & manajemen user — di-mount di `/api/auth`
| Method | Path                 | Auth        | Tujuan                                                                          |
|--------|----------------------|-------------|---------------------------------------------------------------------------------|
| POST   | `/api/auth/register` | none        | Daftar user. Body: `name, email, password, role` (`role` default `viewer`; hanya `admin`/`viewer`). |
| POST   | `/api/auth/login`    | none        | Autentikasi. Body: `email, password`. Mengembalikan `{ token, user }`.         |
| GET    | `/api/auth/me`       | JWT         | Kembalikan user yang sedang terautentikasi dari token.                          |

### Query data sensor — di-mount di `/api/data` (wajib JWT)
| Method | Path                                           | Auth | Tujuan                                                                                              |
|--------|------------------------------------------------|------|-----------------------------------------------------------------------------------------------------|
| GET    | `/api/data/devices/:uuid/data/:sensorType`     | JWT  | Query reading device. `:sensorType` ∈ `aqms` \| `soc`. Query: `start_time`, `end_time`, `limit` (maks 1000, default 100). Returns `{ device_uuid, sensor_type, total_records, data }`. |

### Manajemen device (dashboard) — di-mount di `/api/devices` (wajib admin)
| Method | Path                          | Auth   | Tujuan                                                                       |
|--------|-------------------------------|--------|------------------------------------------------------------------------------|
| GET    | `/api/devices`                | admin  | List semua device aktif. Query opsional: `?type=`, `?project_name=`.         |
| GET    | `/api/devices/unregistered`   | admin  | List device yang terlihat via `/identity` tapi belum terdaftar.              |
| GET    | `/api/devices/:uuid`          | admin  | Detail device + jumlah `total_logs` dan `total_readings`.                   |
| POST   | `/api/devices`                | admin  | Daftar device. Body: `uuid, mac_address, name, type` (`aqms`\|`soc`), `project_name`. Menghapus entri unregistered. |
| PUT    | `/api/devices/:uuid`          | admin  | Update `name`, `type`, dan/atau `project_name`.                             |
| DELETE | `/api/devices/:uuid`          | admin  | Soft delete: set `is_deleted = TRUE` (query memfilternya).                 |

### Manajemen firmware (OTA) — di-mount di `/api/firmware` (wajib admin)
| Method | Path                                | Auth   | Tujuan                                                                   |
|--------|-------------------------------------|--------|--------------------------------------------------------------------------|
| GET    | `/api/firmware`                     | admin  | List semua rilis firmware (terbaru dulu).                               |
| GET    | `/api/firmware/:projectName/latest` | admin  | Rilis terbaru untuk project; 404 bila kosong.                          |
| POST   | `/api/firmware`                     | admin  | Buat rilis. Body: `project_name, version, bin_file_url, changelog?`. 409 bila `(project_name, version)` sudah ada. |

## Deployment (Hostinger Shared / Cloud Hosting)

Panduan lengkap ada di `HOSTINGER_DEPLOYMENT.md`. Ringkasnya:

1. **Database MySQL** — di hPanel buat database + user, lalu import `src/db/schema.sql` via phpMyAdmin.
2. **Node.js App** — di hPanel buat aplikasi Node.js:
   - Application root: folder tempat file di-upload (mis. `domains/namadomain.com/backend`)
   - Application startup file: `dist/index.js` (hasil `npm run build`)
   - Application mode: `Production`
3. **Upload & build** — upload source, buat `.env` dengan kredensial Hostinger
   (`NODE_ENV=production`, `DB_HOST=localhost`, `DB_USER`/`DB_PASSWORD`/`DB_NAME` sesuai DB,
   plus `JWT_SECRET` & `IOT_DEVICE_SECRET` yang kuat), lalu:
   ```bash
   npm install
   npm run build
   ```
4. **Restart & verifikasi** — klik Restart, lalu:
   ```bash
   curl https://api.namadomain.com/health
   # {"status":"ok","timestamp":"..."}
   ```
5. **Cron cleanup** — jalankan tiap hari untuk membuang `unregistered_device` lebih dari 24 jam:
   ```bash
   mysql -u <dbuser> -p'<dbpass>' -e "DELETE FROM <dbname>.unregistered_device WHERE last_seen_at < NOW() - INTERVAL 1 DAY;"
   ```

## Notes

- **Dual-path storage:** tiap ingest menulis JSON mentah ke `raw_data_log` (audit/debug)
  dan nilai ter-parse ke tabel reading sesuai tipe.
- **Manual UUID:** UUID device ditetapkan saat registrasi, bukan di-generate server.
- Lihat `HOSTINGER_DEPLOYMENT.md` untuk walkthrough deploy lengkap dan cron job
  pembersih `unregistered_device` (lebih dari 24 jam).
