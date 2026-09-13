import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { getQueryAdapter } from '../db/adapter.js';

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string | null;
}

interface IdRow {
  id: number;
}

interface InsertResult {
  insertId: number;
}

function usersMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    fullName: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}

const MANAGED_ROLES = ['admin', 'engineer', 'user', 'viewer'] as const;

export function createUsersRouter() {
  const router = new Hono();

  // GET / - List all registered users without password_hash
  router.get('/', async (c) => {
    try {
      const query = getQueryAdapter();
      const users = await query<UserRow[]>(
        'SELECT id, name, email, role, created_at FROM user ORDER BY created_at DESC'
      );
      return c.json({ users: (users || []).map(toUser) }, 200);
    } catch (err: unknown) {
      console.error('Failed to fetch users:', err);
      return c.json({ error: 'Failed to fetch users', details: usersMessage(err) }, 500);
    }
  });

  // POST / - Create user (admin only via mount in app.ts)
  router.post('/', async (c) => {
    try {
      const query = getQueryAdapter();
      const body: Record<string, string | undefined> = await c.req.json().catch(() => ({}));
      const email = body.email;
      const password = body.password;
      const name = body.name ?? body.fullName;
      const role = body.role ?? 'user';

      if (!email || !password || !name) {
        return c.json({ error: 'Missing required fields: email, password, name' }, 400);
      }
      if (!(MANAGED_ROLES as readonly string[]).includes(role)) {
        return c.json({ error: 'Invalid role. Must be "admin", "engineer", "user", or "viewer"' }, 400);
      }
      if (password.length < 8) {
        return c.json({ error: 'Password must be at least 8 characters' }, 400);
      }

      const existing = await query<IdRow[]>('SELECT id FROM user WHERE email = ?', [email]);
      if (existing && existing.length > 0) {
        return c.json({ error: 'Email already registered' }, 400);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await query<InsertResult>(
        'INSERT INTO user (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, role]
      );

      return c.json(
        {
          message: 'User created successfully',
          user: { id: result.insertId, email, name, fullName: name, role },
        },
        201
      );
    } catch (err: unknown) {
      console.error('Failed to create user:', err);
      return c.json({ error: 'Failed to create user', details: usersMessage(err) }, 500);
    }
  });

  return router;
}
