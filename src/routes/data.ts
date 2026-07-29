import { Hono } from 'hono';
import { dataAqms, dataSoc, station } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const dataRouter = new Hono<{ Variables: { db: any, jwtPayload: any } }>();

const querySchema = z.object({
  stationUuid: z.string().min(3).max(20)
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

dataRouter.get('/:uuid/history', async (c) => {
  const db = c.get('db');
  const uuid = c.req.param('uuid');
  
  // optionally limit
  const limitStr = c.req.query('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 100;
  
  const interval = c.req.query('interval') || '2m';

  // find station type
  const s = await db.select().from(station).where(eq(station.uuid, uuid));
  if (s.length === 0) {
    return c.json({ error: 'Station not found' }, 404);
  }

  const type = s[0].type;
  let data: any = [];

  try {
    if (type === 'aqms') {
      if (interval === '1h') {
        const [rows] = await db.execute(sql`SELECT AVG(pm25) as pm25, AVG(no2) as no2, AVG(co) as co, AVG(temp) as temp, AVG(hum) as hum, AVG(ws) as ws, AVG(wd) as wd, DATE_FORMAT(measured_at, '%Y-%m-%d %H:00:00') as measuredAt FROM data_aqms WHERE station_uuid = ${uuid} GROUP BY DATE_FORMAT(measured_at, '%Y-%m-%d %H:00:00') ORDER BY measuredAt DESC LIMIT ${limit}`);
        data = rows;
      } else if (interval === '1d') {
        const [rows] = await db.execute(sql`SELECT AVG(pm25) as pm25, AVG(no2) as no2, AVG(co) as co, AVG(temp) as temp, AVG(hum) as hum, AVG(ws) as ws, AVG(wd) as wd, DATE_FORMAT(measured_at, '%Y-%m-%d') as measuredAt FROM data_aqms WHERE station_uuid = ${uuid} GROUP BY DATE_FORMAT(measured_at, '%Y-%m-%d') ORDER BY measuredAt DESC LIMIT ${limit}`);
        data = rows;
      } else {
        data = await db.select().from(dataAqms)
          .where(eq(dataAqms.stationUuid, uuid))
          .orderBy(desc(dataAqms.measuredAt))
          .limit(limit);
      }
    } else if (type === 'soc') {
      if (interval === '1h') {
        const [rows] = await db.execute(sql`SELECT AVG(ph) as ph, AVG(no2) as no2, AVG(ec) as ec, AVG(temp) as temp, AVG(hum) as hum, AVG(n) as n, AVG(p) as p, AVG(k) as k, DATE_FORMAT(measured_at, '%Y-%m-%d %H:00:00') as measuredAt FROM data_soc WHERE station_uuid = ${uuid} GROUP BY DATE_FORMAT(measured_at, '%Y-%m-%d %H:00:00') ORDER BY measuredAt DESC LIMIT ${limit}`);
        data = rows;
      } else if (interval === '1d') {
        const [rows] = await db.execute(sql`SELECT AVG(ph) as ph, AVG(no2) as no2, AVG(ec) as ec, AVG(temp) as temp, AVG(hum) as hum, AVG(n) as n, AVG(p) as p, AVG(k) as k, DATE_FORMAT(measured_at, '%Y-%m-%d') as measuredAt FROM data_soc WHERE station_uuid = ${uuid} GROUP BY DATE_FORMAT(measured_at, '%Y-%m-%d') ORDER BY measuredAt DESC LIMIT ${limit}`);
        data = rows;
      } else {
        data = await db.select().from(dataSoc)
          .where(eq(dataSoc.stationUuid, uuid))
          .orderBy(desc(dataSoc.measuredAt))
          .limit(limit);
      }
    }
    
    return c.json({ type, data }, 200);
  } catch (err: any) {
    console.error("Error fetching history:", err);
    return c.json({ error: 'Failed to fetch history data', details: err.message }, 500);
  }
});
