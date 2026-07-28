import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { usersRouter } from '../src/routes/users';

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn().mockResolvedValue([
      { id: 1, email: 'admin@biru-langit.com', fullName: 'Admin', role: 'admin' }
    ])
  })),
  insert: vi.fn(() => ({
    values: vi.fn().mockResolvedValue([{ insertId: 2 }])
  }))
};

describe('Users API', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use('*', async (c, next) => {
      c.set('db', mockDb as any);
      await next();
    });
    
    // Simulate admin authorization
    app.use('*', async (c, next) => {
      c.set('jwtPayload', { id: 1, role: 'admin' });
      await next();
    });

    app.route('/api/users', usersRouter);
    vi.clearAllMocks();
  });

  it('should list all users', async () => {
    const res = await app.request('/api/users', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].email).toBe('admin@biru-langit.com');
  });

  it('should create a new user', async () => {
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'engineer@biru-langit.com',
        password: 'password123',
        fullName: 'Engineer Name',
        role: 'engineer'
      })
    });
    expect(res.status).toBe(201);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
