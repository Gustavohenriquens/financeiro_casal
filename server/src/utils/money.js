const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatBRL = (cents) => brl.format(cents / 100);

/** Divide um total em N parcelas inteiras; a diferença de centavos vai para a primeira. */
export function splitCents(total, n) {
  const base = Math.floor(total / n);
  const parts = Array(n).fill(base);
  parts[0] += total - base * n;
  return parts;
}
