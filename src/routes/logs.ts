import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const logsRouter = new Hono();

const logSchema = z.object({
  level: z.enum(['info', 'warn', 'error', 'debug']),
  message: z.string().min(1),
  data: z.any().optional()
});

logsRouter.post('/', zValidator('json', logSchema, (result, c) => {
  if (!result.success) {
    return c.json({ success: false, error: 'Validation failed' }, 400);
  }
}), async (c) => {
  try {
    const { level, message, data } = c.req.valid('json');

    const prefix = `[FRONTEND_LOG - ${level}]`;

    switch (level) {
      case 'info':
        console.info(prefix, message, data);
        break;
      case 'error':
        console.error(prefix, message, data);
        break;
      case 'warn':
        console.warn(prefix, message, data);
        break;
      default:
        console.log(prefix, message, data);
        break;
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Invalid payload' }, 400);
  }
});
