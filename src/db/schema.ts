import { mysqlTable, varchar, int, bigint, timestamp, text, json, boolean, mysqlEnum, float } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// ==========================================
// A. USER MANAGEMENT & WEB PLATFORM
// ==========================================

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['admin', 'engineer', 'user']).default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at')
});

export const maintenanceTickets = mysqlTable('maintenance_tickets', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  stationUuid: varchar('station_uuid', { length: 36 }).notNull().references(() => station.uuid),
  reportedByUserId: int('reported_by_user_id').notNull().references(() => users.id),
  assignedToEngineerId: int('assigned_to_engineer_id').references(() => users.id),
  issueTitle: varchar('issue_title', { length: 255 }).notNull(),
  issueDescription: text('issue_description').notNull(),
  status: mysqlEnum('status', ['open', 'in_progress', 'resolved']).default('open').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at')
});

export const maintenanceLog = mysqlTable('maintenance_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  ticketId: bigint('ticket_id', { mode: 'number' }).notNull().references(() => maintenanceTickets.id),
  engineerId: int('engineer_id').notNull().references(() => users.id),
  actionTaken: text('action_taken').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ==========================================
// B. IOT MASTER TABLES & OTA
// ==========================================

export const station = mysqlTable('station', {
  uuid: varchar('uuid', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  projectName: varchar('project_name', { length: 100 }).notNull(),
  macAddress: varchar('mac_address', { length: 20 }),
  currentVersion: varchar('current_version', { length: 20 }),
  type: mysqlEnum('type', ['aqms', 'soc']).notNull(), // Added based on implementation plan for ingest routing
  latitude: float('latitude'),
  longitude: float('longitude'),
  lastSeenAt: timestamp('last_seen_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at')
});

export const firmwareRelease = mysqlTable('firmware_release', {
  id: int('id').primaryKey().autoincrement(),
  projectName: varchar('project_name', { length: 100 }).notNull(),
  version: varchar('version', { length: 20 }).notNull(),
  binFileUrl: varchar('bin_file_url', { length: 255 }).notNull(),
  releaseNotes: text('release_notes'),
  isLatest: boolean('is_latest').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const unregisteredDevices = mysqlTable('unregistered_devices', {
  macAddress: varchar('mac_address', { length: 20 }).primaryKey(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().onUpdateNow().notNull()
});


// ==========================================
// C. COLD PATH (Penyimpanan Raw & Log)
// ==========================================

export const rawSensorLog = mysqlTable('raw_sensor_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  stationUuid: varchar('station_uuid', { length: 36 }).notNull(),
  firmwareVersion: varchar('firmware_version', { length: 20 }),
  dataPayload: json('data_payload').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull()
});

// ==========================================
// D. HOT PATH (Analitik Dashboard)
// ==========================================

export const dataAqms = mysqlTable('data_aqms', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  stationUuid: varchar('station_uuid', { length: 36 }).notNull().references(() => station.uuid),
  pm25: float('pm25'),
  no2: float('no2'),
  co: float('co'),
  temp: float('temp'),
  hum: float('hum'),
  ws: float('ws'),
  wd: float('wd'),
  measuredAt: timestamp('measured_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const dataSoc = mysqlTable('data_soc', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  stationUuid: varchar('station_uuid', { length: 36 }).notNull().references(() => station.uuid),
  ph: float('ph'),
  no2: float('no2'),
  ec: float('ec'),
  temp: float('temp'),
  hum: float('hum'),
  n: float('n'),
  p: float('p'),
  k: float('k'),
  measuredAt: timestamp('measured_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
