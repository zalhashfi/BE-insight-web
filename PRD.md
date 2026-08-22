# Product Requirements Document (PRD)

## 1. Problem Statement
Sistem monitoring IoT (IAQMS / SOC) membutuhkan backend terpusat yang handal, berbiaya rendah, dan mudah dideploy di shared hosting cPanel/Hostinger. Backend harus mampu mengisolasi data mentah (cold path) untuk audit sembari menyediakan agregasi data terstruktur yang cepat untuk dashboard web (hot path), serta memfasilitasi otomatisasi update firmware OTA untuk perangkat ESP32 di lapangan.

## 2. User Personas & Use Cases
- **IoT Firmware (ESP32)**:
  - Mengirim MAC Address saat boot untuk handshake UUID.
  - Mengirim payload telemetri berkala secara otomatis.
  - Memeriksa ketersediaan update firmware binary saat startup.
- **Admin / Operator Dashboard**:
  - Melihat daftar perangkat terhubung dan status online/offline.
  - Mendaftarkan perangkat baru dari daftar pending MAC address yang terdeteksi.
  - Memonitor grafik kualitas udara / tanah secara real-time dan historis.
  - Mengunggah dan merilis update firmware baru.

## 3. Success Metrics
- Ingest latensi rata-rata < 150ms pada shared hosting.
- 0% data loss dengan mekanisme cold storage (`raw_data_log`).
- Setup mudah tanpa dependency container berat.
