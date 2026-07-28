import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { station, rawSensorLog, dataAqms, dataSoc, firmwareRelease, unregisteredDevices } from '../db/schema';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

export const iotRouter = new Hono<{ Bindings: { IOT_DEVICE_SECRET: string }, Variables: { db: any } }>();

const identitySchema = z.object({
  macAddress: z.string().min(1)
});

iotRouter.post('/identity', zValidator('json', identitySchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed' }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  
  const deviceSecret = c.req.header('x-device-secret');
  if (!deviceSecret || deviceSecret !== c.env.IOT_DEVICE_SECRET) {
    return c.json({ error: 'Unauthorized device' }, 401);
  }

  const { macAddress } = c.req.valid('json');

  const stations = await db.select().from(station).where(eq(station.macAddress, macAddress));
  
  if (stations.length === 0) {
    // Log unregistered MAC address
    // Delete older than 24 hours
    await db.delete(unregisteredDevices).where(sql`last_seen_at < NOW() - INTERVAL 1 DAY`);
    // Insert or update (on duplicate key) using raw sql or just insert ignore, but we can do an insert with on duplicate key update if drizzle supports it.
    // Drizzle MySQL onDuplicateKeyUpdate:
    await db.insert(unregisteredDevices).values({
      macAddress: macAddress,
      lastSeenAt: new Date()
    }).onDuplicateKeyUpdate({
      set: { lastSeenAt: new Date() }
    });

    return c.json({ error: 'Device not registered. Please contact administrator.' }, 404);
  }

  return c.json({ uuid: stations[0].uuid }, 200);
});

const aqmsPayloadSchema = z.object({
  pm25: z.number().min(0).max(1000).optional(),
  no2: z.number().optional(),
  co: z.number().optional(),
  temp: z.number().optional(),
  hum: z.number().optional(),
  ws: z.number().optional(),
  wd: z.number().optional(),
});

const socPayloadSchema = z.object({
  ph: z.number().min(0).max(14).optional(),
  no2: z.number().optional(),
  ec: z.number().optional(),
  temp: z.number().optional(),
  hum: z.number().optional(),
  n: z.number().optional(),
  p: z.number().optional(),
  k: z.number().optional(),
});

iotRouter.post('/ingest', async (c) => {
  const db = c.get('db');
  // UUID is passed as API Key
  const apiKey = c.req.header('x-api-key');

  if (!apiKey) {
    return c.json({ error: 'API Key is required' }, 401);
  }

  // Find station by UUID
  const stations = await db.select().from(station).where(eq(station.uuid, apiKey));
  if (stations.length === 0) {
    return c.json({ error: 'Invalid API Key' }, 401);
  }
  
  const currentStation = stations[0];
  
  let payload: any;
  try {
    payload = await c.req.json();
  } catch (e) {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  // 1. Insert into Cold Path (raw_sensor_log)
  await db.insert(rawSensorLog).values({
    stationUuid: currentStation.uuid,
    firmwareVersion: currentStation.currentVersion || 'unknown',
    dataPayload: payload,
    receivedAt: new Date()
  });

  // 2. Validate and Insert for Hot Path based on type
  if (currentStation.type === 'aqms') {
    const parseResult = aqmsPayloadSchema.safeParse(payload);
    
    if (parseResult.success) {
      const validData = parseResult.data;
      if (validData.pm25 !== undefined) {
        await db.insert(dataAqms).values({
          stationUuid: currentStation.uuid,
          pm25: validData.pm25,
          no2: validData.no2,
          co: validData.co,
          temp: validData.temp,
          hum: validData.hum,
          ws: validData.ws,
          wd: validData.wd,
          measuredAt: new Date()
        });
      }
    }
  } else if (currentStation.type === 'soc') {
    const parseResult = socPayloadSchema.safeParse(payload);
    
    if (parseResult.success) {
      const validData = parseResult.data;
      if (validData.ph !== undefined || validData.n !== undefined) {
        await db.insert(dataSoc).values({
          stationUuid: currentStation.uuid,
          ph: validData.ph,
          no2: validData.no2,
          ec: validData.ec,
          temp: validData.temp,
          hum: validData.hum,
          n: validData.n,
          p: validData.p,
          k: validData.k,
          measuredAt: new Date()
        });
      }
    }
  }

  return c.json({ message: 'Data ingested successfully' }, 200);
});

iotRouter.get('/ota', async (c) => {
  const db = c.get('db');
  const apiKey = c.req.header('x-api-key');
  const currentVersion = c.req.query('current_version');

  if (!apiKey) {
    return c.json({ error: 'API Key is required' }, 401);
  }

  // Find station by UUID
  const stations = await db.select().from(station).where(eq(station.uuid, apiKey));
  if (stations.length === 0) {
    return c.json({ error: 'Invalid API Key' }, 401);
  }
  
  const currentStation = stations[0];

  // Update current station firmware version if provided
  if (currentVersion && currentVersion !== currentStation.currentVersion) {
    await db.update(station)
      .set({ currentVersion: currentVersion })
      .where(eq(station.uuid, currentStation.uuid));
  }

  // Get latest firmware release for this project
  const latestVersions = await db.select()
    .from(firmwareRelease)
    .where(eq(firmwareRelease.projectName, currentStation.projectName))
    .orderBy(desc(firmwareRelease.createdAt))
    .limit(1);

  if (latestVersions.length > 0) {
    const latest = latestVersions[0];
    if (latest.version !== currentVersion) {
      return c.json({
        update_available: true,
        latest_version: latest.version,
        github_url: latest.binFileUrl
      }, 200);
    }
  }

  return c.json({
    update_available: false,
    latest_version: currentVersion || 'unknown'
  }, 200);
});
