import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';

await migrate(); // idempotente: cria as tabelas se ainda não existirem

createApp().listen(config.port, () => {
  console.log(`API rodando em http://localhost:${config.port}`);
});
