import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { maintenanceTickets, maintenanceLog } from '../db/schema';

export const ticketRouter = new Hono<{ Variables: { db: any, jwtPayload: any } }>();

ticketRouter.get('/', async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  
  if (!payload || (payload.role !== 'admin' && payload.role !== 'engineer')) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const tickets = await db.select().from(maintenanceTickets);
  return c.json({ tickets }, 200);
});

import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const createTicketSchema = z.object({
  stationUuid: z.string().min(3).max(20),
  issueTitle: z.string().min(3).max(255),
  issueDescription: z.string().min(10)
});

ticketRouter.post('/', zValidator('json', createTicketSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  const payload = c.get('jwtPayload');
  
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const { stationUuid, issueTitle, issueDescription } = c.req.valid('json');

  await db.insert(maintenanceTickets).values({
    stationUuid,
    reportedByUserId: payload.id,
    issueTitle,
    issueDescription,
    status: 'open',
    createdAt: new Date()
  });

  return c.json({ message: 'Ticket created successfully' }, 201);
});

const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
  actionTaken: z.string().min(5).optional()
});

ticketRouter.put('/:id', zValidator('json', updateTicketSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
}), async (c) => {
  const db = c.get('db');
  const ticketId = parseInt(c.req.param('id'));
  const payload = c.get('jwtPayload');
  
  if (!payload || (payload.role !== 'admin' && payload.role !== 'engineer')) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // IDOR Protection: Check if engineer is assigned to this ticket (admin bypasses)
  if (payload.role === 'engineer') {
    const existingTicket = await db.select().from(maintenanceTickets).where(eq(maintenanceTickets.id, ticketId));
    if (existingTicket.length === 0) {
      return c.json({ error: 'Ticket not found' }, 404);
    }
    if (existingTicket[0].assignedToEngineerId !== payload.id) {
      return c.json({ error: 'Forbidden: You are not assigned to this ticket' }, 403);
    }
  }

  const engineerId = payload.id;
  const { status, actionTaken } = c.req.valid('json');
  
  if (status) {
    const updateData: any = { status };
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }
    await db.update(maintenanceTickets)
      .set(updateData)
      .where(eq(maintenanceTickets.id, ticketId));
  }

  if (actionTaken && engineerId) {
    await db.insert(maintenanceLog).values({
      ticketId,
      engineerId,
      actionTaken,
      createdAt: new Date()
    });
  }

  return c.json({ message: 'Ticket updated successfully' }, 200);
});
