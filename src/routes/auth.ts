import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { authenticateJWT, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

// POST /register
// ponytail: Allow open registration but always default to 'viewer' role.
// Add when: if registration should be admin-gated, apply authenticateJWT + requireAdmin middleware.
authRouter.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const role = 'viewer'; // Never accept role from unauthenticated request

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const existingUsers = await query<any[]>('SELECT id FROM user WHERE email = ?', [email]);
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query<any>(
      'INSERT INTO user (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.insertId,
        name,
        email,
        role
      }
    });
  } catch (err: any) {
    console.error('Registration failed:', err);
    return res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// POST /login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const users = await query<any[]>(
      'SELECT id, name, email, password_hash, role FROM user WHERE email = ?',
      [email]
    );
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET || 'secret';
    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });

    return res.status(200).json({ token, user: payload });
  } catch (err: any) {
    console.error('Login failed:', err);
    return res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// GET /me
authRouter.get('/me', authenticateJWT, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.status(200).json({ user: req.user });
});
