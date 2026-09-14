# Insight Laboratory - Backend (BE-insight-web)

RESTful API backend for the "Biru Langit" IoT environmental monitoring ecosystem
(AQMS = Air Quality Monitoring System).

It receives raw sensor telemetry from ESP32 microcontrollers, serves it to the
web dashboard, handles user auth, and provides over-the-air (OTA) firmware updates.

## Tech Stack

- **Framework:** Hono 4 (TypeScript, ESM) — satu codebase portabel Node + Cloudflare Workers
- **Runtime & Deployment:** Cloudflare Worker (utama, via Hyperdrive ke MySQL) atau VPS/Docker (cadangan, `@hono/node-server` + pool mysql2)
- **Database:** MySQL, diakses dengan **Pure SQL** (parameterized queries — no ORM); akses DB diabstraksi lewat adapter `DbQuery` (`src/db/adapter.ts`)
- **Auth:** JWT via `jose` (Bearer token di header `Authorization`), `bcryptjs`
- **Testing:** Vitest (`app.request()` milik Hono, tanpa supertest)

## Environment Variables

Copy `.env.example` to `.env` and fill in values. Seluruh env dibaca terpusat di
`src/config/env.ts` (`loadEnv`); entrypoint Node di `src/server-node.ts`, entrypoint
Worker di `src/worker.ts` (binding `HYPERDRIVE` + secret via `wrangler secret put`).

| Variable            | Required | Default            | Description                                                                 |
|---------------------|----------|--------------------|-----------------------------------------------------------------------------|
| `PORT`              | no       | `3000`             | TCP port server Node (`src/server-node.ts`) listens on.                     |
| `NODE_ENV`          | no       | `development`      | App environment. Set `production` di VPS. Boot Node melempar error bila `JWT_SECRET`/`IOT_DEVICE_SECRET` kosong saat production. |
| `DB_HOST`           | no*      | `localhost`        | MySQL host — **VPS/Node saja** (Worker memakai Hyperdrive).                 |
| `DB_USER`           | no*      | `root`             | MySQL username — **VPS/Node saja**.                                         |
| `DB_PASSWORD`       | no*      | `''` (empty)       | MySQL password — **VPS/Node saja**.                                         |
| `DB_NAME`           | no*      | `insight_web_db`   | MySQL database name — **VPS/Node saja**.                                    |
| `DB_PORT`           | no*      | `3306`             | MySQL port — **VPS/Node saja**.                                             |
| `JWT_SECRET`        | yes      | `secret` (fallback)| Secret sign/verify JWT. Di Cloudflare via `wrangler secret put JWT_SECRET` (pakai nilai produksi lama agar token lama tetap valid). |
| `IOT_DEVICE_SECRET` | yes      | — (none)           | Shared secret `x-device-secret` di `POST /api/v1/iot/identity`. Di Cloudflare via `wrangler secret put IOT_DEVICE_SECRET`. |
## Database Setup

