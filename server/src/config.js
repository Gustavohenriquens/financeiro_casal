import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.env.NODE_ENV === 'production';

// Local: arquivo SQLite em server/data (sem conta nenhuma). Produção: Turso via DATABASE_URL + DATABASE_AUTH_TOKEN.
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (isProd) throw new Error('DATABASE_URL não definida (obrigatória em produção).');
  const dir = path.join(root, 'data');
  fs.mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, 'financias.db')}`;
}

// Segredo do JWT: sempre via variável de ambiente em produção (o disco da Vercel é efêmero).
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (isProd) throw new Error('JWT_SECRET não definida (obrigatória em produção).');
  const dir = path.join(root, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

let secret;
export const config = {
  port: Number(process.env.PORT) || 3001,
  isProd,
  get jwtSecret() { return (secret ??= loadSecret()); },
  databaseUrl: resolveDatabaseUrl(),
  databaseToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  clientDist: path.resolve(root, '..', 'client', 'dist'),
  timezone: 'America/Sao_Paulo',
};
