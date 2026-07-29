import { Hono } from 'hono';
import { users } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';import { z } from 'zod';
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
  }).from(users).where(isNull(users.deletedAt));
  
  return c.json({ users: allUsers }, 200);
});

usersRouter.get('/me', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  
  if (!payload?.id) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await db.select({
    id: users.id,
    email: users.email,
    fullName: users.fullName,
    role: users.role,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt
  }).from(users).where(eq(users.id, payload.id));

  if (user.length === 0) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ data: user[0] }, 200);
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

const adminUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['admin', 'engineer', 'user']).optional(),
  newPassword: z.string().min(8).optional(),
});

const selfUpdateSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

usersRouter.put('/:id', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  if (payload?.role !== 'admin' && payload?.id !== id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const body = await c.req.json();
    
    if (payload?.role === 'admin') {
      const result = adminUpdateSchema.safeParse(body);
      if (!result.success) {
        return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
      }
      const { fullName, role, newPassword } = result.data;
      const updateData: any = { updatedAt: new Date() };
      if (fullName) updateData.fullName = fullName;
      if (role) updateData.role = role;
      if (newPassword) {
        updateData.passwordHash = await bcrypt.hash(newPassword, 10);
      }
      await db.update(users).set(updateData).where(eq(users.id, id));
      return c.json({ message: 'User updated successfully' }, 200);
    } else {
      const result = selfUpdateSchema.safeParse(body);
      if (!result.success) {
        return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
      }
      const { oldPassword, newPassword } = result.data;
      
      const userRecords = await db.select().from(users).where(eq(users.id, id));
      if (userRecords.length === 0) {
        return c.json({ error: 'User not found' }, 404);
      }
      
      const user = userRecords[0];
      const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isMatch) {
        return c.json({ error: 'Invalid old password' }, 401);
      }
      
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
      return c.json({ message: 'Password updated successfully' }, 200);
    }
  } catch (error: any) {
    return c.json({ error: 'Error updating user' }, 500);
  }
});

usersRouter.delete('/:id', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  if (payload?.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  
  if (payload.id === id) {
    return c.json({ error: 'Cannot delete yourself' }, 400);
  }

  try {
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
    return c.json({ message: 'User deleted successfully' }, 200);
  } catch (error: any) {
    return c.json({ error: 'Error deleting user' }, 500);
  }
});
