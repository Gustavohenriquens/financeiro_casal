import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@libsql/client';
import { config } from '../config.js';

const client = createClient({ url: config.databaseUrl, authToken: config.databaseToken });

// Dentro de transaction(), toda consulta usa automaticamente a transação ativa.
const scope = new AsyncLocalStorage();
const runner = () => scope.getStore() ?? client;

const toObjects = (rs) =>
  rs.rows.map((row) => Object.fromEntries(rs.columns.map((col, i) => [col, row[i]])));

async function exec(sql, args) {
  return runner().execute({ sql, args });
}

/**
 * API pequena e assíncrona (get / all / run) sobre o cliente libSQL (Turso).
 * Uso: await db.prepare('SELECT ... WHERE id = ?').get(id)
 */
export const db = {
  prepare: (sql) => ({
    get: async (...args) => toObjects(await exec(sql, args))[0],
    all: async (...args) => toObjects(await exec(sql, args)),
    run: async (...args) => {
      const rs = await exec(sql, args);
      return { changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
    },
  }),
  /** Executa vários comandos numa só viagem de rede (atômico). statements: [{ sql, args }] */
  batch: async (statements) => {
    if (!statements.length) return;
    const r = runner();
    if (r === client) await client.batch(statements, 'write');
    else await r.batch(statements);
  },
};

/** Executa fn numa transação; faz rollback se lançar erro. Aceita aninhamento (reaproveita a ativa). */
export async function transaction(fn) {
  if (scope.getStore()) return fn();
  const tx = await client.transaction('write');
  try {
    const result = await scope.run(tx, fn);
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
}

export const rawClient = client;
