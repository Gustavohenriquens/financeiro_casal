import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { unauthorized } from '../utils/errors.js';

const COOKIE = 'fc_token';
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function setSession(res, userId) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: WEEK,
  });
}
export const clearSession = (res) => res.clearCookie(COOKIE);

export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized('Sessão expirada. Entre novamente.');
  }
  const user = await db
    .prepare('SELECT id, household_id, name, email, avatar FROM users WHERE id = ?')
    .get(payload.sub);
  if (!user) throw unauthorized();
  req.user = user;
  req.householdId = user.household_id;
  next();
}
