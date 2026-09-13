import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const queryMock = vi.fn();
vi.mock('../src/db/pool.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  pool: { end: vi.fn() },
}));

import app from '../src/index.js';

describe('GET /api/users endpoint and protection', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  const secret = process.env.JWT_SECRET || 'secret';
  const adminToken = jwt.sign({ id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' }, secret);
  const viewerToken = jwt.sign({ id: 2, name: 'Viewer', email: 'viewer@example.com', role: 'viewer' }, secret);

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Access token required');
  });

  it('rejects non-admin users with 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin privilege required');
  });

  it('allows admin users and returns camelCase list without password hash', async () => {
    const mockUsers = [
      { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'admin', created_at: '2026-01-01T00:00:00.000Z' },
      { id: 2, name: 'Viewer User', email: 'viewer@example.com', role: 'viewer', created_at: '2026-01-02T00:00:00.000Z' }
    ];
    queryMock.mockResolvedValueOnce(mockUsers);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0]).toEqual({
      id: 1,
      email: 'admin@example.com',
      name: 'Admin User',
      fullName: 'Admin User',
      role: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(res.body.users[1].fullName).toBe('Viewer User');
    expect(res.body.users[1].createdAt).toBe('2026-01-02T00:00:00.000Z');
    expect(res.body.users[0].password_hash).toBeUndefined();
    expect(res.body.users[1].password_hash).toBeUndefined();
  });

  it('handles database error gracefully with 500', async () => {
    queryMock.mockRejectedValueOnce(new Error('DB failure'));

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch users');
  });
});

describe('POST /api/users creation', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  const secret = process.env.JWT_SECRET || 'secret';
  const adminToken = jwt.sign({ id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' }, secret);
  const viewerToken = jwt.sign({ id: 2, name: 'Viewer', email: 'viewer@example.com', role: 'viewer' }, secret);

  it('rejects viewer with 403', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ email: 'e@example.com', password: 'secret123', fullName: 'E', role: 'engineer' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin privilege required');
  });

  it('lets admin create engineer with 201', async () => {
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce({ insertId: 3 });

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'eng@example.com', password: 'secret123', fullName: 'Eng', role: 'engineer' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('engineer');
    expect(res.body.user.fullName).toBe('Eng');
  });
});
