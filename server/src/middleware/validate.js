import { badRequest } from '../utils/errors.js';

/** Valida req[source] com um schema zod e substitui pelo valor já tipado. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    throw badRequest('Verifique os campos informados.', fields);
  }
  Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
  next();
};
