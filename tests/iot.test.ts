import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { iotRouter } from '../src/routes/iot';

// Mock DB
let mockReturnEmpty = false;

const mockDb = {
  insert: vi.fn(() => ({
    values: vi.fn().mockReturnValue({
      onDuplicateKeyUpdate: vi.fn().mockResolvedValue([{ insertId: 1 }]),
      then: function(resolve: any) { resolve([{ insertId: 1 }]); }
    })
  })),
  delete: vi.fn(() => ({
    where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockImplementation((condition: any) => {
        if (mockReturnEmpty) {
          return Promise.resolve([]);
        }
        return Promise.resolve([{ uuid: 'station-aqms-123', type: 'aqms', currentVersion: '1.0.0', projectName: 'test-proj' }]);
      })
    }))
  }))
};

describe('IoT Ingestion API', () => {
  let app: Hono;

  beforeEach(() => {
    mockReturnEmpty = false;
    app = new Hono();
    // Inject mock DB and Env into context
    app.use('*', async (c, next) => {
      c.set('db', mockDb as any);
      c.env = { IOT_DEVICE_SECRET: 'test-secret' };
      await next();
    });
    app.route('/api/iot', iotRouter);
    vi.clearAllMocks();
  });

  it('should accept valid AQMS telemetry data and insert into raw and data_aqms', async () => {
    const payload = {
      pm25: 45,
      hum: 60,
      temp: 32
    };

    const res = await app.request('/api/iot/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'valid-api-key'
      },
      body: JSON.stringify(payload)
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: 'Data ingested successfully' });

    // Ensure db.insert was called (once for raw, once for telemetry)
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('should reject invalid pm25 (e.g., > 1000) for hot path, but still save to raw path', async () => {
    const payload = {
      pm25: 1500, // Invalid PM2.5
      hum: 60,
      temp: 32
    };

    const res = await app.request('/api/iot/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'valid-api-key'
      },
      body: JSON.stringify(payload)
    });

    expect(res.status).toBe(200); // Still 200 because it's accepted by system
    
    // Ensure db.insert was called ONLY for raw sensor log (once)
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('should reject requests without API key', async () => {
    const res = await app.request('/api/iot/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pm25: 10 })
    });

    expect(res.status).toBe(401);
  });

  describe('Identity Endpoint', () => {
    it('should return UUID when valid MAC address is provided', async () => {
      const res = await app.request('/api/iot/identity', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-secret': 'test-secret'
        },
        body: JSON.stringify({ macAddress: '00:11:22:33:44:55' })
      });
      
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ uuid: 'station-aqms-123' });
    });

    it('should return 400 when MAC address is missing', async () => {
      const res = await app.request('/api/iot/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-secret': 'test-secret' },
        body: JSON.stringify({})
      });
      
      expect(res.status).toBe(400);
    });

    it('should log unregistered MAC address and return 404', async () => {
      mockReturnEmpty = true;
      const res = await app.request('/api/iot/identity', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-secret': 'test-secret'
        },
        body: JSON.stringify({ macAddress: 'unknown-mac' })
      });
      
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Device not registered. Please contact administrator.' });
      
      // Ensure it deleted old devices and inserted the new unregistered device
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
