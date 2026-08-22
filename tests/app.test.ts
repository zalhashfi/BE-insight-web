import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { iotRouter } from '../src/routes/iot.js';

// Smoke test: verifies routers mount and respond WITHOUT needing a live database.
// We mount only the IoT router on a test app and hit an endpoint that fails auth
// (so no DB call succeeds) — the key is that the route is reachable & Express works.

const app = express();
app.use(express.json());
app.use('/api/iot', iotRouter);

describe('IoT router smoke test', () => {
  it('GET /api/iot/ota without api-key returns 401 (route reachable)', async () => {
    const res = await request(app).get('/api/iot/ota');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/iot/identity without secret returns 401 (route reachable)', async () => {
    const res = await request(app).post('/api/iot/identity').send({ mac_address: 'AA:BB:CC:DD:EE:FF' });
    expect(res.status).toBe(401);
  });
});
