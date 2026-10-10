import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as svc from '../services/debtService.js';

const router = Router();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');
const money = z.number({ invalid_type_error: 'Informe o valor.' }).int().positive('O valor deve ser maior que zero.').max(100_000_000_00);
const count = z.number({ invalid_type_error: 'Informe a quantidade.' }).int().min(1, 'Mínimo 1.').max(360, 'Máximo 360.');
const optId = z.coerce.number().int().positive().nullable().optional();
const id = (req) => z.coerce.number().int().positive().parse(req.params.id);

const debtBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome da dívida.').max(100),
  creditor: z.string().trim().max(100).nullable().optional(),
  original_cents: money,
  installments_count: count,
  installment_cents: money.optional(),
  interest_rate: z.number().min(0, 'Não pode ser negativo.').max(1000).optional(),
  first_due_date: date,
  paid_installments: z.number().int().min(0).default(0),
  person_id: optId,
  notes: z.string().trim().max(500).nullable().optional(),
});

const planBody = z.object({
  name: z.string().trim().min(1, 'Informe o que foi comprado.').max(100),
  total_cents: money,
  installments_count: count,
  first_due_date: date,
  paid_installments: z.number().int().min(0).default(0),
  category_id: optId,
  person_id: optId,
  payment_method: z.enum(['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia']).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

router.get('/debts', async (req, res) => res.json({ items: await svc.listDebts(req.householdId) }));
router.post('/debts', validate(debtBody), async (req, res) => res.status(201).json(await svc.createDebt(req.householdId, req.user.id, req.body)));
router.get('/debts/:id/parcels', async (req, res) => res.json({ items: await svc.debtParcels(req.householdId, id(req)) }));
router.patch('/debts/:id', validate(debtBody.pick({ name: true, creditor: true, person_id: true, notes: true }).partial()),
  async (req, res) => res.json(await svc.updateDebt(req.householdId, id(req), req.body)));
router.delete('/debts/:id', async (req, res) => { await svc.deleteDebt(req.householdId, id(req)); res.status(204).end(); });

router.get('/installments', async (req, res) => res.json({ items: await svc.listPlans(req.householdId) }));
router.post('/installments', validate(planBody), async (req, res) => res.status(201).json(await svc.createPlan(req.householdId, req.user.id, req.body)));
router.get('/installments/:id/parcels', async (req, res) => res.json({ items: await svc.planParcels(req.householdId, id(req)) }));
router.delete('/installments/:id', async (req, res) => { await svc.deletePlan(req.householdId, id(req)); res.status(204).end(); });

export default router;
