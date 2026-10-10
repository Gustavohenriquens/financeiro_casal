const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (cents) => brl.format((cents || 0) / 100);

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
export const monthLabel = (ym) => `${monthName(ym)} de ${ym.slice(0, 4)}`;
export const monthShort = (ym) => monthName(ym).slice(0, 3);

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const PAYMENT_METHODS = [
  ['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['debito', 'Débito'],
  ['credito', 'Crédito'], ['boleto', 'Boleto'], ['transferencia', 'Transferência'],
];
export const INCOME_TYPES = ['Salário', 'Freelance', 'Extra', 'Investimento', 'Presente', 'Outros'];
