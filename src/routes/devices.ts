import { Router, Request, Response } from 'express';
import { query } from '../db/pool.js';

export const devicesRouter = Router();

// 1. GET / - List all devices with is_deleted = FALSE (supports ?type= & ?project_name=)
devicesRouter.get('/', async (req: Request, res: Response) => {
  const type = req.query.type as string | undefined;
  const projectName = (req.query.project_name as string | undefined) || (req.query.projectName as string | undefined);

  let sql = 'SELECT uuid, mac_address, name, type, project_name, current_version, last_seen_at, created_at FROM device WHERE is_deleted = FALSE';
  const params: any[] = [];

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
    const devices = await query(sql, params);
    return res.status(200).json({ data: devices });
  } catch (err: any) {
    console.error('Failed to fetch devices:', err);
    return res.status(500).json({ error: 'Failed to fetch devices', details: err.message });
  }
});

// 3. GET /unregistered - List all from unregistered_device order by last_seen_at desc
devicesRouter.get('/unregistered', async (req: Request, res: Response) => {
  try {
    const unregistered = await query('SELECT * FROM unregistered_device ORDER BY last_seen_at DESC');
    return res.status(200).json({ data: unregistered });
  } catch (err: any) {
    console.error('Failed to fetch unregistered devices:', err);
    return res.status(500).json({ error: 'Failed to fetch unregistered devices', details: err.message });
  }
});

// 4. GET /:uuid - Detail device + count total logs/readings
devicesRouter.get('/:uuid', async (req: Request, res: Response) => {
  const uuid = req.params.uuid;

  try {
    const devices = await query<any[]>('SELECT * FROM device WHERE uuid = ? AND is_deleted = FALSE', [uuid]);
    if (!devices || devices.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = devices[0];
    const deviceId = device.id;

    const rawLogs = await query<any[]>('SELECT COUNT(*) as count FROM raw_data_log WHERE device_id = ?', [deviceId]);
    const totalLogs = Number(rawLogs?.[0]?.count || 0);

    let totalReadings = 0;
    if (device.type === 'aqms') {
      const aqmsLogs = await query<any[]>('SELECT COUNT(*) as count FROM aqms_reading WHERE device_id = ?', [deviceId]);
      totalReadings = Number(aqmsLogs?.[0]?.count || 0);
    } else if (device.type === 'soc') {
      const socLogs = await query<any[]>('SELECT COUNT(*) as count FROM soc_reading WHERE device_id = ?', [deviceId]);
      totalReadings = Number(socLogs?.[0]?.count || 0);
    }

    return res.status(200).json({
      data: {
        ...device,
        total_logs: totalLogs,
        total_readings: totalReadings
      }
    });
  } catch (err: any) {
    console.error('Failed to fetch device details:', err);
    return res.status(500).json({ error: 'Failed to fetch device details', details: err.message });
  }
});

// 2. POST / - Register new device (manual uuid, mac_address, name, type, project_name)
devicesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { uuid, mac_address, name, type, project_name } = req.body;

    if (!uuid || !mac_address || !name || !type || !project_name) {
      return res.status(400).json({ error: 'Missing required fields: uuid, mac_address, name, type, project_name' });
    }
    if (!['aqms', 'soc'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "aqms" or "soc"' });
    }

    const existing = await query<any[]>(
      'SELECT uuid, mac_address FROM device WHERE (uuid = ? OR mac_address = ?) AND is_deleted = FALSE',
      [uuid, mac_address]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Device with given uuid or mac_address already exists' });
    }

    await query(
      'INSERT INTO device (uuid, mac_address, name, type, project_name) VALUES (?, ?, ?, ?, ?)',
      [uuid, mac_address, name, type, project_name]
    );

    await query('DELETE FROM unregistered_device WHERE mac_address = ?', [mac_address]);

    return res.status(201).json({ message: 'Device registered successfully', uuid });
  } catch (err: any) {
    console.error('Failed to register device:', err);
    return res.status(500).json({ error: 'Failed to register device', details: err.message });
  }
});

// 5. PUT /:uuid - Update name, type, project_name
devicesRouter.put('/:uuid', async (req: Request, res: Response) => {
  const uuid = req.params.uuid;

  try {
    const { name, type, project_name } = req.body;

    const existing = await query<any[]>('SELECT id FROM device WHERE uuid = ? AND is_deleted = FALSE', [uuid]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) {
      if (!['aqms', 'soc'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
      updates.push('type = ?'); params.push(type);
    }
    if (project_name !== undefined) { updates.push('project_name = ?'); params.push(project_name); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    params.push(uuid);
    await query(`UPDATE device SET ${updates.join(', ')} WHERE uuid = ? AND is_deleted = FALSE`, params);

    return res.status(200).json({ message: 'Device updated successfully' });
  } catch (err: any) {
    console.error('Failed to update device:', err);
    return res.status(500).json({ error: 'Failed to update device', details: err.message });
  }
});

// 6. DELETE /:uuid - Soft delete: UPDATE device SET is_deleted = TRUE WHERE uuid = ?
devicesRouter.delete('/:uuid', async (req: Request, res: Response) => {
  const uuid = req.params.uuid;

  try {
    const existing = await query<any[]>('SELECT id FROM device WHERE uuid = ? AND is_deleted = FALSE', [uuid]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await query('UPDATE device SET is_deleted = TRUE WHERE uuid = ?', [uuid]);
    return res.status(200).json({ message: 'Device soft deleted successfully' });
  } catch (err: any) {
    console.error('Failed to delete device:', err);
    return res.status(500).json({ error: 'Failed to delete device', details: err.message });
  }
});
