import { Router, Request, Response } from 'express';
import { query } from '../db/pool.js';

export const firmwareRouter = Router();

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

// 1. GET / - List all from firmware_release order by created_at desc (array langsung)
firmwareRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const releases = await query<FirmwareRow[]>('SELECT * FROM firmware_release ORDER BY created_at DESC');
    return res.status(200).json(
      (releases || []).map((r) => ({
        id: r.id,
        version: r.version,
        url: r.bin_file_url,
        releaseNotes: r.changelog,
        createdAt: r.created_at,
      }))
    );
  } catch (err: unknown) {
    console.error('Failed to fetch firmware releases:', err);
    return res.status(500).json({ error: 'Failed to fetch firmware releases', details: firmwareMessage(err) });
  }
});

// 2. POST / - Create release (project_name, version, bin_file_url, changelog)
firmwareRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body: Record<string, string | null | undefined> = req.body ?? {};
    const project_name = body.project_name;
    const version = body.version;
    const bin_file_url = body.bin_file_url;
    const changelog = body.changelog ?? null;

    if (!project_name || !version || !bin_file_url) {
      return res.status(400).json({ error: 'Missing required fields: project_name, version, bin_file_url' });
    }

    await query(
      'INSERT INTO firmware_release (project_name, version, bin_file_url, changelog) VALUES (?, ?, ?, ?)',
      [project_name, version, bin_file_url, changelog]
    );

    return res.status(201).json({ message: 'Firmware release created successfully' });
  } catch (err: unknown) {
    if (firmwareCode(err) === 'ER_DUP_ENTRY' || firmwareMessage(err).includes('uk_project_version')) {
      return res.status(409).json({ error: 'Firmware version for this project already exists' });
    }
    console.error('Failed to create firmware release:', err);
    return res.status(500).json({ error: 'Failed to create firmware release', details: firmwareMessage(err) });
  }
});
