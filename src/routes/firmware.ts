import { Hono } from 'hono';
import { getQueryAdapter } from '../db/adapter.js';

interface FirmwareRow {
  id: number;
  version: string;
  bin_file_url: string;
  changelog: string | null;
  created_at: string | null;
}

function firmwareMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function firmwareCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  const code = err.code;
  return typeof code === 'string' ? code : undefined;
}

export function createFirmwareRouter() {
  const router = new Hono();

  // 1. GET / - List all from firmware_release order by created_at desc (array langsung)
  router.get('/', async (c) => {
    try {
      const query = getQueryAdapter();
      const releases = await query<FirmwareRow[]>(
        'SELECT * FROM firmware_release ORDER BY created_at DESC'
      );
      return c.json(
        (releases || []).map((r) => ({
          id: r.id,
          version: r.version,
          url: r.bin_file_url,
          releaseNotes: r.changelog,
          createdAt: r.created_at,
        })),
        200
      );
    } catch (err: unknown) {
      console.error('Failed to fetch firmware releases:', err);
      return c.json({ error: 'Failed to fetch firmware releases', details: firmwareMessage(err) }, 500);
    }
  });

  // 2. POST / - Create release (project_name, version, bin_file_url, changelog)
  router.post('/', async (c) => {
    try {
      const query = getQueryAdapter();
      const body: Record<string, string | null | undefined> = await c.req.json().catch(() => ({}));
      const project_name = body.project_name;
      const version = body.version;
      const bin_file_url = body.bin_file_url;
      const changelog = body.changelog ?? null;

      if (!project_name || !version || !bin_file_url) {
        return c.json({ error: 'Missing required fields: project_name, version, bin_file_url' }, 400);
      }

      await query(
        'INSERT INTO firmware_release (project_name, version, bin_file_url, changelog) VALUES (?, ?, ?, ?)',
        [project_name, version, bin_file_url, changelog]
      );

      return c.json({ message: 'Firmware release created successfully' }, 201);
    } catch (err: unknown) {
      if (firmwareCode(err) === 'ER_DUP_ENTRY' || firmwareMessage(err).includes('uk_project_version')) {
        return c.json({ error: 'Firmware version for this project already exists' }, 409);
      }
      console.error('Failed to create firmware release:', err);
      return c.json({ error: 'Failed to create firmware release', details: firmwareMessage(err) }, 500);
    }
  });

  return router;
}
