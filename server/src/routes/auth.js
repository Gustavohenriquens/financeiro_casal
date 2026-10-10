import { Router } from 'express';
import { z } from 'zod';
import { clearSession, requireAuth, setSession } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as auth from '../services/authService.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(60),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(100),
  inviteCode: z.string().trim().max(20).optional().or(z.literal('')),
  householdName: z.string().trim().max(60).optional(),
});
const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

router.post('/register', validate(registerSchema), async (req, res) => {
  const user = await auth.register({ ...req.body, inviteCode: req.body.inviteCode || undefined });
  setSession(res, user.id);
  res.status(201).json({ user: auth.publicUser(user) });
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const user = await auth.login(req.body);
  setSession(res, user.id);
  res.json({ user: auth.publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: auth.publicUser(req.user), household: await auth.getHousehold(req.householdId) });
});

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(60),
  avatar: z.string().max(60_000, 'Imagem muito grande.')
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Imagem inválida.').nullable().optional(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres.').max(100),
});
const householdSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(60),
  low_balance_cents: z.number({ invalid_type_error: 'Informe o valor.' }).int().min(0).max(100_000_000_00),
});

router.patch('/me', requireAuth, validate(profileSchema), async (req, res) => {
  res.json({ user: await auth.updateProfile(req.user.id, req.body) });
});
router.post('/password', requireAuth, validate(passwordSchema), async (req, res) => {
  await auth.changePassword(req.user.id, req.body);
  res.status(204).end();
});
router.patch('/household', requireAuth, validate(householdSchema), async (req, res) => {
  res.json({ household: await auth.updateHousehold(req.householdId, req.body) });
});

export default router;