1. Create the MySQL database on Hostinger (or locally).
2. Run the schema once:
   ```bash
   npm run db:init
   ```
   This executes `src/db/schema.sql` (creates tables: `user`, `device`,
   `unregistered_device`, `raw_data_log`, `aqms_reading`,
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

1. **User JWT** — dashboard users. Obtain via `POST /api/v1/auth/login`, then send `Authorization: Bearer <token>` on protected routes.
2. **Device API key** — each device's `uuid` is sent in the `x-api-key` header for `POST /api/v1/iot/ingest` and `GET /api/v1/iot/ota`.
3. **Device shared secret** — sent in the `x-device-secret` header on `POST /api/v1/iot/identity` (a single shared key from `IOT_DEVICE_SECRET`).

Admin-only routes additionally require the JWT user to have `role = 'admin'`.

## API Endpoints
Base path for versioned routes is `/api/v1`. Full health check is at root (`/health`, tak berversi).

### Health
| Method | Path       | Auth | Purpose                                  |
|--------|------------|------|------------------------------------------|
| GET    | `/health`  | none | Liveness check. Returns `{ status: "ok", timestamp }`. |

### IoT device endpoints — mounted at `/api/v1/iot`
| Method | Path                  | Auth header        | Purpose                                                                 |
|--------|-----------------------|--------------------|-------------------------------------------------------------------------|
| POST   | `/api/v1/iot/identity`  | `x-device-secret`  | Device boots: send `mac_address`, get back `{ uuid, type, project_name }`. |
| POST   | `/api/v1/iot/ingest`    | `x-api-key` (=uuid) | Receive sensor JSON. Stored raw in `raw_data_log` and parsed into `aqms_reading`. |
| GET    | `/api/v1/iot/ota`       | `x-api-key` (=uuid) | OTA check. Returns `update_available`, `latest_version`, `bin_file_url` if newer firmware exists. |

### Auth & user management — mounted at `/api/v1/auth`
| Method | Path               | Auth        | Purpose                                                                 |
|--------|--------------------|-------------|-------------------------------------------------------------------------|
| POST   | `/api/v1/auth/register` | none      | Register a user. Body: `name, email, password` (selalu tulis role `viewer`). |
| POST   | `/api/v1/auth/login`  | none        | Authenticate. Body: `email, password`. Returns `{ token, user }`.        |
| GET    | `/api/v1/auth/me`     | JWT         | Return currently authenticated user from token.                         |
| POST   | `/api/v1/auth/logout` | none        | Stateless logout → `200 { message: 'Logged out' }`.                     |

### Sensor data query — mounted at `/api/v1/data` (JWT required)
| Method | Path                                          | Auth | Purpose                                                                 |
| GET    | `/api/v1/data/devices/:uuid/data/:sensorType`    | JWT  | Query readings for a device (`aqms` only). Params: `start_time`, `end_time`, `limit`. |

### Device management (dashboard) — mounted at `/api/v1/devices` (JWT; admin per-route)
| Method | Path                         | Auth        | Purpose                                                                 |
|--------|------------------------------|-------------|-------------------------------------------------------------------------|
| GET    | `/api/v1/devices`              | JWT       | List all active devices.                                                |
| GET    | `/api/v1/devices/unregistered` | admin       | List devices seen via `/identity` but not yet registered.              |
| GET    | `/api/v1/devices/:uuid`        | JWT       | Device detail + reading counts.                                         |
| POST   | `/api/v1/devices`              | admin       | Register a device. Body: `uuid, mac_address, name, type, project_name`. |
| PUT    | `/api/v1/devices/:uuid`        | admin       | Update `name`, `type`, and/or `project_name`.                          |
| DELETE | `/api/v1/devices/:uuid`        | admin       | Soft delete device.                                                     |

### User management (dashboard) — mounted at `/api/v1/users` (JWT + admin)
| Method | Path                         | Auth        | Purpose                                                                 |
|--------|------------------------------|-------------|-------------------------------------------------------------------------|
| GET    | `/api/v1/users`                | admin       | List all registered users (id, name, email, role, created_at).          |
| POST   | `/api/v1/users`                | admin       | Create user (`email,password,fullName|name,role?`, default `'user'`).   |

### Firmware management (OTA) — mounted at `/api/v1/firmware` (JWT + admin)
| Method | Path                              | Auth   | Purpose                                                                 |
|--------|-----------------------------------|--------|-------------------------------------------------------------------------|
| GET    | `/api/v1/firmware`                  | admin  | List all firmware releases.                                             |
| POST   | `/api/v1/firmware`                  | admin  | Create a release (`project_name, version, bin_file_url, changelog?`).   |

## Deploy

- **Cloudflare Worker (utama):** isi `[[hyperdrive]] id` di `wrangler.toml`, set secret (`wrangler secret put JWT_SECRET IOT_DEVICE_SECRET`), lalu `npx wrangler deploy --dry-run` untuk validasi config / `wrangler deploy` untuk rilis.
- **VPS/Docker (cadangan):** `npm run build && npm start` (`node dist/server-node.js`); `npm run db:init` sekali per database.
## Project Layout

- `src/app.ts` — Hono `createApp` factory, route mounting `/api/v1/*`, global middleware.
- `src/server-node.ts` — entrypoint VPS/Node (`@hono/node-server` + pool mysql2).
- `src/worker.ts` — entrypoint Cloudflare Worker (Hyperdrive + secret binding).
- `src/config/env.ts` — `loadEnv`, satu-satunya pembaca env.
- `src/db/adapter.ts` — `DbQuery` + `setQueryAdapter`/`getQueryAdapter` (titik pisah Node vs Hyperdrive).
- `src/db/pool.ts` — mysql2 connection pool (Node) + `query()` helper.
- `src/db/hyperdrive.ts` — `createHyperdriveQuery` (Worker).
- `src/db/schema.sql` — SQL schema.
- `src/db/init.ts` — one-shot schema initializer (`npm run db:init`).
- `src/middleware/auth.ts` — `createAuthenticateJWT` (`jose`) and `requireAdmin`.
- `src/routes/` — Hono route factories (`auth.ts`, `iot.ts`, `data.ts`, `devices.ts`, `firmware.ts`, `users.ts`).

## Notes

- **Dual-path storage:** every ingest writes raw JSON to `raw_data_log` (audit/debug) and parsed values to type-specific reading table.
- **Manual UUID:** device UUID is assigned at registration, not server-generated.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming conventions, issue & PR templates, commit guidelines, and quality gates.

