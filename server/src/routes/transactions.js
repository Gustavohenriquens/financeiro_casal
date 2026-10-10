import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as svc from '../services/transactionService.js';

const router = Router();

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');
const optionalId = z.coerce.number().int().positive().nullable().optional();
const METHODS = ['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia'];

const body = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().trim().min(1, 'Informe a descrição.').max(120),
  amount_cents: z.number({ invalid_type_error: 'Informe o valor.' }).int().positive('O valor deve ser maior que zero.').max(100_000_000_00),
  due_date: date,
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  paid_date: date.nullable().optional(),
  category_id: optionalId,
  person_id: optionalId,
  scope: z.enum(['individual', 'shared']).default('shared'),
  payment_method: z.enum(METHODS).nullable().optional(),
  income_type: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

const query = z.object({
  type: z.enum(['income', 'expense']).optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  from: date.optional(),
  to: date.optional(),
  category_id: z.coerce.number().int().optional(),
  person: z.string().optional(),
  scope: z.enum(['individual', 'shared']).optional(),
  payment_method: z.enum(METHODS).optional(),
  q: z.string().trim().max(80).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParam = (req) => z.coerce.number().int().positive().parse(req.params.id);

router.get('/', validate(query, 'query'), async (req, res) => {
  res.json({ items: await svc.listTransactions(req.householdId, req.query) });
});

router.post('/', validate(body), async (req, res) => {
  res.status(201).json(await svc.createTransaction(req.householdId, req.user.id, req.body));
});

router.patch('/:id', validate(body.partial()), async (req, res) => {
  res.json(await svc.updateTransaction(req.householdId, idParam(req), req.body));
});

router.post('/:id/pay', validate(z.object({ paid_date: date.optional() })), async (req, res) => {
  res.json(await svc.setPaid(req.householdId, idParam(req), true, req.body.paid_date));
});

router.post('/:id/unpay', async (req, res) => {
  res.json(await svc.setPaid(req.householdId, idParam(req), false));
});

router.delete('/:id', async (req, res) => {
  await svc.deleteTransaction(req.householdId, idParam(req));
  res.status(204).end();
});

export default router;
