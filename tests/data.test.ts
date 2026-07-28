import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { dataRouter } from '../src/routes/data';

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            { id: 1, stationUuid: 'station-123', pm25: 15.5, temperature: 28.5 }
          ])
        })),
        then: function(resolve: any) { resolve([{ uuid: 'station-123', type: 'aqms' }]); }
      }))
    }))
  }))
};

describe('Data API', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use('*', async (c, next) => {
      c.set('db', mockDb as any);
      await next();
    });

    app.route('/api/data', dataRouter);
    vi.clearAllMocks();
  });

  it('should get aqms data for a station', async () => {
    const res = await app.request('/api/data/aqms?stationUuid=123e4567-e89b-12d3-a456-426614174000', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pm25).toBe(15.5);
  });

  it('should get history data for a station dynamically', async () => {
    const res = await app.request('/api/data/123e4567-e89b-12d3-a456-426614174000/history', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('aqms');
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pm25).toBe(15.5);
  });
});
