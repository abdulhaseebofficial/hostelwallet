-- Udhaar: money a student borrowed, and money they lent.
--
-- WHY THE AMOUNTS ARE numeric AND NOT double precision
--
-- Every other table stores money as `double precision`, and for spending that
-- is fine: a total is rounded once at the edge and shown. Debt is different.
-- Payments have to add up to exactly the original amount, and "remaining is
-- zero" has to be exactly true before a record can be called settled. In
-- floating point 0.1 + 0.2 is not 0.3, so a student paying three instalments
-- could be left owing a fraction of a paisa forever, or be marked settled
-- while a fraction remains.
--
-- numeric(14,2) makes the arithmetic exact, and it is done in SQL rather than
-- JavaScript. The pool already parses NUMERIC back to a JavaScript number, so
-- nothing above the repository sees a different shape from the rest of the app.
--
-- WHY THERE IS NO overdue STATUS COLUMN
--
-- Overdue is not a thing that happens to a row, it is what today makes true of
-- one. Storing it would need something to run at midnight and flip it, which
-- this deployment cannot promise. It is derived on read instead, so it is
-- correct the moment it is asked for.
--
-- ROLLBACK (the runner is forward-only; run this by hand if it is ever needed)
--
--   DROP TABLE IF EXISTS debt_payments;
--   DROP TABLE IF EXISTS debts;
--   DELETE FROM schema_migrations WHERE name = '0002_debts.sql';

/* -------------------------------- debts ----------------------------- */

CREATE TABLE IF NOT EXISTS debts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- BORROWED: the student owes this person. LENT: this person owes the student.
  kind             text NOT NULL CHECK (kind IN ('BORROWED', 'LENT')),

  person_name      text NOT NULL CHECK (length(btrim(person_name)) BETWEEN 1 AND 80),
  -- Optional: a phone number, an Instagram handle, a room number.
  person_contact   text NOT NULL DEFAULT '' CHECK (length(person_contact) <= 120),

  original_amount  numeric(14,2) NOT NULL CHECK (original_amount > 0),
  -- Kept in step with debt_payments by the repository, inside one transaction.
  -- Never more than the original: a student cannot repay more than they owed.
  paid_amount      numeric(14,2) NOT NULL DEFAULT 0
                     CHECK (paid_amount >= 0 AND paid_amount <= original_amount),

  -- PENDING until something is paid, SETTLED once nothing remains. OVERDUE is
  -- derived from due_date on read, not stored.
  status           text NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'SETTLED')),

  transaction_date timestamptz NOT NULL DEFAULT now(),
  due_date         timestamptz,
  settled_at       timestamptz,

  -- Optional, and only ever one of the student's own categories - the same
  -- list expenses use. Free text rather than a foreign key because categories
  -- are a text list on the user, not a table.
  category         text,
  note             text NOT NULL DEFAULT '' CHECK (length(note) <= 500),

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- The dominant query is "one student's debts, newest first", usually narrowed
-- by kind or status.
CREATE INDEX IF NOT EXISTS debts_user_created_idx
  ON debts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS debts_user_kind_status_idx
  ON debts (user_id, kind, status);
CREATE INDEX IF NOT EXISTS debts_user_txn_date_idx
  ON debts (user_id, transaction_date DESC);
-- Drives the overdue and due-soon queries without scanning settled rows.
CREATE INDEX IF NOT EXISTS debts_user_due_idx
  ON debts (user_id, due_date)
  WHERE status <> 'SETTLED' AND due_date IS NOT NULL;
-- Person search is a case-insensitive prefix/substring match.
CREATE INDEX IF NOT EXISTS debts_user_person_idx
  ON debts (user_id, lower(person_name));

/* ---------------------------- debt payments ------------------------- */
-- The ledger. paid_amount on the debt is a running total of these, kept in the
-- same transaction, so a balance can always be re-derived from history rather
-- than trusted.

CREATE TABLE IF NOT EXISTS debt_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id      uuid NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  -- Denormalised from the debt so a payment can be authorised without a join,
  -- and so a stray row can never belong to a different student than its debt.
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  amount       numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_on      timestamptz NOT NULL DEFAULT now(),
  note         text NOT NULL DEFAULT '' CHECK (length(note) <= 200),

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS debt_payments_debt_idx
  ON debt_payments (debt_id, paid_on DESC);
CREATE INDEX IF NOT EXISTS debt_payments_user_idx
  ON debt_payments (user_id, paid_on DESC);
