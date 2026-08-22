# Panduan Deployment Hostinger (Node.js App)

Dokumen ini menjelaskan langkah-langkah men-deploy `BE-insight-web` ke **Hostinger Shared / Cloud Hosting**.

---

## 1. Persiapan Database MySQL di Hostinger

1. Masuk ke **hPanel Hostinger** -> **Databases** -> **MySQL Databases**.
2. Buat database baru:
   - Nama Database: `u1234567_insight_db`
   - Username: `u1234567_dbuser`
   - Password: `PasswordKuatDB123!`
3. Buka **phpMyAdmin**, pilih database tersebut, lalu impor/eksekusi script SQL dari file `src/db/schema.sql`.

---

## 2. Setup Node.js App di hPanel

1. Di hPanel Hostinger, masuk ke menu **Node.js** (atau **Setup Node.js App** di cPanel).
2. Klik **Create Application**:
   - **Node.js version**: Pilih versi LTS terbaru (v20.x atau v22.x).
   - **Application mode**: `Production`.
   - **Application root**: `domains/namadomainmu.com/backend` (atau folder tempat upload file).
   - **Application startup file**: `dist/index.js` (atau `src/index.ts` jika memakai tsx).
3. Simpan dan catat *Application Root*.

---

## 3. Upload Source Code & Build

1. Upload seluruh file proyek ke folder Application Root (bisa via FTP, Git Repository Manager di hPanel, atau File Manager).
2. Pastikan file `.env` sudah dibuat di folder root proyek dengan konfigurasi kredensial Hostinger:
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
3. Di terminal hPanel (SSH) atau via tombol *Run NPM Install* di menu Node.js:
   ```bash
   npm install
   npm run build
   ```

---

## 4. Jalankan Aplikasi & Restart

1. Klik tombol **Restart** pada menu Node.js di hPanel.
2. Uji endpoint server:
   ```bash
   curl https://api.namadomainmu.com/health
   ```
   Harus mengembalikan: `{"status":"ok", "timestamp":"..."}`.

---

## 5. Menjalankan Skrip Pembersihan Otomatis (Cron Job)

Untuk membersihkan tabel `unregistered_device` yang lebih dari 24 jam secara berkala:
1. Buka menu **Cron Jobs** di hPanel.
2. Tambahkan custom cron job setiap hari (00:00):
   ```bash
   mysql -u u1234567_dbuser -p'PasswordKuatDB123!' -e "DELETE FROM u1234567_insight_db.unregistered_device WHERE last_seen_at < NOW() - INTERVAL 1 DAY;"
   ```
