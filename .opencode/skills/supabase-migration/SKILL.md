---
name: Supabase Migration
description: Create or review a new SQL migration in supabase/migrations for this project, including RLS policies, views, and column-level triggers. Use when adding or changing a table, policy, view, function, or trigger in the Supabase schema.
---

# Supabase Migration

Procedure for adding a migration safely in `cosmo-music-dashboard`.

## Before writing anything

1. Find the highest number in `supabase/migrations/`. The new file is `NNN_snake_case_description.sql`, NNN = highest + 1 (zero-padded to 3). Never reuse a number.
2. Read `supabase/BASELINE.md`. It records what each past migration did and why, including the failures. It will usually already contain a warning about the exact area you are touching.
3. Read the migration that last touched the objects you are about to change. Several fixes in this repo exist because a later migration silently invalidated an earlier one.

## Rules that are not negotiable

- **Make it idempotent.** Use `DROP ... IF EXISTS` before every `CREATE`, and `CREATE OR REPLACE` for functions. The repo relies on `supabase db reset` to rebuild from scratch, and CI runs it on every push. Migrations 018-036 are all idempotent by design; 001-017 are not and are the reason the history is messy.
- **Never change a function's return type with `CREATE OR REPLACE`.** PostgreSQL raises `42P13`. Use `DROP FUNCTION` then `CREATE`. This is what broke migration 017.
- **Views need `WITH (security_invoker = true)`.** A view runs with its owner's permissions, not the caller's. Without it, RLS on the underlying table is bypassed. `profiles_with_metrics` leaked every student's email, phone and birth date until 027 fixed it.
- **RLS restricts rows, not columns.** To stop a student from changing a column, you need a `BEFORE UPDATE` trigger with an explicit column denylist. A policy cannot do it.
- **Every function gets `SET search_path = public`.** Otherwise it is hijackable through `public` objects.
- **Always enable RLS** on a new table, plus a policy for every role that legitimately touches it. The anon key ships in the bundle, so an unguarded table is readable from the browser console with no UI at all.
- **Renaming a table does not rename its constraints or move its triggers.** `ALTER TABLE ... RENAME` renames the table; constraints keep their old names, and triggers follow the table by OID (so they move, but are not recreated). `trg_restrict_student_task_update` was lost this way when 021 renamed `tasks` and 026 dropped the old table. If you rename, fix the constraint names in the same migration and check the triggers survived.
- **Do not use `num_nonnulls` CHECKs across subqueries.** A CHECK cannot contain a subquery, so it cannot validate a value against a column in another table. Validate in a trigger instead.
- **Prefer `NOT VALID` for new CHECK constraints** on tables with existing rows, so the migration does not fail on legacy data. Validate later as a separate step.

## Procedure

1. Write the migration with a header comment in the same style as the existing ones: what it fixes, why, what it depends on, and whether it is idempotent. The repo's migrations explain the reasoning, not just the SQL; follow that.
2. If you add a table, add it to the RLS table list in `supabase/ci_verification.sql`. CI asserts that list, so a new table that is not listed will not be checked and CI will still pass.
3. If you change what a view or function returns, check whether `supabase/rls_tests.sql` still holds. That file asserts behaviour under a real JWT.
4. Apply and verify:

```sh
supabase db reset --local          # rebuild from scratch, all migrations in order
supabase db diff --linked          # empty output means migrations match the real DB
```

5. Check the final schema locally with the same script CI uses:

```sh
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/ci_verification.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/rls_tests.sql
```

6. If the migration was applied by hand instead of by the CLI, register it in the history or it will be re-applied later:

```sh
supabase migration repair --status applied NNN --linked
```

## Reviewing a migration someone else wrote

- Does it re-apply cleanly? Check for `CREATE` without a preceding `DROP`, and for `CREATE OR REPLACE FUNCTION` with a changed return type.
- Does it add a view without `security_invoker`?
- Does it add a table without RLS?
- Does it add a policy that is a tautology? A column reference without a table qualifier resolves to the nearest scope, so `WHERE cp.conversation_id = conversation_id` becomes `cp.conversation_id = cp.conversation_id`, which is always true. Migration 019 fixed two of these in `messages`.
- Does it leave a table behind that nothing reads? An unused table is still attack surface; drop it rather than guarding it.

## References

- `references/security-checklist.md` - the security review checklist with the reasoning for each item.
