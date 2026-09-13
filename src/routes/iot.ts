import { Hono } from 'hono';
import { getQueryAdapter } from '../db/adapter.js';

export function createIotRouter(deps: { iotSecret: string }) {
  const router = new Hono();

  // 1. POST /identity
  router.post('/identity', async (c) => {
    const deviceSecret = c.req.header('x-device-secret');
    const iotDeviceSecret = deps.iotSecret;

    if (!deviceSecret || deviceSecret !== iotDeviceSecret) {
      return c.json({ error: 'Unauthorized device' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { mac_address } = body;
    if (!mac_address) {
      return c.json({ error: 'mac_address is required' }, 400);
    }

    try {
      const query = getQueryAdapter();
      const devices = await query<Array<{ uuid: string; type: string; project_name: string }>>(
        'SELECT uuid, type, project_name FROM device WHERE mac_address = ? AND is_deleted = FALSE',
        [mac_address]
      );

      if (devices && devices.length > 0) {
        return c.json(
          {
            uuid: devices[0].uuid,
            type: devices[0].type,
            project_name: devices[0].project_name,
          },
          200
        );
      }

      // Upsert to unregistered_device
      await query(
        `INSERT INTO unregistered_device (mac_address, last_seen_at) VALUES (?, NOW())
         ON DUPLICATE KEY UPDATE last_seen_at = NOW()`,
        [mac_address]
      );

      return c.json({ error: 'Device not registered' }, 404);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error in /identity:', err);
      return c.json({ error: 'Internal database error', details: message }, 500);
    }
  });

  // 2. POST /ingest
  router.post('/ingest', async (c) => {
    const apiKey = c.req.header('x-api-key');

    if (!apiKey) {
      return c.json({ error: 'API Key (x-api-key header) is required' }, 401);
    }

    try {
      const query = getQueryAdapter();
      const devices = await query<
        Array<{ id: number; uuid: string; type: string; current_version: string | null }>
      >('SELECT id, uuid, type, current_version FROM device WHERE uuid = ? AND is_deleted = FALSE', [
        apiKey,
      ]);

      if (!devices || devices.length === 0) {
        return c.json({ error: 'Invalid API Key' }, 401);
      }

      const currentDevice = devices[0];
      const payload = await c.req.json().catch(() => null);

      if (!payload || typeof payload !== 'object') {
        return c.json({ error: 'Invalid JSON payload' }, 400);
      }

      // Cold Path: insert into raw_data_log
      await query('INSERT INTO raw_data_log (device_id, payload, received_at) VALUES (?, ?, NOW())', [
        currentDevice.id,
        JSON.stringify(payload),
      ]);

      // Update last_seen_at
      await query('UPDATE device SET last_seen_at = NOW() WHERE id = ?', [currentDevice.id]);

      const measuredAt = payload.created_at ? new Date(payload.created_at) : new Date();

      // Hot Path based on device type
      if (currentDevice.type === 'aqms') {
        await query(
          `INSERT INTO aqms_reading
            (device_id, pm25, no2, co, co2, temperature, humidity, ws, wd, measured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            currentDevice.id,
            payload.pm25 ?? null,
            payload.no2 ?? null,
            payload.co ?? null,
            payload.co2 ?? null,
            payload.temperature ?? payload.temp ?? null,
            payload.humidity ?? payload.hum ?? null,
            payload.ws ?? null,
            payload.wd ?? null,
            measuredAt,
          ]
        );
      } else if (currentDevice.type === 'soc') {
        await query(
          `INSERT INTO soc_reading
            (device_id, ph, no2, ec, temperature, humidity, n, p, k, measured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            currentDevice.id,
            payload.ph ?? null,
            payload.no2 ?? null,
            payload.ec ?? null,
            payload.temperature ?? payload.temp ?? null,
            payload.humidity ?? payload.hum ?? null,
            payload.n ?? null,
            payload.p ?? null,
            payload.k ?? null,
            measuredAt,
          ]
        );
      }

      return c.json({ message: 'Data ingested successfully' }, 200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error in /ingest:', err);
      return c.json({ error: 'Database insert failed', details: message }, 500);
    }
  });

  // 3. GET /ota
  router.get('/ota', async (c) => {
    const apiKey = c.req.header('x-api-key');
    const currentVersion = c.req.query('current_version');

    if (!apiKey) {
      return c.json({ error: 'API Key (x-api-key header) is required' }, 401);
    }

    try {
      const query = getQueryAdapter();
      const devices = await query<
        Array<{
          id: number;
          uuid: string;
          project_name: string;
          current_version: string | null;
        }>
      >('SELECT id, uuid, project_name, current_version FROM device WHERE uuid = ? AND is_deleted = FALSE', [
        apiKey,
      ]);

      if (!devices || devices.length === 0) {
        return c.json({ error: 'Invalid API Key' }, 401);
      }

      const currentDevice = devices[0];

      // Update device current_version if provided and different
      if (currentVersion && currentVersion !== currentDevice.current_version) {
        await query('UPDATE device SET current_version = ? WHERE id = ?', [
          currentVersion,
          currentDevice.id,
        ]);
        currentDevice.current_version = currentVersion;
      }

      const releases = await query<Array<{ version: string; bin_file_url: string }>>(
        'SELECT version, bin_file_url FROM firmware_release WHERE project_name = ? ORDER BY created_at DESC LIMIT 1',
        [currentDevice.project_name]
      );

      const storedCurrentVersion = currentDevice.current_version;

      if (releases && releases.length > 0) {
        const latest = releases[0];
        if (latest.version !== storedCurrentVersion) {
          return c.json(
            {
              update_available: true,
              latest_version: latest.version,
              bin_file_url: latest.bin_file_url,
            },
            200
          );
        }
      }

      return c.json(
        {
          update_available: false,
          latest_version: storedCurrentVersion || '1.0.0',
        },
        200
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error in /ota:', err);
      return c.json({ error: 'Failed to check OTA update', details: message }, 500);
    }
  });

  return router;
}
