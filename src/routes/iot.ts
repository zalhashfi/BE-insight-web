import { Router, Request, Response } from 'express';
import { query } from '../db/pool.js';

export const iotRouter = Router();

// 1. POST /identity
iotRouter.post('/identity', async (req: Request, res: Response) => {
  const deviceSecret = req.header('x-device-secret');
  const iotDeviceSecret = process.env.IOT_DEVICE_SECRET;

  if (!deviceSecret || deviceSecret !== iotDeviceSecret) {
    return res.status(401).json({ error: 'Unauthorized device' });
  }

  const { mac_address } = req.body;
  if (!mac_address) {
    return res.status(400).json({ error: 'mac_address is required' });
  }

  try {
    const devices = await query<any[]>(
      'SELECT uuid, type, project_name FROM device WHERE mac_address = ? AND is_deleted = FALSE',
      [mac_address]
    );

    if (devices && devices.length > 0) {
      return res.status(200).json({
        uuid: devices[0].uuid,
        type: devices[0].type,
        project_name: devices[0].project_name,
      });
    }

    // Upsert to unregistered_device
    await query(
      `INSERT INTO unregistered_device (mac_address, last_seen_at) VALUES (?, NOW()) 
       ON DUPLICATE KEY UPDATE last_seen_at = NOW()`,
      [mac_address]
    );

    return res.status(404).json({ error: 'Device not registered' });
  } catch (err: any) {
    console.error('Error in /identity:', err);
    return res.status(500).json({ error: 'Internal database error', details: err.message });
  }
});

// 2. POST /ingest
iotRouter.post('/ingest', async (req: Request, res: Response) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'API Key (x-api-key header) is required' });
  }

  try {
    const devices = await query<any[]>(
      'SELECT id, uuid, type, current_version FROM device WHERE uuid = ? AND is_deleted = FALSE',
      [apiKey]
    );

    if (!devices || devices.length === 0) {
      return res.status(401).json({ error: 'Invalid API Key' });
    }

    const currentDevice = devices[0];
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Cold Path: insert into raw_data_log
    await query(
      'INSERT INTO raw_data_log (device_id, payload, received_at) VALUES (?, ?, NOW())',
      [currentDevice.id, JSON.stringify(payload)]
    );

    // Update last_seen_at
    await query('UPDATE device SET last_seen_at = NOW() WHERE id = ?', [currentDevice.id]);

    const measuredAt = payload.created_at ? new Date(payload.created_at) : new Date();

    // Hot Path based on device type
    if (currentDevice.type === 'aqms') {
      await query(
        `INSERT INTO aqms_reading 
          (device_id, pm25, no2, co, temperature, humidity, ws, wd, measured_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          currentDevice.id,
          payload.pm25 ?? null,
          payload.no2 ?? null,
          payload.co ?? null,
          payload.temperature ?? payload.temp ?? null,
          payload.humidity ?? payload.hum ?? null,
          payload.ws ?? null,
          payload.wd ?? null,
          measuredAt
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
          measuredAt
        ]
      );
    }

    return res.status(200).json({ message: 'Data ingested successfully' });
  } catch (err: any) {
    console.error('Error in /ingest:', err);
    return res.status(500).json({ error: 'Database insert failed', details: err.message });
  }
});

// 3. GET /ota
iotRouter.get('/ota', async (req: Request, res: Response) => {
  const apiKey = req.header('x-api-key');
  const currentVersion = req.query.current_version as string | undefined;

  if (!apiKey) {
    return res.status(401).json({ error: 'API Key (x-api-key header) is required' });
  }

  try {
    const devices = await query<any[]>(
      'SELECT id, uuid, project_name, current_version FROM device WHERE uuid = ? AND is_deleted = FALSE',
      [apiKey]
    );

    if (!devices || devices.length === 0) {
      return res.status(401).json({ error: 'Invalid API Key' });
    }

    const currentDevice = devices[0];

    if (currentVersion && currentVersion !== currentDevice.current_version) {
      await query('UPDATE device SET current_version = ? WHERE id = ?', [currentVersion, currentDevice.id]);
    }

    const releases = await query<any[]>(
      'SELECT version, bin_file_url FROM firmware_release WHERE project_name = ? ORDER BY created_at DESC LIMIT 1',
      [currentDevice.project_name]
    );

    if (releases && releases.length > 0) {
      const latest = releases[0];
      if (latest.version !== currentVersion) {
        return res.status(200).json({
          update_available: true,
          latest_version: latest.version,
          bin_file_url: latest.bin_file_url
        });
      }
    }

    return res.status(200).json({
      update_available: false,
      latest_version: currentVersion || currentDevice.current_version || '1.0.0'
    });
  } catch (err: any) {
    console.error('Error in /ota:', err);
    return res.status(500).json({ error: 'Failed to check OTA update', details: err.message });
  }
});
