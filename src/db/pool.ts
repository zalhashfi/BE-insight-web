import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { loadEnv } from '../config/env.js';
import { setQueryAdapter, getQueryAdapter, type DbQuery } from './adapter.js';

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

const defaultQuery: DbQuery = async <T>(sql: string, params?: Array<string | number | null>): Promise<T> => {
  const [results] = await pool.execute(sql, params as never[]);
  return results as T;
};

setQueryAdapter(defaultQuery);

// Helper eksekusi query dengan parameterized query — mendelegasikan ke adapter aktif.
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  return getQueryAdapter()<T>(sql, params);
}
