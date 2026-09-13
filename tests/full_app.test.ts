import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { setQueryAdapter } from '../src/db/adapter.js';

// Verifies the FULL app boots and all routers mount without a live DB.
// Auth-gated routes should return 401 (no token) = route reachable & middleware wired.

const queryMock = vi.fn();

function buildApp() {
  setQueryAdapter(queryMock);
  return createApp({ query: queryMock, jwtSecret: 'secret', iotSecret: 'secret' });
}

describe('Full app mount smoke test', () => {
  it('GET /health returns ok', async () => {
    const res = await buildApp().request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('GET /api/v1/auth/me without token -> 401 (auth router mounted)', async () => {
    const res = await buildApp().request('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/iot/ota without key -> 401 (iot router mounted)', async () => {
    const res = await buildApp().request('/api/v1/iot/ota');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/devices without token -> 401 (auth required before admin check)', async () => {
    const res = await buildApp().request('/api/v1/devices');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/users without token -> 401 (auth required before admin check)', async () => {
    const res = await buildApp().request('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/data/x/y without token -> 401 (data router + JWT guard mounted)', async () => {
    const res = await buildApp().request('/api/v1/data/abc/aqms');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/firmware without token -> 401 (auth required before admin check)', async () => {
    const res = await buildApp().request('/api/v1/firmware');
    expect(res.status).toBe(401);
  });

  it('GET /api/devices (unversioned) returns 404 (route removed)', async () => {
    const res = await buildApp().request('/api/devices');
    expect(res.status).toBe(404);
  });
});
