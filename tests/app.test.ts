import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { setQueryAdapter } from '../src/db/adapter.js';

// Smoke test: verifies routers mount and respond WITHOUT needing a live database.
// We hit endpoints that fail auth (so no DB call succeeds) —
// the key is that the route is reachable & Hono works.

const queryMock = vi.fn();

function buildApp() {
  setQueryAdapter(queryMock);
  return createApp({ query: queryMock, jwtSecret: 'secret', iotSecret: 'secret' });
}

describe('IoT router smoke test', () => {
  it('GET /api/v1/iot/ota without api-key returns 401 (route reachable)', async () => {
    const res = await buildApp().request('/api/v1/iot/ota');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('POST /api/v1/iot/identity without secret returns 401 (route reachable)', async () => {
    const res = await buildApp().request('/api/v1/iot/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac_address: 'AA:BB:CC:DD:EE:FF' }),
    });
    expect(res.status).toBe(401);
  });
});
