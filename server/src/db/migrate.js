// Cria/atualiza as tabelas (idempotente). Uso: npm run migrate -w server
// Roda no build da Vercel (com DATABASE_URL/DATABASE_AUTH_TOKEN) e automaticamente no desenvolvimento local.
import { pathToFileURL } from 'node:url';
import { rawClient } from './index.js';
import { schema } from './schema.js';

export async function migrate() {
  await rawClient.executeMultiple(schema);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await migrate();
  console.log('Banco de dados pronto.');
  process.exit(0);
}
