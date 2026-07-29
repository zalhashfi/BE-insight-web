import { Hono } from 'hono';
import { firmwareRelease } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

export const firmwareRouter = new Hono<{ Variables: { db: any, jwtPayload: any } }>();

firmwareRouter.get('/', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  
  if (payload?.role !== 'admin' && payload?.role !== 'engineer') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const releases = await db.select().from(firmwareRelease).orderBy(desc(firmwareRelease.createdAt));
  return c.json({ data: releases }, 200);
});

const createFirmwareSchema = z.object({
  projectName: z.string().min(2).max(100),
  version: z.string().min(1).max(20),
  binFileUrl: z.string().url(),
  releaseNotes: z.string().optional(),
  isLatest: z.boolean().optional(),
});

firmwareRouter.post('/', zValidator('json', createFirmwareSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  
  if (payload?.role !== 'admin' && payload?.role !== 'engineer') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { projectName, version, binFileUrl, releaseNotes, isLatest } = c.req.valid('json');

  try {
    if (isLatest) {
      await db.update(firmwareRelease).set({ isLatest: false }).where(eq(firmwareRelease.projectName, projectName));
    }
    
    await db.insert(firmwareRelease).values({
      projectName,
      version,
      binFileUrl,
      releaseNotes,
      isLatest: isLatest || false,
      createdAt: new Date()
    });

    return c.json({ message: 'Firmware release created successfully' }, 201);
  } catch (error: any) {
    return c.json({ error: 'Error creating firmware release' }, 500);
  }
});

firmwareRouter.put('/:id', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  if (payload?.role !== 'admin' && payload?.role !== 'engineer') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const body = await c.req.json();
    const validData = createFirmwareSchema.partial().parse(body);

    if (validData.isLatest && validData.projectName) {
      await db.update(firmwareRelease).set({ isLatest: false }).where(eq(firmwareRelease.projectName, validData.projectName));
    }

    await db.update(firmwareRelease).set(validData).where(eq(firmwareRelease.id, id));
    return c.json({ message: 'Firmware release updated successfully' }, 200);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.format() }, 400);
    }
    return c.json({ error: 'Error updating firmware release' }, 500);
  }
});

firmwareRouter.delete('/:id', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  const id = parseInt(c.req.param('id'), 10);
  
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  if (payload?.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    await db.delete(firmwareRelease).where(eq(firmwareRelease.id, id));
    return c.json({ message: 'Firmware release deleted successfully' }, 200);
  } catch (error: any) {
    return c.json({ error: 'Error deleting firmware release' }, 500);
  }
});
