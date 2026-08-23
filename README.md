# Insight Laboratory - Backend (BE-insight-web)

RESTful API backend for the "Biru Langit" IoT environmental monitoring ecosystem
(AQMS = Air Quality Monitoring System, SOC = Soil/Water Quality Monitoring).

It receives raw sensor telemetry from ESP32 microcontrollers, serves it to the
web dashboard, handles user auth, and provides over-the-air (OTA) firmware updates.

## Tech Stack

- **Framework:** Express.js (Node.js)
- **Runtime & Deployment:** Hostinger Shared/Cloud Hosting (Node.js via PM2/Passenger)
- **Database:** MySQL on Hostinger, accessed with **Pure SQL** via `mysql2/promise`
  (connection pool + parameterized queries — no ORM)
- **Auth:** JWT (Bearer token passed in `Authorization` header), `bcryptjs`, `Zod`-free manual validation

## Environment Variables

Copy `.env.example` to `.env` and fill in values. All vars are read in
`src/index.ts`, `src/db/pool.ts`, and `src/routes/iot.ts` / `src/middleware/auth.ts`.

| Variable            | Required | Default            | Description                                                                 |
|---------------------|----------|--------------------|-----------------------------------------------------------------------------|
| `PORT`              | no       | `3000`             | TCP port the Express server listens on.                                      |
| `NODE_ENV`          | no       | `development`      | App environment. Set to `production` on Hostinger. When `test`, the server does not auto-listen. |
| `DB_HOST`           | no       | `localhost`        | MySQL host (Hostinger: `localhost` for same-server DB).                      |
| `DB_USER`           | no       | `root`             | MySQL username.                                                             |
| `DB_PASSWORD`       | no       | `''` (empty)       | MySQL password. **Set a strong value in production.**                        |
| `DB_NAME`           | no       | `insight_web_db`   | MySQL database name.                                                        |
| `DB_PORT`           | no       | `3306`             | MySQL port.                                                                |
| `JWT_SECRET`        | yes*     | `secret` (fallback)| Secret used to sign/verify JWTs. **Must be set to a long random value in production.** If unset, code falls back to `'secret'` (insecure). |
| `IOT_DEVICE_SECRET` | yes*     | — (none)           | Shared secret that IoT devices send in the `x-device-secret` header on `POST /api/iot/identity`. If unset, no device can authenticate. |

\* `JWT_SECRET` and `IOT_DEVICE_SECRET` have insecure fallbacks/behavior if missing;
always set both in any real deployment.

## Database Setup

1. Create the MySQL database on Hostinger (or locally).
2. Run the schema once:
   ```bash
   npm run db:init
   ```
   This executes `src/db/schema.sql` (creates tables: `user`, `device`,
   `unregistered_device`, `raw_data_log`, `aqms_reading`, `soc_reading`,
   `firmware_release`).

## Installation & Running

```bash
# Install dependencies
npm install

# Configure environment (edit .env)
cp .env.example .env

# Initialize DB schema (first time / after schema changes)
npm run db:init

# Run locally with hot reload
npm run dev

# Production build + start
npm run build
npm start
```

## Authentication Model

There are **three** trust boundaries, each with its own credential:

1. **User JWT** — dashboard users. Obtain via `POST /api/auth/login`, then send
   `Authorization: Bearer <token>` on protected routes.
2. **Device API key** — each device's `uuid` is sent in the `x-api-key` header for
   `POST /api/iot/ingest` and `GET /api/iot/ota`.
3. **Device shared secret** — sent in the `x-device-secret` header on
   `POST /api/iot/identity` (a single shared key from `IOT_DEVICE_SECRET`).

Admin-only routes additionally require the JWT user to have `role = 'admin'`.

## API Endpoints

Base path for versioned routes is `/api`. Full health check is at root.

### Health
| Method | Path       | Auth | Purpose                                  |
|--------|------------|------|------------------------------------------|
| GET    | `/health`  | none | Liveness check. Returns `{ status: "ok", timestamp }`. |

