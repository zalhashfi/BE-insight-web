import { Hono } from 'hono';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import * as bcrypt from 'bcryptjs';

export const usersRouter = new Hono<{ Variables: { db: any, jwtPayload: any } }>();

usersRouter.get('/', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  
  if (payload?.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    fullName: users.fullName,
    role: users.role,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt
  }).from(users);
  
  return c.json({ users: allUsers }, 200);
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(['admin', 'engineer', 'user']).optional()
});

usersRouter.post('/', zValidator('json', createUserSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  
  if (payload?.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { email, password, fullName, role } = c.req.valid('json');

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await db.insert(users).values({
      email,
      passwordHash,
      fullName,
      role: role || 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return c.json({ message: 'User created successfully' }, 201);
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return c.json({ error: 'Email already exists' }, 409);
    }
    return c.json({ error: 'Error creating user' }, 500);
  }
});
