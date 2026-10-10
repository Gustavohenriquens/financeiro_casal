import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { defaultPeriod, monthlyOverview, REPORT_KINDS, runReport, toCSV } from '../services/reportService.js';

const router = Router();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');
const q = z.object({ from: date.optional(), to: date.optional() });

router.get('/reports/monthly', validate(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }), 'query'),
  async (req, res) => res.json(await monthlyOverview(req.householdId, req.query.month)));

const kindParam = (req) => z.enum(REPORT_KINDS).parse(req.params.kind);
const period = (query) => ({ ...defaultPeriod(), ...Object.fromEntries(Object.entries(query).filter(([, v]) => v)) });

router.get('/reports/:kind', validate(q, 'query'), async (req, res) => {
  res.json(await runReport(req.householdId, kindParam(req), period(req.query)));
});

router.get('/reports/:kind/export.csv', validate(q, 'query'), async (req, res) => {
  const kind = kindParam(req);
  const report = await runReport(req.householdId, kind, period(req.query));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${kind}.csv"`);
  res.send(toCSV(report));
});

export default router;
