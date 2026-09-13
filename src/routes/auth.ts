import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { getQueryAdapter } from '../db/adapter.js';
import { createAuthenticateJWT, type AuthUser } from '../middleware/auth.js';

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
}

interface IdRow {
  id: number;
}

interface InsertResult {
  insertId: number;
}

function authMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toAuthUser(row: Pick<UserRow, 'id' | 'name' | 'email' | 'role'>) {
  return {
    id: row.id,
    name: row.name,
    fullName: row.name,
    email: row.email,
    role: row.role,
  };
}

async function signToken(payload: Omit<AuthUser, never> & Record<string, unknown>, secret: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(new TextEncoder().encode(secret));
}

export function createAuthRouter(deps: { jwtSecret: string }) {
  const router = new Hono();
  const authenticateJWT = createAuthenticateJWT(deps.jwtSecret);

  // POST /register
  router.post('/register', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { name, email, password } = body ?? {};
    const role = 'viewer'; // Never accept role from unauthenticated request

    if (!name || !email || !password) {
      return c.json({ error: 'Name, email, and password are required' }, 400);
    }

    try {
      const query = getQueryAdapter();
      const existingUsers = await query<IdRow[]>('SELECT id FROM user WHERE email = ?', [email]);
      if (existingUsers && existingUsers.length > 0) {
        return c.json({ error: 'Email already registered' }, 400);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await query<InsertResult>(
        'INSERT INTO user (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, role]
      );

      return c.json(
        {
          message: 'User registered successfully',
          user: { id: result.insertId, name, fullName: name, email, role },
        },
        201
      );
    } catch (err: unknown) {
      console.error('Registration failed:', err);
      return c.json({ error: 'Registration failed', details: authMessage(err) }, 500);
    }
  });

  // POST /login
  router.post('/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { email, password } = body ?? {};

    if (!email || !password) {
      return c.json(
        { error: 'Email and password are required', message: 'Email and password are required' },
        400
      );
    }

    try {
      const query = getQueryAdapter();
      const users = await query<UserRow[]>(
        'SELECT id, name, email, password_hash, role FROM user WHERE email = ?',
        [email]
      );
      if (!users || users.length === 0) {
        return c.json({ error: 'Invalid credentials', message: 'Invalid credentials' }, 401);
      }

      const user = users[0];
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return c.json({ error: 'Invalid credentials', message: 'Invalid credentials' }, 401);
      }

      const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
      const token = await signToken(payload, deps.jwtSecret);

      return c.json({ token, user: toAuthUser(user) }, 200);
    } catch (err: unknown) {
      console.error('Login failed:', err);
      return c.json({ error: 'Login failed', details: authMessage(err) }, 500);
    }
  });

  // POST /logout (stateless JWT — FE clears session client-side)
  router.post('/logout', (c) => {
    return c.json({ message: 'Logged out' }, 200);
  });

  // GET /me
  router.get('/me', authenticateJWT, (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    return c.json(
      {
        user: {
          id: user.id,
          name: user.name,
          fullName: user.name,
          email: user.email,
          role: user.role,
        },
      },
      200
    );
  });

  return router;
}
