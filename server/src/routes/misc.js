import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { getDashboard } from '../services/dashboardService.js';
import { listNotifications, markRead } from '../services/notificationService.js';

const router = Router();

router.get('/dashboard', validate(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }), 'query'), async (req, res) => {
  res.json(await getDashboard(req.householdId, req.query.month));
});

router.get('/categories', async (req, res) => {
  res.json({
    items: await db.prepare('SELECT id, name, kind, color FROM categories WHERE household_id = ? ORDER BY kind, name').all(req.householdId),
  });
});

router.get('/notifications', async (req, res) => {
  res.json({ items: await listNotifications(req.householdId) });
});

router.post('/notifications/read', validate(z.object({ id: z.number().int().optional() })), async (req, res) => {
  await markRead(req.householdId, req.body.id);
  res.status(204).end();
});

export default router;
