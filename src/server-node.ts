import dotenv from 'dotenv';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { setQueryAdapter, type DbQuery } from './db/adapter.js';
import { pool } from './db/pool.js';

dotenv.config();

const env = loadEnv(process.env);

const nodeQuery: DbQuery = async <T>(
  sql: string,
  params?: Array<string | number | null>
): Promise<T> => {
  const [results] = await pool.execute(sql, params as never[]);
  return results as T;
};

setQueryAdapter(nodeQuery);

const app = createApp({ query: nodeQuery, jwtSecret: env.jwtSecret, iotSecret: env.iotDeviceSecret });

serve({ fetch: app.fetch, port: env.port }, () => {
  console.log(`🚀 BE-insight-web listening on :${env.port}`);
});
