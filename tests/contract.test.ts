import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const queryMock = vi.fn();
vi.mock('../src/db/pool.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  pool: { end: vi.fn() },
}));

import app from '../src/index.js';

describe('BE-FE contract alignment', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  const secret = process.env.JWT_SECRET || 'secret';
  const adminToken = jwt.sign({ id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' }, secret);
  const viewerToken = jwt.sign({ id: 2, name: 'Viewer', email: 'viewer@example.com', role: 'viewer' }, secret);

  it('GET /api/devices viewer -> 200 body.devices[0].macAddress', async () => {
    queryMock.mockResolvedValueOnce([
      {
        uuid: 'dev-1',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        name: 'Station 1',
        type: 'aqms',
        project_name: 'insight',
        current_version: '1.0.0',
        latitude: null,
        longitude: null,
        last_seen_at: '2026-09-13T00:00:00.000Z',
        created_at: '2026-09-12T00:00:00.000Z',
      },
    ]);

    const res = await request(app)
      .get('/api/devices')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.devices).toHaveLength(1);
    expect(typeof res.body.devices[0].macAddress).toBe('string');
    expect(res.body.devices[0].projectName).toBe('insight');
  });

  it('GET /api/devices without token -> 401', async () => {
    const res = await request(app).get('/api/devices');
    expect(res.status).toBe(401);
  });

  it('GET /api/devices/unregistered admin -> body.data[0].macAddress/lastSeenAt', async () => {
    queryMock.mockResolvedValueOnce([
      { mac_address: 'AA:BB:CC:DD:EE:FF', last_seen_at: '2026-09-13T00:00:00.000Z' },
    ]);

    const res = await request(app)
      .get('/api/devices/unregistered')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
    expect(res.body.data[0].lastSeenAt).toBe('2026-09-13T00:00:00.000Z');
  });

  it('POST /api/devices viewer -> 403', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ uuid: 'x', name: 'X', type: 'aqms', project_name: 'p' });
    expect(res.status).toBe(403);
  });

  it('POST /api/auth/logout -> 200 {message}', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });

  it('POST /api/users admin role engineer -> 201, viewer -> 403', async () => {
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce({ insertId: 9 });

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'contract@example.com', password: 'secret123', fullName: 'Contract', role: 'engineer' });
    expect(created.status).toBe(201);

    const denied = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ email: 'contract@example.com', password: 'secret123', fullName: 'Contract', role: 'engineer' });
    expect(denied.status).toBe(403);
  });

  it('GET /api/firmware admin -> array with url/releaseNotes', async () => {
    queryMock.mockResolvedValueOnce([
      { id: 1, version: '1.0.1', bin_file_url: 'https://cdn/fw.bin', changelog: 'fix', created_at: '2026-09-13T00:00:00.000Z' },
    ]);

    const res = await request(app)
      .get('/api/firmware')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].url).toBe('https://cdn/fw.bin');
    expect(res.body[0].releaseNotes).toBe('fix');
  });

  it('GET /api/users admin -> body.users[0].fullName/createdAt', async () => {
    queryMock.mockResolvedValueOnce([
      { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'admin', created_at: '2026-09-13T00:00:00.000Z' },
    ]);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users[0].fullName).toBe('Admin User');
    expect(res.body.users[0].createdAt).toBe('2026-09-13T00:00:00.000Z');
  });
});
