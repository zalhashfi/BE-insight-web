import { Hono } from 'hono';
import { getQueryAdapter } from '../db/adapter.js';
import { requireAdmin } from '../middleware/auth.js';

interface DeviceRow {
  id: number;
  uuid: string;
  mac_address: string | null;
  name: string;
  type: string;
  project_name: string;
  current_version: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  last_seen_at: string | null;
  created_at: string | null;
}

interface UnregisteredRow {
  mac_address: string;
  last_seen_at: string;
}

interface CountRow {
  count: number | string | null;
}

interface IdRow {
  id: number;
}

function toDevice(row: DeviceRow) {
  return {
    uuid: row.uuid,
    name: row.name,
    type: row.type,
    macAddress: row.mac_address ?? null,
    projectName: row.project_name,
    currentVersion: row.current_version ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    lastSeenAt: row.last_seen_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

function dbMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createDevicesRouter() {
  const router = new Hono();

  // 1. GET / - List all devices with is_deleted = FALSE (supports ?type= & ?project_name=)
  router.get('/', async (c) => {
    const type = c.req.query('type');
    const projectName = c.req.query('project_name') || c.req.query('projectName');

    let sql =
      'SELECT uuid, mac_address, name, type, project_name, current_version, latitude, longitude, last_seen_at, created_at FROM device WHERE is_deleted = FALSE';
    const params: Array<string | number | null> = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (projectName) {
      sql += ' AND project_name = ?';
      params.push(projectName);
    }

    sql += ' ORDER BY created_at DESC';

    try {
      const query = getQueryAdapter();
      const devices = await query<DeviceRow[]>(sql, params);
      return c.json({ devices: (devices || []).map(toDevice) }, 200);
    } catch (err: unknown) {
      console.error('Failed to fetch devices:', err);
      return c.json({ error: 'Failed to fetch devices', details: dbMessage(err) }, 500);
    }
  });

  // 3. GET /unregistered - List all from unregistered_device order by last_seen_at desc
  router.get('/unregistered', requireAdmin, async (c) => {
    try {
      const query = getQueryAdapter();
      const unregistered = await query<UnregisteredRow[]>(
        'SELECT mac_address, last_seen_at FROM unregistered_device ORDER BY last_seen_at DESC'
      );
      return c.json(
        {
          data: (unregistered || []).map((r) => ({
            macAddress: r.mac_address,
            lastSeenAt: r.last_seen_at,
          })),
        },
        200
      );
    } catch (err: unknown) {
      console.error('Failed to fetch unregistered devices:', err);
      return c.json({ error: 'Failed to fetch unregistered devices', details: dbMessage(err) }, 500);
    }
  });

  // 4. GET /:uuid - Detail device + count total logs/readings
  router.get('/:uuid', async (c) => {
    const uuid = c.req.param('uuid');

    try {
      const query = getQueryAdapter();
      const devices = await query<DeviceRow[]>(
        'SELECT * FROM device WHERE uuid = ? AND is_deleted = FALSE',
        [uuid]
      );
      if (!devices || devices.length === 0) {
        return c.json({ error: 'Device not found' }, 404);
      }
      const device = devices[0];

      const rawLogs = await query<CountRow[]>(
        'SELECT COUNT(*) as count FROM raw_data_log WHERE device_id = ?',
        [device.id]
      );
      const totalLogs = Number(rawLogs?.[0]?.count || 0);

      let totalReadings = 0;
      if (device.type === 'aqms') {
        const aqmsLogs = await query<CountRow[]>(
          'SELECT COUNT(*) as count FROM aqms_reading WHERE device_id = ?',
          [device.id]
        );
        totalReadings = Number(aqmsLogs?.[0]?.count || 0);
      } else if (device.type === 'soc') {
        const socLogs = await query<CountRow[]>(
          'SELECT COUNT(*) as count FROM soc_reading WHERE device_id = ?',
          [device.id]
        );
        totalReadings = Number(socLogs?.[0]?.count || 0);
      }

      return c.json(
        {
          data: {
            ...toDevice(device),
            totalLogs,
            totalReadings,
          },
        },
        200
      );
    } catch (err: unknown) {
      console.error('Failed to fetch device details:', err);
      return c.json({ error: 'Failed to fetch device details', details: dbMessage(err) }, 500);
    }
  });

  // 2. POST / - Register new device (manual uuid, name, type, project_name; mac_address + location optional)
  router.post('/', requireAdmin, async (c) => {
    try {
      const query = getQueryAdapter();
      const body: Record<string, string | number | null | undefined> =
        await c.req.json().catch(() => ({}));
      const uuid = body.uuid as string | undefined;
      const name = body.name as string | undefined;
      const type = body.type as string | undefined;
      const project_name = (body.project_name ?? body.projectName) as string | undefined;
      const mac_address = (body.mac_address ?? body.macAddress ?? null) as string | null;
      const latitude = (body.latitude ?? null) as string | number | null;
      const longitude = (body.longitude ?? null) as string | number | null;

      if (!uuid || !name || !type || !project_name) {
        return c.json({ error: 'Missing required fields: uuid, name, type, project_name' }, 400);
      }
      if (!['aqms', 'soc'].includes(type)) {
        return c.json({ error: 'Invalid type. Must be "aqms" or "soc"' }, 400);
      }

      if (mac_address) {
        const existing = await query<Pick<DeviceRow, 'uuid' | 'mac_address'>[]>(
          'SELECT uuid, mac_address FROM device WHERE (uuid = ? OR mac_address = ?) AND is_deleted = FALSE',
          [uuid, mac_address]
        );

        if (existing && existing.length > 0) {
          return c.json({ error: 'Device with given uuid or mac_address already exists' }, 409);
        }
      } else {
        const existing = await query<Pick<DeviceRow, 'uuid'>[]>(
          'SELECT uuid FROM device WHERE uuid = ? AND is_deleted = FALSE',
          [uuid]
        );

        if (existing && existing.length > 0) {
          return c.json({ error: 'Device with given uuid already exists' }, 409);
        }
      }

      await query(
        'INSERT INTO device (uuid, mac_address, name, type, project_name, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuid, mac_address, name, type, project_name, latitude, longitude]
      );

      if (mac_address) {
        await query('DELETE FROM unregistered_device WHERE mac_address = ?', [mac_address]);
      }

      return c.json({ message: 'Device registered successfully', uuid }, 201);
    } catch (err: unknown) {
      console.error('Failed to register device:', err);
      return c.json({ error: 'Failed to register device', details: dbMessage(err) }, 500);
    }
  });

  // 5. PUT /:uuid - Update name, type, project_name, latitude, longitude
  router.put('/:uuid', requireAdmin, async (c) => {
    const uuid = c.req.param('uuid');

    try {
      const query = getQueryAdapter();
      const body: Record<string, string | number | null | undefined> =
        await c.req.json().catch(() => ({}));
      const name = body.name as string | undefined;
      const type = body.type as string | undefined;
      const project_name = (body.project_name ?? body.projectName) as string | undefined;
      const latitude = body.latitude as string | number | null | undefined;
      const longitude = body.longitude as string | number | null | undefined;

      const existing = await query<IdRow[]>(
        'SELECT id FROM device WHERE uuid = ? AND is_deleted = FALSE',
        [uuid]
      );
      if (!existing || existing.length === 0) {
        return c.json({ error: 'Device not found' }, 404);
      }

      const updates: string[] = [];
      const params: Array<string | number | null> = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (type !== undefined) {
        if (!['aqms', 'soc'].includes(type)) return c.json({ error: 'Invalid type' }, 400);
        updates.push('type = ?');
        params.push(type);
      }
      if (project_name !== undefined) {
        updates.push('project_name = ?');
        params.push(project_name);
      }
      if (latitude !== undefined) {
        updates.push('latitude = ?');
        params.push(latitude);
      }
      if (longitude !== undefined) {
        updates.push('longitude = ?');
        params.push(longitude);
      }

      if (updates.length === 0) {
        return c.json({ error: 'No fields provided for update' }, 400);
      }

      params.push(uuid);
      await query(`UPDATE device SET ${updates.join(', ')} WHERE uuid = ? AND is_deleted = FALSE`, params);

      return c.json({ message: 'Device updated successfully' }, 200);
    } catch (err: unknown) {
      console.error('Failed to update device:', err);
      return c.json({ error: 'Failed to update device', details: dbMessage(err) }, 500);
    }
  });

  // 6. DELETE /:uuid - Soft delete: UPDATE device SET is_deleted = TRUE WHERE uuid = ?
  router.delete('/:uuid', requireAdmin, async (c) => {
    const uuid = c.req.param('uuid');

    try {
      const query = getQueryAdapter();
      const existing = await query<IdRow[]>(
        'SELECT id FROM device WHERE uuid = ? AND is_deleted = FALSE',
        [uuid]
      );
      if (!existing || existing.length === 0) {
        return c.json({ error: 'Device not found' }, 404);
      }

      await query('UPDATE device SET is_deleted = TRUE WHERE uuid = ?', [uuid]);
      return c.json({ message: 'Device soft deleted successfully' }, 200);
    } catch (err: unknown) {
      console.error('Failed to delete device:', err);
      return c.json({ error: 'Failed to delete device', details: dbMessage(err) }, 500);
    }
  });

  return router;
}
