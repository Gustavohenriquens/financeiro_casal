// Todos os valores monetários são INTEGER em centavos. Datas são 'YYYY-MM-DD'.
export const schema = `
CREATE TABLE IF NOT EXISTS households (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  low_balance_cents INTEGER NOT NULL DEFAULT 20000,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
  color TEXT NOT NULL DEFAULT '#6366f1',
  UNIQUE (household_id, kind, name)
);

CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  creditor TEXT,
  original_cents INTEGER NOT NULL CHECK (original_cents > 0),
  installments_count INTEGER NOT NULL DEFAULT 1 CHECK (installments_count > 0),
  installment_cents INTEGER NOT NULL CHECK (installment_cents > 0),
  interest_rate_bp INTEGER NOT NULL DEFAULT 0,
  first_due_date TEXT NOT NULL,
  person_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','settled','cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS installment_plans (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  installments_count INTEGER NOT NULL CHECK (installments_count > 0),
  first_due_date TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  person_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','yearly')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  person_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scope TEXT NOT NULL DEFAULT 'shared' CHECK (scope IN ('individual','shared')),
  payment_method TEXT,
  income_type TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  generated_until TEXT
);

-- Livro-caixa único: receitas, despesas, contas a pagar, parcelas de dívidas e de compras.
-- person_id NULL = "ambos". "Vencido" é derivado: status pending e due_date < hoje.
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  description TEXT NOT NULL,
  notes TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  due_date TEXT NOT NULL,
  paid_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  person_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scope TEXT NOT NULL DEFAULT 'shared' CHECK (scope IN ('individual','shared')),
  payment_method TEXT,
  income_type TEXT,
  debt_id INTEGER REFERENCES debts(id) ON DELETE CASCADE,
  installment_plan_id INTEGER REFERENCES installment_plans(id) ON DELETE CASCADE,
  installment_number INTEGER,
  recurring_id INTEGER REFERENCES recurring_rules(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_household_status_due ON transactions (household_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tx_household_paid ON transactions (household_id, paid_date);
CREATE INDEX IF NOT EXISTS idx_tx_debt ON transactions (debt_id);
CREATE INDEX IF NOT EXISTS idx_tx_plan ON transactions (installment_plan_id);

CREATE TABLE IF NOT EXISTS financial_goals (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  current_cents INTEGER NOT NULL DEFAULT 0 CHECK (current_cents >= 0),
  deadline TEXT,
  created_at TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','danger','success')),
  message TEXT NOT NULL,
  ref_type TEXT,
  ref_id INTEGER,
  dedupe_key TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (household_id, dedupe_key)
);
`;
