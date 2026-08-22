-- Database Schema for BE-insight-web (Pure SQL MySQL)

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

CREATE TABLE IF NOT EXISTS raw_data_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    payload JSON NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS firmware_release (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    version VARCHAR(30) NOT NULL,
    bin_file_url TEXT NOT NULL,
    changelog TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_project_version (project_name, version)
);

CREATE TABLE IF NOT EXISTS unregistered_device (
    mac_address VARCHAR(17) PRIMARY KEY,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'viewer') DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indeks Tambahan untuk Optimasi Query
CREATE INDEX IF NOT EXISTS idx_raw_device_time ON raw_data_log(device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_aqms_device_time ON aqms_reading(device_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_soc_device_time ON soc_reading(device_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_firmware_project_time ON firmware_release(project_name, created_at DESC);
