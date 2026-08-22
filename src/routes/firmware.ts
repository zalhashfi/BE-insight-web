import { Router, Request, Response } from 'express';
import { query } from '../db/pool.js';

export const firmwareRouter = Router();

// 1. GET / - List all from firmware_release order by created_at desc
firmwareRouter.get('/', async (req: Request, res: Response) => {
  try {
    const releases = await query('SELECT * FROM firmware_release ORDER BY created_at DESC');
    return res.status(200).json({ data: releases });
  } catch (err: any) {
    console.error('Failed to fetch firmware releases:', err);
    return res.status(500).json({ error: 'Failed to fetch firmware releases', details: err.message });
  }
});

// 3. GET /:projectName/latest - Get latest release for specific project
firmwareRouter.get('/:projectName/latest', async (req: Request, res: Response) => {
  const projectName = req.params.projectName;

  try {
    const releases = await query<any[]>(
      'SELECT * FROM firmware_release WHERE project_name = ? ORDER BY created_at DESC LIMIT 1',
      [projectName]
    );

    if (!releases || releases.length === 0) {
      return res.status(404).json({ error: 'No firmware release found for this project' });
    }

    return res.status(200).json({ data: releases[0] });
  } catch (err: any) {
    console.error('Failed to fetch latest firmware release:', err);
    return res.status(500).json({ error: 'Failed to fetch latest firmware release', details: err.message });
  }
});

// 2. POST / - Create release (project_name, version, bin_file_url, changelog)
firmwareRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { project_name, version, bin_file_url, changelog = null } = req.body;

    if (!project_name || !version || !bin_file_url) {
      return res.status(400).json({ error: 'Missing required fields: project_name, version, bin_file_url' });
    }

    await query(
      'INSERT INTO firmware_release (project_name, version, bin_file_url, changelog) VALUES (?, ?, ?, ?)',
      [project_name, version, bin_file_url, changelog]
    );

    return res.status(201).json({ message: 'Firmware release created successfully' });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('uk_project_version')) {
      return res.status(409).json({ error: 'Firmware version for this project already exists' });
    }
    console.error('Failed to create firmware release:', err);
    return res.status(500).json({ error: 'Failed to create firmware release', details: err.message });
  }
});
