import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { setQueryAdapter } from '../src/db/adapter.js';

// Intercept the DB layer so we can assert what role is actually written,
// without needing a live MySQL instance.
const queryMock = vi.fn();

function buildApp() {
  setQueryAdapter(queryMock);
  return createApp({ query: queryMock, jwtSecret: 'secret', iotSecret: 'secret' });
}

describe('POST /api/v1/auth/register security', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('ignores role from body and always writes role="viewer"', async () => {
    // 1st call: SELECT existing user -> none. 2nd call: INSERT -> ok.
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce({ insertId: 1 });

    const res = await buildApp().request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Eve', email: 'eve@example.com', password: 'secret123', role: 'admin' }),
    });

    expect(res.status).toBe(201);
    // The INSERT call must bind 'viewer', never 'admin', from the body.
    const insertCall = queryMock.mock.calls[1];
    const bindParams = insertCall[1] as unknown[];
    expect(bindParams).toContain('viewer');
    expect(bindParams).not.toContain('admin');
  });

  it('still requires name, email, password', async () => {
    const res = await buildApp().request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(400);
  });
});
