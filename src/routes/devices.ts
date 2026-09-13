import { Router, Request, Response } from 'express';
import { query } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';

export const devicesRouter = Router();

interface DeviceRow {
  id: number;
  uuid: string;
  mac_address: string | null;
  name: string;
  type: string;
  project_name: string;
  current_version: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  last_seen_at: string | null;
  created_at: string | null;
}

interface UnregisteredRow {
  mac_address: string;
  last_seen_at: string | null;
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

// 1. GET / - List all devices with is_deleted = FALSE (supports ?type= & ?project_name=)
devicesRouter.get('/', async (req: Request, res: Response) => {
  const type = req.query.type as string | undefined;
  const projectName = (req.query.project_name as string | undefined) || (req.query.projectName as string | undefined);

  let sql = 'SELECT uuid, mac_address, name, type, project_name, current_version, latitude, longitude, last_seen_at, created_at FROM device WHERE is_deleted = FALSE';
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
    const devices = await query<DeviceRow[]>(sql, params);
    return res.status(200).json({ devices: (devices || []).map(toDevice) });
  } catch (err: unknown) {
    console.error('Failed to fetch devices:', err);
    return res.status(500).json({ error: 'Failed to fetch devices', details: dbMessage(err) });
  }
});

// 3. GET /unregistered - List all from unregistered_device order by last_seen_at desc
devicesRouter.get('/unregistered', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const unregistered = await query<UnregisteredRow[]>('SELECT mac_address, last_seen_at FROM unregistered_device ORDER BY last_seen_at DESC');
    return res.status(200).json({
      data: (unregistered || []).map((r) => ({
        macAddress: r.mac_address,
        lastSeenAt: r.last_seen_at,
      })),
    });
  } catch (err: unknown) {
    console.error('Failed to fetch unregistered devices:', err);
    return res.status(500).json({ error: 'Failed to fetch unregistered devices', details: dbMessage(err) });
  }
});

// 4. GET /:uuid - Detail device + count total logs/readings
devicesRouter.get('/:uuid', async (req: Request, res: Response) => {
  const uuid = req.params.uuid;

  try {
    const devices = await query<DeviceRow[]>('SELECT * FROM device WHERE uuid = ? AND is_deleted = FALSE', [uuid]);
    if (!devices || devices.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    const device = devices[0];

    const rawLogs = await query<CountRow[]>('SELECT COUNT(*) as count FROM raw_data_log WHERE device_id = ?', [device.id]);
    const totalLogs = Number(rawLogs?.[0]?.count || 0);

    let totalReadings = 0;
    if (device.type === 'aqms') {
      const aqmsLogs = await query<CountRow[]>('SELECT COUNT(*) as count FROM aqms_reading WHERE device_id = ?', [device.id]);
      totalReadings = Number(aqmsLogs?.[0]?.count || 0);
    } else if (device.type === 'soc') {
      const socLogs = await query<CountRow[]>('SELECT COUNT(*) as count FROM soc_reading WHERE device_id = ?', [device.id]);
      totalReadings = Number(socLogs?.[0]?.count || 0);
    }

    return res.status(200).json({
      data: {
        ...toDevice(device),
        totalLogs,
        totalReadings,
      },
    });
  } catch (err: unknown) {
    console.error('Failed to fetch device details:', err);
    return res.status(500).json({ error: 'Failed to fetch device details', details: dbMessage(err) });
  }
});

// 2. POST / - Register new device (manual uuid, name, type, project_name; mac_address + location optional)
devicesRouter.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const body: Record<string, string | number | null | undefined> = req.body ?? {};
    const uuid = body.uuid as string | undefined;
    const name = body.name as string | undefined;
    const type = body.type as string | undefined;
    const project_name = (body.project_name ?? body.projectName) as string | undefined;
    const mac_address = (body.mac_address ?? body.macAddress ?? null) as string | null;
    const latitude = (body.latitude ?? null) as string | number | null;
    const longitude = (body.longitude ?? null) as string | number | null;

    if (!uuid || !name || !type || !project_name) {
      return res.status(400).json({ error: 'Missing required fields: uuid, name, type, project_name' });
    }
    if (!['aqms', 'soc'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "aqms" or "soc"' });
    }

    if (mac_address) {
      const existing = await query<Pick<DeviceRow, 'uuid' | 'mac_address'>[]>(
        'SELECT uuid, mac_address FROM device WHERE (uuid = ? OR mac_address = ?) AND is_deleted = FALSE',
        [uuid, mac_address]
      );

      if (existing && existing.length > 0) {
        return res.status(409).json({ error: 'Device with given uuid or mac_address already exists' });
      }
    } else {
      const existing = await query<Pick<DeviceRow, 'uuid'>[]>(
        'SELECT uuid FROM device WHERE uuid = ? AND is_deleted = FALSE',
        [uuid]
      );

      if (existing && existing.length > 0) {
        return res.status(409).json({ error: 'Device with given uuid already exists' });
      }
    }

    await query(
      'INSERT INTO device (uuid, mac_address, name, type, project_name, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuid, mac_address, name, type, project_name, latitude, longitude]
    );

    if (mac_address) {
      await query('DELETE FROM unregistered_device WHERE mac_address = ?', [mac_address]);
    }

    return res.status(201).json({ message: 'Device registered successfully', uuid });
  } catch (err: unknown) {
    console.error('Failed to register device:', err);
    return res.status(500).json({ error: 'Failed to register device', details: dbMessage(err) });
  }
});

