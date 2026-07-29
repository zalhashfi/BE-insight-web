import { Hono } from 'hono';
import { station } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
export const stationsRouter = new Hono<{ Variables: { db: any, jwtPayload: any } }>();

stationsRouter.get('/', async (c) => {
  const db = c.get('db');
  
  const allStations = await db.select().from(station).where(isNull(station.deletedAt));
  
  return c.json({ stations: allStations }, 200);
});
import { unregisteredDevices } from '../db/schema';

stationsRouter.get('/unregistered', async (c) => {
  const db = c.get('db');
  
  // optionally check auth, but currently / is not checking auth for GET, let's keep consistency or we could add auth
  const payload = c.get('jwtPayload');
  if (payload?.role !== 'admin' && payload?.role !== 'engineer') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const unreg = await db.select().from(unregisteredDevices);
  
  return c.json({ data: unreg }, 200);
});
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const createStationSchema = z.object({
  uuid: z.string().min(3).max(20).regex(/^[a-zA-Z0-9\-]+$/, 'UUID must be alphanumeric with optional dashes'),
  name: z.string().min(2).max(100),
  projectName: z.string().min(2).max(100),
  type: z.enum(['aqms', 'soc']),
  macAddress: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

stationsRouter.post('/', zValidator('json', createStationSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  
  if (payload?.role !== 'admin' && payload?.role !== 'engineer') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { uuid, name, type, latitude, longitude, projectName, macAddress } = c.req.valid('json');

  try {
    await db.insert(station).values({
      uuid,
      name,
      type,
      latitude,
      longitude,
      projectName,
      macAddress,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    if (macAddress) {
      await db.delete(unregisteredDevices).where(eq(unregisteredDevices.macAddress, macAddress));
    }

    return c.json({ message: 'Station created successfully' }, 201);
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return c.json({ error: 'Station UUID already exists' }, 409);
    }
    return c.json({ error: 'Error creating station' }, 500);
  }
});

stationsRouter.delete('/unregistered/:macAddress', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  const macAddress = c.req.param('macAddress');
  
  if (payload?.role !== 'admin' && payload?.role !== 'engineer') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    await db.delete(unregisteredDevices).where(eq(unregisteredDevices.macAddress, macAddress));
    return c.json({ message: 'Unregistered device deleted successfully' }, 200);
  } catch (error: any) {
    return c.json({ error: 'Error deleting unregistered device' }, 500);
  }
});

stationsRouter.get('/:uuid', async (c) => {
  const db = c.get('db');
  const uuid = c.req.param('uuid');
  
  const payload = c.get('jwtPayload');
  if (payload?.role !== 'admin' && payload?.role !== 'engineer') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const s = await db.select().from(station).where(eq(station.uuid, uuid));
  
  if (s.length === 0) {
    return c.json({ error: 'Station not found' }, 404);
  }

  return c.json({ data: s[0] }, 200);
});

const updateStationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  projectName: z.string().min(2).max(100).optional(),
  type: z.enum(['aqms', 'soc']).optional(),
  macAddress: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

stationsRouter.put('/:uuid', zValidator('json', updateStationSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  const uuid = c.req.param('uuid');
  
  if (payload?.role !== 'admin' && payload?.role !== 'engineer') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const validData = c.req.valid('json');

  try {
    await db.update(station).set({ ...validData, updatedAt: new Date() }).where(eq(station.uuid, uuid));
    return c.json({ message: 'Station updated successfully' }, 200);
  } catch (error: any) {
    return c.json({ error: 'Error updating station' }, 500);
  }
});

stationsRouter.delete('/:uuid', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  const uuid = c.req.param('uuid');
  
  if (payload?.role !== 'admin' && payload?.role !== 'engineer') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    await db.update(station).set({ deletedAt: new Date() }).where(eq(station.uuid, uuid));
    return c.json({ message: 'Station deleted successfully' }, 200);
  } catch (error: any) {
    return c.json({ error: 'Error deleting station' }, 500);
  }
});
