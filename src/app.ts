import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { setQueryAdapter, type DbQuery } from './db/adapter.js';
import { createAuthenticateJWT, requireAdmin } from './middleware/auth.js';
import { createAuthRouter } from './routes/auth.js';
import { createIotRouter } from './routes/iot.js';
import { createDataRouter } from './routes/data.js';
import { createDevicesRouter } from './routes/devices.js';
import { createFirmwareRouter } from './routes/firmware.js';
import { createUsersRouter } from './routes/users.js';

export interface CfBindings {
  HYPERDRIVE: { connectionString: string };
  JWT_SECRET: string;
  IOT_DEVICE_SECRET: string;
}

export interface AppDeps {
  query: DbQuery;
  jwtSecret: string;
  iotSecret: string;
}

export function createApp(deps: AppDeps) {
  // Route memakai getQueryAdapter() global; entrypoint cukup meneruskan query via deps.
  setQueryAdapter(deps.query);

  const app = new Hono<{ Bindings: CfBindings }>();

  app.use('*', cors());
  app.use('*', logger());

  const authenticateJWT = createAuthenticateJWT(deps.jwtSecret);

  // Health Check (tak berversi untuk probe infra)
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // IoT device endpoints (x-device-secret / x-api-key)
  app.route('/api/v1/iot', createIotRouter({ iotSecret: deps.iotSecret }));

  // Auth & User Management
  app.route('/api/v1/auth', createAuthRouter({ jwtSecret: deps.jwtSecret }));

  // Sensor data query — JWT protected
  app.use('/api/v1/data/*', authenticateJWT);
  app.route('/api/v1/data', createDataRouter());

  // Device Management Dashboard (JWT auth; admin lock is per-route in devicesRouter)
  app.use('/api/v1/devices/*', authenticateJWT);
  app.route('/api/v1/devices', createDevicesRouter());

  // User Management Dashboard (JWT auth + admin protected)
  app.use('/api/v1/users/*', authenticateJWT, requireAdmin);
  app.route('/api/v1/users', createUsersRouter());

  // Firmware Management (JWT auth + admin protected)
  app.use('/api/v1/firmware/*', authenticateJWT, requireAdmin);
  app.route('/api/v1/firmware', createFirmwareRouter());

  return app;
}
