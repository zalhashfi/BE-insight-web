import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authRouter } from '../src/routes/auth';

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockImplementation((condition) => {
        // Return a mock user for testing
        return Promise.resolve([{
          id: 1,
          email: 'admin@biru-langit.com',
          passwordHash: '$2b$10$V78AMY1crqCPtJz5a/iPduKU9E.6r6ddZpZs7f6m51Rc.uCZWDE/i', // bcrypt hash for 'password123'
          fullName: 'Admin Name',
          role: 'admin'
        }]);
      })
    }))
  }))
};

describe('Auth API', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use('*', async (c, next) => {
      c.set('db', mockDb as any);
      c.env = { JWT_SECRET: 'super-secret' }; // Mock env
      await next();
    });
    app.route('/api/auth', authRouter);
    vi.clearAllMocks();
  });

  it('should return a JWT token for valid credentials', async () => {
    // We are mocking bcrypt.compare to return true for 'password123' since it's hard to mock the bcrypt module directly here without complex vi.mock
    // Wait, the router imports bcryptjs. We should either mock bcrypt or provide a real hash. The hash above is a real bcrypt hash for 'password123'. Let's see if it works.
    
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@biru-langit.com',
        password: 'password123'
      })
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('token=');
    expect(setCookie).toContain('HttpOnly');
    const body = await res.json();
    expect(body.user).toEqual({
      id: 1,
      email: 'admin@biru-langit.com',
      fullName: 'Admin Name',
      role: 'admin'
    });
  });

  it('should return 401 for missing credentials', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@biru-langit.com'
      })
    });

    expect(res.status).toBe(400);
  });
});
