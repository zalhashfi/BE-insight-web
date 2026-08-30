import { Router, Request, Response } from 'express';
import { query } from '../db/pool.js';

export const usersRouter = Router();

// GET / - List all registered users without password_hash
usersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await query<any[]>(
      'SELECT id, name, email, role, created_at FROM user ORDER BY created_at DESC'
    );
    return res.status(200).json({ data: users || [] });
  } catch (err: any) {
    console.error('Failed to fetch users:', err);
    return res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});
