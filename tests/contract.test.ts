import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import { createApp } from '../src/app.js';
import { setQueryAdapter } from '../src/db/adapter.js';

const queryMock = vi.fn();

function buildApp() {
  setQueryAdapter(queryMock);
  return createApp({ query: queryMock, jwtSecret: 'secret', iotSecret: 'secret' });
}

async function signToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(new TextEncoder().encode('secret'));
}

async function json(res: Response) {
  return res.json();
}

describe('BE-FE contract alignment (v1)', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('GET /api/v1/devices viewer -> 200 body.devices[0].macAddress', async () => {
    queryMock.mockResolvedValueOnce([
      {
        uuid: 'dev-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        name: 'TULT',
        type: 'aqms',
        project_name: 'insight',
        current_version: '1.0.0',
        latitude: null,
        longitude: null,
        last_seen_at: '2026-09-13T00:00:00.000Z',
        created_at: '2026-09-13T00:00:00.000Z',
      },
    ]);
    const token = await signToken({ id: 2, name: 'Viewer', email: 'viewer@example.com', role: 'viewer' });

    const res = await buildApp().request('/api/v1/devices', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.devices).toHaveLength(1);
    expect(typeof body.devices[0].macAddress).toBe('string');
    expect(body.devices[0].projectName).toBe('insight');
  });

  it('GET /api/v1/devices without token -> 401', async () => {
    const res = await buildApp().request('/api/v1/devices');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/devices/unregistered admin -> body.data[0].macAddress/lastSeenAt', async () => {
    queryMock.mockResolvedValueOnce([
      { mac_address: 'AA:BB:CC:DD:EE:FF', last_seen_at: '2026-09-13T00:00:00.000Z' },
    ]);
    const token = await signToken({ id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' });

    const res = await buildApp().request('/api/v1/devices/unregistered', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data[0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
    expect(body.data[0].lastSeenAt).toBe('2026-09-13T00:00:00.000Z');
  });

  it('POST /api/v1/devices viewer -> 403', async () => {
    const token = await signToken({ id: 2, name: 'Viewer', email: 'viewer@example.com', role: 'viewer' });

    const res = await buildApp().request('/api/v1/devices', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: 'x', name: 'X', type: 'aqms', project_name: 'p' }),
    });
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/auth/logout -> 200 {message}', async () => {
    const res = await buildApp().request('/api/v1/auth/logout', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.message).toBe('Logged out');
  });

  it('POST /api/v1/users admin role engineer -> 201, viewer -> 403', async () => {
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce({ insertId: 9 });
    const adminToken = await signToken({
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    });
    const viewerToken = await signToken({
      id: 2,
      name: 'Viewer',
      email: 'viewer@example.com',
      role: 'viewer',
    });
    const app = buildApp();

    const created = await app.request('/api/v1/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'contract@example.com',
        password: 'secret123',
        fullName: 'Contract',
        role: 'engineer',
      }),
    });
    expect(created.status).toBe(201);

    const denied = await app.request('/api/v1/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'contract@example.com',
        password: 'secret123',
        fullName: 'Contract',
        role: 'engineer',
      }),
    });
    expect(denied.status).toBe(403);
  });

  it('GET /api/v1/firmware admin -> array with url/releaseNotes', async () => {
    queryMock.mockResolvedValueOnce([
      {
        id: 1,
        version: '1.0.1',
        bin_file_url: 'https://cdn/fw.bin',
        changelog: 'fix',
        created_at: '2026-09-13T00:00:00.000Z',
      },
    ]);
    const token = await signToken({ id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' });

    const res = await buildApp().request('/api/v1/firmware', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].url).toBe('https://cdn/fw.bin');
    expect(body[0].releaseNotes).toBe('fix');
  });

  it('GET /api/v1/users admin -> body.users[0].fullName/createdAt', async () => {
    queryMock.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        created_at: '2026-09-13T00:00:00.000Z',
      },
    ]);
    const token = await signToken({ id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' });

    const res = await buildApp().request('/api/v1/users', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.users[0].fullName).toBe('Admin User');
    expect(body.users[0].createdAt).toBe('2026-09-13T00:00:00.000Z');
  });

  it('GET /health -> 200 ok; GET /api/devices (unversioned) -> 404', async () => {
    const app = buildApp();
    const health = await app.request('/health');
    expect(health.status).toBe(200);
    const healthBody = await json(health);
    expect(healthBody.status).toBe('ok');

    const legacy = await app.request('/api/devices');
    expect(legacy.status).toBe(404);
  });
});
