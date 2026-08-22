import { Router, Request, Response } from 'express';
import { query } from '../db/pool.js';

export const dataRouter = Router();

// GET /devices/:uuid/data/:sensorType
dataRouter.get('/devices/:uuid/data/:sensorType', async (req: Request, res: Response) => {
  const uuid = req.params.uuid;
  const sensorType = req.params.sensorType.toLowerCase();

  if (sensorType !== 'aqms' && sensorType !== 'soc') {
    return res.status(400).json({ error: 'Invalid sensorType. Must be "aqms" or "soc"' });
  }

  const startTime = req.query.start_time as string | undefined;
  const endTime = req.query.end_time as string | undefined;
  const limitStr = req.query.limit as string | undefined;

  let limit = 100;
  if (limitStr) {
    const parsedLimit = parseInt(limitStr, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, 1000);
    }
  }

  try {
    const devices = await query<any[]>(
      'SELECT id, uuid, type FROM device WHERE uuid = ? AND is_deleted = FALSE',
      [uuid]
    );

    if (!devices || devices.length === 0) {
      return res.status(404).json({ error: 'Device not found or deleted' });
    }

    const device = devices[0];
    const table = sensorType === 'aqms' ? 'aqms_reading' : 'soc_reading';

    let sql = `SELECT * FROM ${table} WHERE device_id = ?`;
    const params: any[] = [device.id];

    if (startTime) {
      sql += ` AND measured_at >= ?`;
      params.push(startTime);
    }
    if (endTime) {
      sql += ` AND measured_at <= ?`;
      params.push(endTime);
    }

    sql += ` ORDER BY measured_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await query<any[]>(sql, params);

    return res.status(200).json({
      device_uuid: uuid,
      sensor_type: sensorType,
      total_records: rows.length,
      data: rows
    });
  } catch (err: any) {
    console.error('Failed to query sensor data:', err);
    return res.status(500).json({ error: 'Failed to query sensor data', details: err.message });
  }
});
