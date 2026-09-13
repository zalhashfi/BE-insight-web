import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';

export const usersRouter = Router();

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

// GET / - List all registered users without password_hash
usersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await query<UserRow[]>(
      'SELECT id, name, email, role, created_at FROM user ORDER BY created_at DESC'
    );
    return res.status(200).json({ users: (users || []).map(toUser) });
  } catch (err: unknown) {
    console.error('Failed to fetch users:', err);
    return res.status(500).json({ error: 'Failed to fetch users', details: usersMessage(err) });
  }
});

// POST / - Create user (admin only via mount in index.ts)
usersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body: Record<string, string | undefined> = req.body ?? {};
    const email = body.email;
    const password = body.password;
    const name = body.name ?? body.fullName;
    const role = body.role ?? 'user';

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields: email, password, name' });
    }
    if (!(MANAGED_ROLES as readonly string[]).includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "admin", "engineer", "user", or "viewer"' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await query<IdRow[]>('SELECT id FROM user WHERE email = ?', [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query<InsertResult>(
      'INSERT INTO user (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.insertId,
        email,
        name,
        fullName: name,
        role,
      },
    });
  } catch (err: unknown) {
    console.error('Failed to create user:', err);
    return res.status(500).json({ error: 'Failed to create user', details: usersMessage(err) });
  }
});
