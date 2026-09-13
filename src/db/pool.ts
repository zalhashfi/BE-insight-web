import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { loadEnv } from '../config/env.js';
import { setQueryAdapter } from './adapter.js';

dotenv.config();

const env = loadEnv(process.env);

// Konfigurasi Connection Pool MySQL Pure SQL (Node/VPS).
// Worker Cloudflare memakai adapter Hyperdrive via setQueryAdapter (lihat src/db/hyperdrive.ts).
export const pool = mysql.createPool({
  host: env.dbHost,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  port: env.dbPort,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

setQueryAdapter(async <T>(sql: string, params?: Array<string | number | null>): Promise<T> => {
  const [results] = await pool.execute(sql, params as never[]);
  return results as T;
});

// Helper eksekusi query dengan parameterized query — signature stabil seperti kontrak #26/#27.
// Catatan: route mengimpor getQueryAdapter dari ./adapter.js agar bundle Worker bebas mysql2.
export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
  const [results] = await pool.execute(sql, params as never[]);
  return results as T;
}