### IoT device endpoints — mounted at `/api/iot`
| Method | Path                  | Auth header        | Purpose                                                                 |
|--------|-----------------------|--------------------|-------------------------------------------------------------------------|
| POST   | `/api/iot/identity`  | `x-device-secret`  | Device boots: send `mac_address`, get back `{ uuid, type, project_name }`. 401 if secret wrong; 404 if MAC not yet registered. |
| POST   | `/api/iot/ingest`    | `x-api-key` (=uuid) | Receive sensor JSON. Stored raw in `raw_data_log` and parsed into `aqms_reading`/`soc_reading` by device `type`. |
| GET    | `/api/iot/ota`       | `x-api-key` (=uuid) | OTA check. Query `?current_version=`. Returns `update_available`, `latest_version`, `bin_file_url` if a newer firmware release exists for the device's project. |

### Auth & user management — mounted at `/api/auth`
| Method | Path               | Auth        | Purpose                                                                 |
|--------|--------------------|-------------|-------------------------------------------------------------------------|
| POST   | `/api/auth/register` | none      | Register a user. Body: `name, email, password, role` (`role` defaults to `viewer`; only `admin`/`viewer` allowed). |
| POST   | `/api/auth/login`  | none        | Authenticate. Body: `email, password`. Returns `{ token, user }`.        |
| GET    | `/api/auth/me`     | JWT         | Return the currently authenticated user from the token.                  |

### Sensor data query — mounted at `/api/data` (JWT required)
| Method | Path                                          | Auth | Purpose                                                                 |
|--------|-----------------------------------------------|------|-------------------------------------------------------------------------|
| GET    | `/api/data/devices/:uuid/data/:sensorType`    | JWT  | Query readings for a device. `:sensorType` ∈ `aqms` \| `soc`. Query params: `start_time`, `end_time`, `limit` (max 1000, default 100). Returns `{ device_uuid, sensor_type, total_records, data }`. |

### Device management (dashboard) — mounted at `/api/devices` (admin required)
| Method | Path                         | Auth        | Purpose                                                                 |
|--------|------------------------------|-------------|-------------------------------------------------------------------------|
| GET    | `/api/devices`              | admin       | List all active devices. Optional query: `?type=`, `?project_name=`.    |
| GET    | `/api/devices/unregistered` | admin       | List devices seen via `/identity` but not yet registered.              |
| GET    | `/api/devices/:uuid`        | admin       | Device detail + `total_logs` and `total_readings` counts.              |
| POST   | `/api/devices`              | admin       | Register a device. Body: `uuid, mac_address, name, type` (`aqms`\|`soc`), `project_name`. Also clears the unregistered entry. |
| PUT    | `/api/devices/:uuid`        | admin       | Update `name`, `type`, and/or `project_name`.                          |
| DELETE | `/api/devices/:uuid`        | admin       | Soft delete: sets `is_deleted = TRUE` (queries filter these out).      |

### Firmware management (OTA) — mounted at `/api/firmware` (admin required)
| Method | Path                              | Auth   | Purpose                                                                 |
|--------|-----------------------------------|--------|-------------------------------------------------------------------------|
| GET    | `/api/firmware`                  | admin  | List all firmware releases (newest first).                              |
| GET    | `/api/firmware/:projectName/latest` | admin | Latest release for a project; 404 if none.                             |
| POST   | `/api/firmware`                  | admin  | Create a release. Body: `project_name, version, bin_file_url, changelog?`. 409 if `(project_name, version)` already exists. |

## Project Layout

- `src/index.ts` — Express app entry point, route mounting, global middleware.
- `src/db/pool.ts` — mysql2 connection pool + `query()` helper.
- `src/db/schema.sql` — SQL schema (tables above).
- `src/db/init.ts` — one-shot schema initializer (`npm run db:init`).
- `src/middleware/auth.ts` — `authenticateJWT` and `requireAdmin`.
- `src/routes/` — route handlers:
  - `auth.ts` — register / login / me
  - `iot.ts` — device identity, ingest, OTA
  - `data.ts` — sensor data query
  - `devices.ts` — device CRUD + unregistered list
  - `firmware.ts` — firmware release CRUD

## Notes

- **Dual-path storage:** every ingest writes the raw JSON to `raw_data_log`
  (audit/debug) and the parsed values to the type-specific reading table.
- **Manual UUID:** device UUID is assigned at registration, not server-generated.
- See `HOSTINGER_DEPLOYMENT.md` for the full Hostinger deploy walkthrough and the
  cron job that purges `unregistered_device` entries older than 24h.
