# Technical Specification (SPEC.md)

## 1. Database Schema (MySQL Pure SQL)

```sql
-- 1. Device Table
CREATE TABLE IF NOT EXISTS device (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(64) UNIQUE NOT NULL,
    mac_address VARCHAR(17) UNIQUE NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('aqms') NOT NULL,
    project_name VARCHAR(100) NOT NULL,
    current_version VARCHAR(30) DEFAULT '1.0.0',
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    last_seen_at TIMESTAMP NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Raw Data Log (Cold Path)
CREATE TABLE IF NOT EXISTS raw_data_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    payload JSON NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE CASCADE
);
CREATE INDEX idx_raw_device_time ON raw_data_log(device_id, received_at DESC);

-- 3. AQMS Reading (Hot Path)
CREATE TABLE IF NOT EXISTS aqms_reading (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    pm25 DECIMAL(5,2),
    no2 DECIMAL(5,2),
    co DECIMAL(5,2),
    co2 DECIMAL(6,2),
    temperature DECIMAL(4,1),
    humidity DECIMAL(4,1),
    ws DECIMAL(5,1),
    wd DECIMAL(5,1),
    measured_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE CASCADE
);
CREATE INDEX idx_aqms_device_time ON aqms_reading(device_id, measured_at DESC);

-- 4. Firmware Release
CREATE TABLE IF NOT EXISTS firmware_release (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    version VARCHAR(30) NOT NULL,
    bin_file_url TEXT NOT NULL,
    changelog TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_project_version (project_name, version)
);
CREATE INDEX idx_firmware_project_time ON firmware_release(project_name, created_at DESC);

-- 6. Unregistered Device
CREATE TABLE IF NOT EXISTS unregistered_device (
    mac_address VARCHAR(17) PRIMARY KEY,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. User & Auth
CREATE TABLE IF NOT EXISTS user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'engineer', 'viewer', 'user') DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. API Endpoints (berversi `/api/v1`; path lama tanpa `/v1` dimatikan — 404)

### A. IoT Device Endpoints (`/api/v1/iot`)
1. `POST /api/v1/iot/identity`
   - Headers: `x-device-secret: <SECRET>`
   - Body: `{"mac_address": "AA:BB:CC:DD:EE:FF"}`
   - Action: Validasi secret, cek tabel `device`. Bila ditemukan kembalikan `{uuid, type, project_name}`. Bila tidak ada, upsert ke `unregistered_device` dan kembalikan 404.
2. `POST /api/v1/iot/ingest`
   - Headers: `x-api-key: <UUID>`
   - Body: JSON data payload
   - Action: Validasi device aktif via `uuid`. Masukkan raw payload ke `raw_data_log`. Parse sesuai `type` (`aqms`), simpan ke tabel `aqms_reading`.
3. `GET /api/v1/iot/ota`
   - Headers: `x-api-key: <UUID>`
   - Query: `?current_version=1.0.0`
   - Action: Update `current_version` di `device` jika beda. Cek rilis firmware terbaru untuk `project_name`. Kembalikan URL binary jika ada update baru.

1. `GET /api/v1/data/devices/:uuid/data/:sensorType`
   - Params: `uuid`, `sensorType` (`aqms` — satu-satunya nilai yang didukung)
   - Query: `?start_time=ISO&end_time=ISO&limit=100`
   - Action: Ambil data sensor terstruktur dari tabel `aqms_reading`.

### C. Auth & User Management (`/api/v1/auth`)
1. `POST /api/v1/auth/register` (Admin / Initial Setup, always writes `viewer`)
2. `POST /api/v1/auth/login` (Returns JWT token; error responses carry both `error` and `message`)
3. `GET /api/v1/auth/me` (Auth Bearer header)
4. `POST /api/v1/auth/logout` → `200 { message: 'Logged out' }` (no auth; FE clears session client-side)

### D. Device Management Dashboard (`/api/v1/devices`)
1. `GET /api/v1/devices` (List semua device aktif)
2. `POST /api/v1/devices` (Register device baru dengan manual UUID)
3. `GET /api/v1/devices/unregistered` (List MAC address yang menunggu aktivasi)
4. `GET /api/v1/devices/:uuid` (Detail status & info device)
5. `PUT /api/v1/devices/:uuid` (Update metadata device)
6. `DELETE /api/v1/devices/:uuid` (Soft delete `is_deleted = TRUE`)

### E. Firmware Release Management (`/api/v1/firmware`)
1. `GET /api/v1/firmware` (List semua release — returns array langsung)
2. `POST /api/v1/firmware` (Buat release baru)

### F. User Management Dashboard (`/api/v1/users`)
1. `GET /api/v1/users` (JWT + admin — returns `{ users: [...] }`)
2. `POST /api/v1/users` (JWT + admin — body `{email,password,fullName|name,role?}`, role default `'user'`)

### G. Response Envelopes & Field Mapping (BE → FE)
| Endpoint | Bentuk respons |
|---|---|
| `GET /api/v1/devices` | `{ devices: [...] }` |
| `GET /api/v1/devices/unregistered` | `{ data: [{macAddress,lastSeenAt}] }` |
| `GET /api/v1/users` | `{ users: [...] }` |
| `GET /api/v1/firmware` | array langsung `[{id,version,url,releaseNotes,createdAt}]` |

| Kolom DB | Field JSON |
|---|---|
| `project_name` | `projectName` |
| `mac_address` | `macAddress` |
| `current_version` | `currentVersion` |
| `last_seen_at` | `lastSeenAt` |
| `created_at` | `createdAt` |
| `name` | `name` + `fullName` (alias ganda) |
| `bin_file_url` | `url` |
| `changelog` | `releaseNotes` |

Role DB: `admin|engineer|viewer|user` (register selalu tulis `viewer`).

### H. Portabilitas Cloudflare (Hyperdrive)
- Satu codebase Hono: `src/app.ts` (`createApp`) tanpa `listen`/env global.
- `src/server-node.ts` (VPS): pool mysql2 + `@hono/node-server`.
- `src/worker.ts` (Cloudflare utama): `createHyperdriveQuery` dari `src/db/hyperdrive.ts` via binding `HYPERDRIVE` (`wrangler.toml`); secret `JWT_SECRET`/`IOT_DEVICE_SECRET` via `wrangler secret put`.
- JWT memakai `jose` (WebCrypto); secret sama dengan produksi lama sehingga token lama tetap valid. `bcryptjs` dipertahankan (hash lama tetap valid).

### I. Migrasi DB Lama (Hostinger — tanpa migration runner)
```sql
ALTER TABLE device MODIFY mac_address VARCHAR(17) NULL; ALTER TABLE device ADD COLUMN latitude DECIMAL(10,7) NULL, ADD COLUMN longitude DECIMAL(10,7) NULL; ALTER TABLE aqms_reading ADD COLUMN co2 DECIMAL(6,2) NULL; ALTER TABLE user MODIFY role ENUM('admin','engineer','viewer','user') DEFAULT 'viewer';
```
