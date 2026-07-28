import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { sign } from 'hono/jwt';
import { setCookie } from 'hono/cookie';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

export const authRouter = new Hono<{ Variables: { db: any }, Bindings: { JWT_SECRET: string } }>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post('/login', zValidator('json', loginSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  
  const { email, password } = c.req.valid('json');

  const result = await db.select().from(users).where(eq(users.email, email));
  if (result.length === 0) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const user = result[0];

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const payload = {
    id: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
  };

  const secret = c.env?.JWT_SECRET;
  if (!secret) {
    return c.json({ error: 'Server configuration error: missing JWT_SECRET' }, 500);
  }
  const token = await sign(payload, secret, 'HS256');

  // Set the HttpOnly cookie
  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: true, // Requires HTTPS (handled by Cloudflare)
    sameSite: 'Strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    }
  }, 200);
});

// Endpoint to check auth status from HttpOnly Cookie
authRouter.get('/me', async (c) => {
  // We'll rely on the global JWT middleware to validate the cookie first
  return c.json({ message: 'Use /api/users/me for this' }, 200);
});

// Endpoint to logout
authRouter.post('/logout', (c) => {
  setCookie(c, 'token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0, // Immediately expires the cookie
  });
  return c.json({ message: 'Logged out successfully' }, 200);
});
