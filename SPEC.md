# Technical Specification (SPEC.md)

## 1. Database Schema (MySQL Pure SQL)

```sql
-- 1. Device Table
CREATE TABLE IF NOT EXISTS device (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(64) UNIQUE NOT NULL,
    mac_address VARCHAR(17) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('aqms', 'soc') NOT NULL,
    project_name VARCHAR(100) NOT NULL,
    current_version VARCHAR(30) DEFAULT '1.0.0',
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
    temperature DECIMAL(4,1),
    humidity DECIMAL(4,1),
    ws DECIMAL(5,1),
    wd DECIMAL(5,1),
    measured_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE CASCADE
);
CREATE INDEX idx_aqms_device_time ON aqms_reading(device_id, measured_at DESC);

-- 4. SOC Reading (Hot Path)
CREATE TABLE IF NOT EXISTS soc_reading (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    ph DECIMAL(3,2),
    no2 DECIMAL(5,2),
    ec DECIMAL(6,1),
    temperature DECIMAL(4,1),
    humidity DECIMAL(4,1),
    n DECIMAL(5,2),
    p DECIMAL(5,2),
    k DECIMAL(5,2),
    measured_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE CASCADE
);
CREATE INDEX idx_soc_device_time ON soc_reading(device_id, measured_at DESC);

-- 5. Firmware Release
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
    role ENUM('admin', 'viewer') DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. API Endpoints

### A. IoT Device Endpoints (`/api/iot`)
1. `POST /api/iot/identity`
   - Headers: `x-device-secret: <SECRET>`
   - Body: `{"mac_address": "AA:BB:CC:DD:EE:FF"}`
   - Action: Validasi secret, cek tabel `device`. Bila ditemukan kembalikan `{uuid, type, project_name}`. Bila tidak ada, upsert ke `unregistered_device` dan kembalikan 404.
2. `POST /api/iot/ingest`
   - Headers: `x-api-key: <UUID>`
   - Body: JSON data payload
   - Action: Validasi device aktif via `uuid`. Masukkan raw payload ke `raw_data_log`. Parse sesuai `type` (`aqms` / `soc`), simpan ke tabel reading yang sesuai.
3. `GET /api/iot/ota`
   - Headers: `x-api-key: <UUID>`
   - Query: `?current_version=1.0.0`
   - Action: Update `current_version` di `device` jika beda. Cek rilis firmware terbaru untuk `project_name`. Kembalikan URL binary jika ada update baru.

### B. Hot Path Sensor Data Query (`/api/devices`)
1. `GET /api/devices/:uuid/data/:sensorType`
   - Params: `uuid`, `sensorType` (`aqms` | `soc`)
   - Query: `?start_time=ISO&end_time=ISO&limit=100`
   - Action: Ambil data sensor terstruktur dari tabel yang bersesuaian.

### C. Auth & User Management (`/api/auth`)
1. `POST /api/auth/register` (Admin / Initial Setup)
2. `POST /api/auth/login` (Returns JWT token)
3. `GET /api/auth/me` (Auth Bearer header)

### D. Device Management Dashboard (`/api/devices`)
1. `GET /api/devices` (List semua device aktif)
2. `POST /api/devices` (Register device baru dengan manual UUID)
3. `GET /api/devices/unregistered` (List MAC address yang menunggu aktivasi)
4. `GET /api/devices/:uuid` (Detail status & info device)
5. `PUT /api/devices/:uuid` (Update metadata device)
6. `DELETE /api/devices/:uuid` (Soft delete `is_deleted = TRUE`)

### E. Firmware Release Management (`/api/firmware`)
1. `GET /api/firmware` (List semua release)
2. `POST /api/firmware` (Buat release baru)
