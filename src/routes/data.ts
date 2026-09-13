import { Hono } from 'hono';
import { getQueryAdapter } from '../db/adapter.js';

export function createDataRouter() {
  const router = new Hono();

  // GET /devices/:uuid/data/:sensorType
  router.get('/devices/:uuid/data/:sensorType', async (c) => {
    const uuid = c.req.param('uuid');
    const sensorType = c.req.param('sensorType').toLowerCase();

    if (sensorType !== 'aqms' && sensorType !== 'soc') {
      return c.json({ error: 'Invalid sensorType. Must be "aqms" or "soc"' }, 400);
    }

    const startTime = c.req.query('start_time');
    const endTime = c.req.query('end_time');
    const limitStr = c.req.query('limit');

    let limit = 100;
    if (limitStr) {
      const parsedLimit = parseInt(limitStr, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 1000);
      }
    }

    try {
      const query = getQueryAdapter();
      const devices = await query<Array<{ id: number; uuid: string; type: string }>>(
        'SELECT id, uuid, type FROM device WHERE uuid = ? AND is_deleted = FALSE',
        [uuid]
      );

      if (!devices || devices.length === 0) {
        return c.json({ error: 'Device not found or deleted' }, 404);
      }

      const device = devices[0];
      const table = sensorType === 'aqms' ? 'aqms_reading' : 'soc_reading';

      let sql = `SELECT * FROM ${table} WHERE device_id = ?`;
      const params: Array<string | number | null> = [device.id];

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

      const rows = await query<Array<Record<string, unknown>>>(sql, params);

      return c.json(
        {
          device_uuid: uuid,
          sensor_type: sensorType,
          total_records: rows.length,
          data: rows,
        },
        200
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to query sensor data:', err);
      return c.json({ error: 'Failed to query sensor data', details: message }, 500);
    }
  });

  return router;
}
