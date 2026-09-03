-- Makes two rules about udhaar impossible to break, rather than merely unbroken.
--
-- Both already hold. Every write path in debts.repository.js maintains them,
-- and the e2e suite proves the application keeps them. What is missing is the
-- database saying so: today the rules live only in the code, so a bug in a
-- future code path - or anything that reaches this database other than the API
-- - could write a row that is quietly wrong, and nothing would object.
--
-- 1. A payment and its debt must belong to the same student.
--    debt_payments.user_id is denormalised from debts.user_id so a payment can
--    be authorised without a join. Nothing enforced that the two agree. A row
--    with user A's debt_id and user B's user_id would be visible to B through
--    `WHERE debt_id = $1 AND user_id = $2`. The API cannot currently produce
--    such a row - every path checks the debt's owner first, under FOR UPDATE -
--    so this is defence in depth, not a live hole. A composite foreign key
--    makes the disagreement unrepresentable.
--
--    (goal_contributions needs no equivalent: it carries no user_id at all, so
--    there is no second copy of the owner to drift. Ownership there is reached
--    only through its goal, which is always user-scoped.)
--
-- 2. status must agree with the balance, and settled_at with status.
--    status is derived from paid_amount on every write. A row could still be
--    stored claiming SETTLED with money outstanding, which is exactly the
--    "silently invalid balance" a ledger must not permit.
--
-- Additive only: no column is dropped, renamed or rewritten, and no existing
-- row is modified. If any row did violate these rules the migration would fail
-- and roll back, leaving the database untouched - which is the intended
-- outcome, because such a row is a bug that must be looked at, not migrated
-- past.
--
-- The existence checks below are qualified by conrelid, not by constraint name
-- alone. Constraint names are unique per table, not per database, so a bare
-- name lookup finds the copy in public and skips creating it when the
-- migrations are replayed into another schema - which is exactly what
-- tests/migrations/fresh-schema.test.js does. `'debts'::regclass` resolves
-- through search_path, so each schema is judged on its own.
--
-- Rollback (the runner is forward-only; run by hand if ever needed):
--   ALTER TABLE debt_payments DROP CONSTRAINT debt_payments_debt_owner_fkey;
--   ALTER TABLE debts DROP CONSTRAINT debts_id_user_key;
--   ALTER TABLE debts DROP CONSTRAINT debts_status_matches_balance;
--   ALTER TABLE debts DROP CONSTRAINT debts_settled_at_matches_status;

/* ------------- 1. a payment cannot cross to another student ---------- */

-- The composite foreign key below needs a unique key on exactly these two
-- columns. id is already the primary key, so this adds no new restriction on
-- the data; it exists to give the reference something to point at.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'debts_id_user_key' AND conrelid = 'debts'::regclass
  ) THEN
    ALTER TABLE debts ADD CONSTRAINT debts_id_user_key UNIQUE (id, user_id);
  END IF;
END $$;

-- ON DELETE CASCADE keeps the existing behaviour: deleting a debt deletes its
-- ledger.
--
-- ON UPDATE RESTRICT is deliberate, and the opposite of the reflex choice.
-- CASCADE would let a debt change owner and helpfully drag its payments along,
-- consistently - but a debt changing owner is never legitimate here. No code
-- path writes debts.user_id, and no update patch contains it. RESTRICT costs
-- nothing real and turns "transfer this record to another student" into an
-- error at the last layer that could still say no.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'debt_payments_debt_owner_fkey' AND conrelid = 'debt_payments'::regclass
  ) THEN
    ALTER TABLE debt_payments
      ADD CONSTRAINT debt_payments_debt_owner_fkey
      FOREIGN KEY (debt_id, user_id) REFERENCES debts (id, user_id)
      ON UPDATE RESTRICT ON DELETE CASCADE;
  END IF;
END $$;

-- Supports the composite key, and the (debt_id, user_id) lookups the payment
-- routes already make.
CREATE INDEX IF NOT EXISTS debt_payments_debt_user_idx
  ON debt_payments (debt_id, user_id);

/* --------------- 2. status must agree with the balance --------------- */

-- paid_amount is already constrained to 0 <= paid_amount <= original_amount,
-- so "settled" can only mean the two are equal.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'debts_status_matches_balance' AND conrelid = 'debts'::regclass
  ) THEN
    ALTER TABLE debts ADD CONSTRAINT debts_status_matches_balance CHECK (
      (status = 'PENDING'        AND paid_amount = 0) OR
      (status = 'PARTIALLY_PAID' AND paid_amount > 0 AND paid_amount < original_amount) OR
      (status = 'SETTLED'        AND paid_amount = original_amount)
    );
  END IF;
END $$;

-- A settlement date on an unsettled debt, or a settled debt with no date, is
-- a record that cannot be explained to the student it belongs to.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'debts_settled_at_matches_status' AND conrelid = 'debts'::regclass
  ) THEN
    ALTER TABLE debts ADD CONSTRAINT debts_settled_at_matches_status
      CHECK ((status = 'SETTLED') = (settled_at IS NOT NULL));
  END IF;
END $$;
