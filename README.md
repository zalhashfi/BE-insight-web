# BE-insight-web (Insight Lab — Backend)

IoT Backend API for the "Biru Langit" environmental monitoring platform. Receives
sensor telemetry (AQMS / SOC) from ESP32 devices, serves dashboard queries, and
manages devices + OTA firmware releases.

## Tech stack

- **Runtime:** Node.js (ESM, TypeScript)
- **Framework:** Express.js 4
- **Database:** MySQL via `mysql2` (pure SQL, connection pool — no ORM)
- **Auth:** JWT (`jsonwebtoken`) + `bcryptjs`, request validation with `zod`
- **Deploy:** Hostinger shared hosting (see `HOSTINGER_DEPLOYMENT.md`)

## Prerequisites

- **Node.js** 18+ and npm
- **MySQL / MariaDB** server reachable for local development (the app needs a real
  database — it does not bundle one)
- **git**

## Local Installation

```bash
# 1. Clone
git clone https://github.com/zalhashfi/BE-insight-web.git
cd BE-insight-web

# 2. Install dependencies
npm install

# 3. Create your local env file
cp .env.example .env
#    then edit .env (see "Environment Setup" below)

# 4. Create the database schema
npm run db:init

# 5. Run
npm run dev
```

Verify it's up:

```bash
curl http://localhost:3000/health
# -> {"status":"ok","timestamp":"..."}
```

Required local services: a MySQL server listening on the host/port you put in
`.env` (default `localhost:3306`) with a database named by `DB_NAME` (default
`insight_web_db`) that `DB_USER`/`DB_PASSWORD` can access. `npm run db:init`
creates the tables — you only need to have the (empty) database and user ready.

## Database setup

`npm run db:init` runs `src/db/init.ts`, which executes `src/db/schema.sql`
against the database configured in your `.env`. It is idempotent
(`CREATE TABLE IF NOT EXISTS`), so re-running it is safe.

## Running

| Command | What it does |
| --- | --- |
| `npm run dev` | `tsx watch src/index.ts` — hot-reload dev server on `:3000` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build (`node dist/index.js`) |
| `npm run db:init` | Load the schema into your database |
| `npm test` | Run the Vitest suite (`vitest run`) |

## Environment Setup (`.env`)

Copy `.env.example` → `.env` and fill in the values below. All variables have
sensible defaults so a local MySQL on `localhost` works out of the box.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port the server listens on |
| `NODE_ENV` | `development` | App mode. Set to `test` so the server does not auto-listen during tests |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | _(empty)_ | MySQL password |
| `DB_NAME` | `insight_web_db` | Database name |
| `DB_PORT` | `3306` | MySQL port |
| `JWT_SECRET` | `super_secret_jwt_key_change_in_production` | HS256 secret that signs dashboard auth tokens. **Change it for any real deployment.** |
| `IOT_DEVICE_SECRET` | `iot_device_shared_secret_key` | Shared secret. IoT devices send it in the `x-device-secret` / `x-api-key` header to authenticate ingestion. |

> **Legacy files:** `.dev.vars.example` and `migrate.ts` are leftovers from the
> old Cloudflare Workers / Drizzle setup. Ignore them for local Express
> development — use `.env` + `npm run db:init`.

## API overview

| Prefix | Auth | Purpose |
| --- | --- | --- |
| `POST /api/iot/*` | `x-device-secret` / `x-api-key` | IoT device data ingestion |
| `POST /api/auth/*` | — | Login / logout (issues JWT) |
| `GET /api/data/*` | JWT (`Authorization: Bearer`) | Sensor history & aggregation |
| `*/api/devices/*` | JWT + admin | Device / station management |
| `*/api/firmware/*` | JWT + admin | OTA firmware release management |

## Project layout

```
src/
  index.ts            Entry point, router + middleware registration
  db/
    pool.ts           mysql2 connection pool (reads .env)
    init.ts           Loads schema.sql (npm run db:init)
    schema.sql        Pure SQL schema (tables, indexes)
  routes/             auth, iot, data, devices, firmware
  middleware/auth.ts  JWT verification + admin guard
```

## More docs

- `HOSTINGER_DEPLOYMENT.md` — production deploy on Hostinger
- `CONTRIBUTING.md` — branch/commit/PR conventions
- `SPEC.md`, `PRD.md`, `CONTEXT.md`, `AGENT.md` — design & project context
