import { config } from '../config.js';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone });

export const toISO = (date) => fmt.format(date);
export const todayISO = () => toISO(new Date());
export const currentMonth = () => todayISO().slice(0, 7);

export function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Soma `n` meses mantendo o dia (ajusta para o último dia do mês quando necessário). */
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(d, last));
  return toISO(target);
}

export const shiftMonth = (ym, n) => addMonths(`${ym}-01`, n).slice(0, 7);

export function monthRange(ym) {
  const from = `${ym}-01`;
  return { from, to: addDays(addMonths(from, 1), -1) };
}
