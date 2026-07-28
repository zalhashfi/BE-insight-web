import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../src/index';

describe('Logs API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should accept log payload and output it to console.info when level is info', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const payload = {
      level: 'info',
      message: 'User login successful',
      data: { userId: 123 },
    };

    const res = await app.request('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[FRONTEND_LOG - info]',
      'User login successful',
      { userId: 123 }
    );
  });

  it('should output to console.error when level is error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const payload = {
      level: 'error',
      message: 'Failed to fetch data',
      data: { endpoint: '/api/data' },
    };

    const res = await app.request('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FRONTEND_LOG - error]',
      'Failed to fetch data',
      { endpoint: '/api/data' }
    );
  });

  it('should handle missing data field gracefully', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const payload = {
      level: 'warn',
      message: 'Some warning message',
    };

    const res = await app.request('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[FRONTEND_LOG - warn]',
      'Some warning message',
      undefined
    );
  });
  
  it('should return 400 for invalid payload', async () => {
    const res = await app.request('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrongField: 'test' }),
    });

    expect(res.status).toBe(400);
  });
});
