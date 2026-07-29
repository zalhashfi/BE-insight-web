# Insight Lab - Backend (API)

Backend API untuk platform pemantauan **Insight Lab**, dibangun dengan Hono, berjalan di atas Cloudflare Workers, dan menggunakan Drizzle ORM dengan database MySQL (Hyperdrive). API ini melayani dashboard frontend untuk manajemen stasiun pemantau, data telemetri, firmware, serta manajemen akses pengguna.

Repository Frontend (Klien): [FE-insight-web](https://github.com/zalhashfi/FE-insight-web)

## Key Features

- **Manajemen Stasiun**: CRUD alat/stasiun dengan format UUID kustom dan dukungan *soft-delete*.
- **Data Telemetri**: Penyimpanan dan pengambilan data historis dari sensor lingkungan (AQMS, SOC).
- **Firmware OTA**: Manajemen rilis firmware dengan validasi versi terbaru.
- **Autentikasi JWT**: Autentikasi berbasis HttpOnly cookie untuk mengamankan data dan mencegah serangan XSS.
- **Manajemen Pengguna**: Sistem Role-Based Access Control (Admin, Engineer, User).

## Tech Stack

- **Language**: TypeScript (Node.js)
- **Framework**: Hono (`hono`)
- **Database ORM**: Drizzle ORM (`drizzle-orm`)
- **Database**: MySQL (via Cloudflare Hyperdrive)
- **Validation**: Zod (`zod`, `@hono/zod-validator`)
- **Authentication**: JWT & bcryptjs
- **Deployment**: Cloudflare Workers (`wrangler`)

## Prerequisites

- Node.js 20+
- Akun Cloudflare (untuk Workers & Hyperdrive)
- MySQL database aktif (baik lokal atau remote)
- npm atau pnpm

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/zalhashfi/BE-insight-web.git
cd BE-insight-web
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Salin `.env.example` ke `.env` (atau buat `.dev.vars` jika menjalankan lewat Wrangler lokal):

```bash
cp .env.example .dev.vars
```

Konfigurasikan variabel environment:

| Variable           | Description                  | Example                                    |
| ------------------ | ---------------------------- | ------------------------------------------ |
| `DATABASE_URL`     | MySQL connection string      | `mysql://user:pass@localhost:3306/insight` |
| `JWT_SECRET`       | Secret key untuk sign token  | `super-secret-key-12345`                   |

### 4. Database Setup

Jalankan push schema untuk memastikan tabel database sinkron dengan schema Drizzle:

```bash
npx drizzle-kit push
```

*(Opsional)* Anda dapat mengeksplor database menggunakan Drizzle Studio:
```bash
npx drizzle-kit studio
```

### 5. Start Development Server

Gunakan Wrangler untuk menjalankan Worker secara lokal:

```bash
npm run dev
```

API akan berjalan di `http://localhost:8787`.

---

## Architecture

### Directory Structure

```
├── src/
│   ├── db/
│   │   └── schema.ts       # Definisi tabel Drizzle ORM
│   ├── routes/
│   │   ├── auth.ts         # Login, logout endpoints
│   │   ├── firmware.ts     # Manajemen rilis firmware
│   │   ├── stations.ts     # CRUD Alat/Stasiun
│   │   ├── telemetry.ts    # Penerimaan & Pengambilan data sensor
│   │   ├── tickets.ts      # Manajemen tiket pemeliharaan
│   │   └── users.ts        # CRUD Pengguna & Role
│   └── index.ts            # Entry point Hono & Middleware
├── drizzle.config.ts       # Konfigurasi migrasi Drizzle
├── package.json            # Dependensi
└── wrangler.toml / .json   # Konfigurasi Cloudflare Workers
```

### Request Lifecycle

1. Request masuk ke Hono di `src/index.ts`.
2. Middleware JWT mengecek keberadaan `HttpOnly` cookie (kecuali rute publik seperti login).
3. Request diteruskan ke router bersangkutan (misal: `src/routes/stations.ts`).
4. `zod-validator` memvalidasi tipe data body/query string.
5. Controller berinteraksi dengan database MySQL menggunakan Drizzle ORM.
6. JSON Response dikirimkan kembali ke Frontend.

### Database Schema

Daftar tabel utama pada database MySQL:
- `users`: Menyimpan kredensial pengguna (email, bcrypt password, role).
- `stations`: Menyimpan daftar alat IoT (UUID pendek, nama, koordinat GPS).
- `telemetry`: Menyimpan riwayat pembacaan sensor dengan relasi ke `stations`.
- `firmwareRelease`: Menyimpan daftar rilis firmware ESP32 untuk *Over The Air update*.
- `tickets`: Tiket maintenance untuk setiap alat.

---

## Available Scripts

| Command                       | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `npm run dev`                 | Menjalankan Cloudflare Worker secara lokal          |
| `npx tsc --noEmit`            | Memeriksa error tipe TypeScript                     |
| `npx drizzle-kit push`        | Sinkronisasi schema Drizzle ke MySQL                |
| `npx drizzle-kit studio`      | Buka GUI database Drizzle Studio                    |
| `npm run deploy`              | Publish API ke jaringan edge Cloudflare             |

---

## Deployment

Aplikasi ini di-deploy ke infrastruktur serverless **Cloudflare Workers**. 

1. Pastikan Anda telah login ke akun Cloudflare:
   ```bash
   npx wrangler login
   ```
2. Pastikan rahasia (secrets) production sudah terdaftar:
   ```bash
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put JWT_SECRET
   ```
3. Lakukan deploy:
   ```bash
   npm run deploy
   ```
API akan otomatis online pada subnet domain `.workers.dev` Anda. Gunakan URL ini sebagai target proksi pada `.env` di aplikasi Frontend.

---

## Troubleshooting

### JWT Auth Gagal di Development
**Error:** Tidak bisa login / endpoint 401 Unauthorized.
**Solution:** Pastikan konfigurasi cookie pada `src/routes/auth.ts` kompatibel. Saat development lokal tanpa HTTPS, terkadang browser memblokir cookie dengan `Secure: true` atau `SameSite: 'None'`. Sesuaikan environment saat dev.

### MySQL Connection Error
**Error:** `ER_ACCESS_DENIED_ERROR`
**Solution:**
Periksa string koneksi Anda di `.dev.vars`. Pastikan database MySQL dapat diakses dari lokal, dan jika menggunakan Hyperdrive, pastikan pool terkoneksi dengan benar.
