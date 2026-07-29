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

const parseNum = z.preprocess((val) => {
  if (val === "" || val === "NULL" || val === null || val === undefined) return undefined;
  const parsed = Number(val);
  return isNaN(parsed) ? undefined : parsed;
}, z.number().optional());

const aqmsPayloadSchema = z.object({
  pm25: z.preprocess((val) => {
    if (val === "" || val === "NULL" || val === null || val === undefined) return undefined;
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().min(0).max(1000).optional()),
  no2: parseNum,
  co2: parseNum,
  temperature: parseNum,
  humidity: parseNum,
  ws: parseNum,
  wd: parseNum,
});

const socPayloadSchema = z.object({
  ph: z.preprocess((val) => {
    if (val === "" || val === "NULL" || val === null || val === undefined) return undefined;
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().min(0).max(14).optional()),
  no2: parseNum,
  ec: parseNum,
  temp: parseNum,
  hum: parseNum,
  n: parseNum,
  p: parseNum,
  k: parseNum,
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
        try {
          await db.insert(dataAqms).values({
            stationUuid: currentStation.uuid,
            pm25: validData.pm25,
            no2: validData.no2,
            co: validData.co2,
            temp: validData.temperature,
            hum: validData.humidity,
            ws: validData.ws,
            wd: validData.wd,
            measuredAt: new Date()
          });
        } catch (dbErr: any) {
          console.error("DB Insert Error AQMS:", dbErr);
          return c.json({ error: 'Database insert failed for AQMS', details: dbErr.message }, 500);
        }
      } else {
        return c.json({ error: 'pm25 is missing or invalid', parsed: validData }, 400);
      }
    } else {
      return c.json({ error: 'AQMS payload validation failed', details: parseResult.error }, 400);
    }
  } else if (currentStation.type === 'soc') {
    const parseResult = socPayloadSchema.safeParse(payload);
    
    if (parseResult.success) {
      const validData = parseResult.data;
      if (validData.ph !== undefined || validData.n !== undefined) {
        try {
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
        } catch (dbErr: any) {
          console.error("DB Insert Error SOC:", dbErr);
          return c.json({ error: 'Database insert failed for SOC', details: dbErr.message }, 500);
        }
      } else {
        return c.json({ error: 'ph or n is missing or invalid', parsed: validData }, 400);
      }
    } else {
      return c.json({ error: 'SOC payload validation failed', details: parseResult.error }, 400);
    }
  } else {
    return c.json({ error: 'Unknown or missing station type', type: currentStation.type }, 400);
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
