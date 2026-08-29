import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

// Verifies the FULL app boots and all routers mount without a live DB.
// Auth-gated routes should return 401 (no token) = route reachable & middleware wired.

afterAll(() => { process.env.NODE_ENV = 'test'; });

describe('Full app mount smoke test', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/auth/me without token -> 401 (auth router mounted)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/iot/ota without key -> 401 (iot router mounted)', async () => {
    const res = await request(app).get('/api/iot/ota');
    expect(res.status).toBe(401);
  });

  it('GET /api/devices without token -> 403 (devices router + admin guard mounted)', async () => {
    const res = await request(app).get('/api/devices');
    expect(res.status).toBe(403);
  });

  it('GET /api/data/x/y without token -> 401 (data router + JWT guard mounted)', async () => {
    const res = await request(app).get('/api/data/abc/aqms');
    expect(res.status).toBe(401);
  });

  it('GET /api/firmware without token -> 403 (firmware router + admin guard mounted)', async () => {
    const res = await request(app).get('/api/firmware');
    expect(res.status).toBe(403);
  });

  it('GET /api/firmware/:projectName/latest returns 404/403 (route removed/unmounted)', async () => {
    const res = await request(app).get('/api/firmware/test-project/latest');
    // Since /api/firmware has requireAdmin middleware at index level, without token it gives 403, or 404 if router rejects.
    // Specifically verify it does not hit any unauthenticated or unspec handler.
    expect(res.status).toBe(403);
  });
});
