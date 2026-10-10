import { HttpError } from '../utils/errors.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, fields: err.fields });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
}
