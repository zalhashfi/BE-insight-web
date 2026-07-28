import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { iotRouter } from '../src/routes/iot';

// Mock DB
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ version: 'v1.1.0', binFileUrl: 'https://github.com/test/ota.bin' }])
        })),
        then: function(resolve: any) {
          // This simulates returning an array when `where()` is awaited directly (for station lookup)
          resolve([{ uuid: 'station-123', currentVersion: 'v0.9.0', projectName: 'biru-langit' }]);
        }
      })
    }))
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ insertId: 1 }])
    }))
  }))
};

describe('IoT OTA API', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use('*', async (c, next) => {
      c.set('db', mockDb as any);
      await next();
    });
    app.route('/api/iot', iotRouter);
    vi.clearAllMocks();
  });

  it('should return update available if newer version exists', async () => {
    const res = await app.request('/api/iot/ota?current_version=v1.0.0', {
      method: 'GET',
      headers: {
        'X-API-Key': 'valid-api-key'
      }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      update_available: true,
      latest_version: 'v1.1.0',
      github_url: 'https://github.com/test/ota.bin'
    });
    
    // It should update the station's recorded version if it sent v1.0.0
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should return no update if already on latest version', async () => {
    const res = await app.request('/api/iot/ota?current_version=v1.1.0', {
      method: 'GET',
      headers: {
        'X-API-Key': 'valid-api-key'
      }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      update_available: false,
      latest_version: 'v1.1.0'
    });
  });

  it('should reject without API key', async () => {
    const res = await app.request('/api/iot/ota', {
      method: 'GET'
    });

    expect(res.status).toBe(401);
  });
});
