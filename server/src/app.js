import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import miscRoutes from './routes/misc.js';
import parcelRoutes from './routes/parcels.js';
import planningRoutes from './routes/planning.js';
import reportRoutes from './routes/reports.js';
import { generateRecurring } from './services/recurringService.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // atrás do proxy da Vercel
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);

  // Tudo abaixo exige login (autenticado uma única vez por requisição).
  app.use('/api', requireAuth);
  // Garante que as recorrências do casal estejam geradas antes de leituras que dependem dos lançamentos.
  const NEEDS_RECURRING = /^\/(dashboard|transactions|recurring|reports|notifications)/;
  app.use('/api', async (req, _res, next) => {
    if (req.method === 'GET' && NEEDS_RECURRING.test(req.path)) await generateRecurring(req.householdId);
    next();
  });
  app.use('/api/transactions', transactionRoutes);
  app.use('/api', planningRoutes, reportRoutes, parcelRoutes, miscRoutes);
  app.use('/api', notFoundHandler);

  // Em produção o Express serve o build do front-end (SPA).
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
