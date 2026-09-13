import mysql from 'mysql2/promise';
import type { DbQuery } from './adapter.js';

// Pola koneksi Hyperdrive yang terdokumentasi Cloudflare:
// binding HYPERDRIVE menyediakan connectionString sekali pakai per request.
export function createHyperdriveQuery(connectionString: string): DbQuery {
  return async <T>(sql: string, params?: Array<string | number | null>): Promise<T> => {
    const connection = await mysql.createConnection(connectionString);
    try {
      const [results] = await connection.execute(sql, params as never[]);
      return results as T;
    } finally {
      await connection.end();
    }
  };
}
