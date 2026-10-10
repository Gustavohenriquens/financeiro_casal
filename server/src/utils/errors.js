export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
export const badRequest = (m, f) => new HttpError(400, m, f);
export const unauthorized = (m = 'Não autenticado.') => new HttpError(401, m);
export const notFound = (m = 'Registro não encontrado.') => new HttpError(404, m);
export const conflict = (m, f) => new HttpError(409, m, f);
