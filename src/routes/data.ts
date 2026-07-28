import { Hono } from 'hono';
import { dataAqms, dataSoc } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const dataRouter = new Hono<{ Variables: { db: any, jwtPayload: any } }>();

const querySchema = z.object({
  stationUuid: z.string().uuid()
});

dataRouter.get('/aqms', zValidator('query', querySchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  const { stationUuid } = c.req.valid('query');

  const data = await db.select().from(dataAqms)
    .where(eq(dataAqms.stationUuid, stationUuid))
    .orderBy(desc(dataAqms.measuredAt))
    .limit(100);
  
  return c.json({ data }, 200);
});

dataRouter.get('/soc', zValidator('query', querySchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  const { stationUuid } = c.req.valid('query');

  const data = await db.select().from(dataSoc)
    .where(eq(dataSoc.stationUuid, stationUuid))
    .orderBy(desc(dataSoc.measuredAt))
    .limit(100);
  
  return c.json({ data }, 200);
});

import { station } from '../db/schema';

dataRouter.get('/:uuid/history', async (c) => {
  const db = c.get('db');
  const uuid = c.req.param('uuid');
  
  // optionally limit
  const limitStr = c.req.query('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 100;

  // find station type
  const s = await db.select().from(station).where(eq(station.uuid, uuid));
  if (s.length === 0) {
    return c.json({ error: 'Station not found' }, 404);
  }

  const type = s[0].type;
  let data = [];

  if (type === 'aqms') {
    data = await db.select().from(dataAqms)
      .where(eq(dataAqms.stationUuid, uuid))
      .orderBy(desc(dataAqms.measuredAt))
      .limit(limit);
  } else if (type === 'soc') {
    data = await db.select().from(dataSoc)
      .where(eq(dataSoc.stationUuid, uuid))
      .orderBy(desc(dataSoc.measuredAt))
      .limit(limit);
  }

  return c.json({ type, data }, 200);
});