// 5. PUT /:uuid - Update name, type, project_name, latitude, longitude
devicesRouter.put('/:uuid', requireAdmin, async (req: Request, res: Response) => {
  const uuid = req.params.uuid;

  try {
    const body: Record<string, string | number | null | undefined> = req.body ?? {};
    const name = body.name as string | undefined;
    const type = body.type as string | undefined;
    const project_name = (body.project_name ?? body.projectName) as string | undefined;
    const latitude = body.latitude as string | number | null | undefined;
    const longitude = body.longitude as string | number | null | undefined;

    const existing = await query<IdRow[]>('SELECT id FROM device WHERE uuid = ? AND is_deleted = FALSE', [uuid]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const updates: string[] = [];
    const params: Array<string | number | null> = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) {
      if (!['aqms', 'soc'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
      updates.push('type = ?'); params.push(type);
    }
    if (project_name !== undefined) { updates.push('project_name = ?'); params.push(project_name); }
    if (latitude !== undefined) { updates.push('latitude = ?'); params.push(latitude); }
    if (longitude !== undefined) { updates.push('longitude = ?'); params.push(longitude); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    params.push(uuid);
    await query(`UPDATE device SET ${updates.join(', ')} WHERE uuid = ? AND is_deleted = FALSE`, params);

    return res.status(200).json({ message: 'Device updated successfully' });
  } catch (err: unknown) {
    console.error('Failed to update device:', err);
    return res.status(500).json({ error: 'Failed to update device', details: dbMessage(err) });
  }
});

// 6. DELETE /:uuid - Soft delete: UPDATE device SET is_deleted = TRUE WHERE uuid = ?
devicesRouter.delete('/:uuid', requireAdmin, async (req: Request, res: Response) => {
  const uuid = req.params.uuid;

  try {
    const existing = await query<IdRow[]>('SELECT id FROM device WHERE uuid = ? AND is_deleted = FALSE', [uuid]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await query('UPDATE device SET is_deleted = TRUE WHERE uuid = ?', [uuid]);
    return res.status(200).json({ message: 'Device soft deleted successfully' });
  } catch (err: unknown) {
    console.error('Failed to delete device:', err);
    return res.status(500).json({ error: 'Failed to delete device', details: dbMessage(err) });
  }
});
