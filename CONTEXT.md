# Project Context: BE-insight-web

## 1. Overview
`BE-insight-web` adalah backend RESTful API untuk ekosistem Internet of Things (IoT) monitoring lingkungan (AQMS - Air Quality Monitoring System dan SOC - Soil / Water Quality Monitoring).
Proyek ini bertindak sebagai jembatan penampung data sensor dari perangkat mikrokontroler (ESP32), penyedia update firmware over-the-air (OTA), serta penyaji data untuk dashboard web dan otentikasi manajemen pengguna.

## 2. Platform & Deployment Target
- **Target Hosting**: Hostinger Shared Hosting (Node.js runtime via PM2 / Passenger).
- **Target Framework**: Express.js (Node.js runtime standar, menggantikan implementasi lama berbasis Cloudflare Workers / Hono).
- **Database Engine**: MySQL di Hostinger (Pure SQL via `mysql2/promise` dengan Connection Pool & Parameterized Queries).

## 3. Core Domain & Architecture Decisions
- **Unified Backend & DB**: Auth, device management, dan IoT ingestion berada dalam satu instance backend dan satu database MySQL.
- **Pure SQL approach**: Tidak menggunakan ORM berat untuk query harian, melainkan SQL murni teroptimasi guna efisiensi resource dan pembelajaran.
- **Dual Path Storage**:
  - *Cold Path*: Payload JSON mentah disimpan apa adanya ke `raw_data_log` untuk kebutuhan audit dan debugging payload sensor yang rusak.
  - *Hot Path*: Payload terurai dan divalidasi disimpan ke tabel spesifik (`aqms_reading` atau `soc_reading`) dengan indeks waktu untuk query cepat.
- **Manual UUID Assignment**: Penentuan UUID perangkat dilakukan secara manual saat registrasi (bukan auto-generated).
