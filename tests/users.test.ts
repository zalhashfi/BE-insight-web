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

describe('GET /api/v1/users endpoint and protection', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await buildApp().request('/api/v1/users');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Access token required');
  });

  it('rejects non-admin users with 403', async () => {
    const viewerToken = await signToken({
      id: 2,
      name: 'Viewer',
      email: 'viewer@example.com',
      role: 'viewer',
    });
    const res = await buildApp().request('/api/v1/users', {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Admin privilege required');
  });

  it('allows admin users and returns camelCase list without password hash', async () => {
    const mockUsers = [
      {
        id: 1,
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        name: 'Viewer User',
        email: 'viewer@example.com',
        role: 'viewer',
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ];
    queryMock.mockResolvedValueOnce(mockUsers);
    const adminToken = await signToken({
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    });

    const res = await buildApp().request('/api/v1/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(2);
    expect(body.users[0]).toEqual({
      id: 1,
      email: 'admin@example.com',
      name: 'Admin User',
      fullName: 'Admin User',
      role: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(body.users[1].fullName).toBe('Viewer User');
    expect(body.users[1].createdAt).toBe('2026-01-02T00:00:00.000Z');
    expect(body.users[0].password_hash).toBeUndefined();
    expect(body.users[1].password_hash).toBeUndefined();
  });

  it('handles database error gracefully with 500', async () => {
    queryMock.mockRejectedValueOnce(new Error('DB failure'));
    const adminToken = await signToken({
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    });

    const res = await buildApp().request('/api/v1/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch users');
  });
});

describe('POST /api/v1/users creation', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('rejects viewer with 403', async () => {
    const viewerToken = await signToken({
      id: 2,
      name: 'Viewer',
      email: 'viewer@example.com',
      role: 'viewer',
    });
    const res = await buildApp().request('/api/v1/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e@example.com', password: 'secret123', fullName: 'E', role: 'engineer' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Admin privilege required');
  });

  it('lets admin create engineer with 201', async () => {
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce({ insertId: 3 });
    const adminToken = await signToken({
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    });

    const res = await buildApp().request('/api/v1/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'eng@example.com',
        password: 'secret123',
        fullName: 'Eng',
        role: 'engineer',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.role).toBe('engineer');
    expect(body.user.fullName).toBe('Eng');
  });
});
