import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as rec from '../services/recurringService.js';
import * as goals from '../services/goalService.js';

const router = Router();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');
const cents = z.number({ invalid_type_error: 'Informe o valor.' }).int().positive('O valor deve ser maior que zero.').max(100_000_000_00);
const optId = z.coerce.number().int().positive().nullable().optional();
const id = (req) => z.coerce.number().int().positive().parse(req.params.id);

const ruleBody = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().trim().min(1, 'Informe a descrição.').max(120),
  amount_cents: cents,
  day_of_month: z.number().int().min(1, 'Dia entre 1 e 31.').max(31, 'Dia entre 1 e 31.').optional(),
  frequency: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
  start_date: date,
  end_date: date.nullable().optional(),
  category_id: optId,
  person_id: optId,
  scope: z.enum(['individual', 'shared']).default('shared'),
  payment_method: z.enum(['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia']).nullable().optional(),
  income_type: z.string().trim().max(40).nullable().optional(),
});

router.get('/recurring', async (req, res) => res.json({ items: await rec.listRules(req.householdId) }));
router.post('/recurring', validate(ruleBody), async (req, res) => res.status(201).json(await rec.createRule(req.householdId, req.body)));
router.patch('/recurring/:id', validate(ruleBody.partial().extend({ active: z.boolean().optional() })),
  async (req, res) => res.json(await rec.updateRule(req.householdId, id(req), req.body)));
router.delete('/recurring/:id', async (req, res) => { await rec.deleteRule(req.householdId, id(req)); res.status(204).end(); });

const goalBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome da meta.').max(80),
  target_cents: cents,
  current_cents: z.number().int().min(0).max(100_000_000_00).optional(),
  deadline: date.nullable().optional(),
});

router.get('/goals', async (req, res) => res.json({ items: await goals.listGoals(req.householdId) }));
router.post('/goals', validate(goalBody), async (req, res) => res.status(201).json(await goals.createGoal(req.householdId, req.user.id, req.body)));
router.patch('/goals/:id', validate(goalBody.omit({ current_cents: true }).partial()),
  async (req, res) => res.json(await goals.updateGoal(req.householdId, id(req), req.body)));
router.post('/goals/:id/contribute',
  validate(z.object({ amount_cents: z.number({ invalid_type_error: 'Informe o valor.' }).int().refine((v) => v !== 0, 'Informe o valor.').refine((v) => Math.abs(v) <= 100_000_000_00, 'Valor muito alto.') })),
  async (req, res) => res.json(await goals.contribute(req.householdId, req.user.id, id(req), req.body.amount_cents)));
router.delete('/goals/:id', async (req, res) => { await goals.deleteGoal(req.householdId, id(req)); res.status(204).end(); });

export default router;
