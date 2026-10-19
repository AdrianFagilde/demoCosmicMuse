# Security review checklist

Each item below exists because it was a real defect in this repo, with the migration that fixed it. Use this when reviewing a migration, not as a generic list.

## Views

- [ ] Every view over an RLS-protected table declares `WITH (security_invoker = true)`.
      A view executes with the owner's permissions. `profiles_with_metrics` had `GRANT SELECT` to `authenticated`, and because it did not have `security_invoker`, the RLS policies of `profiles` were never applied. A student session read 12 rows instead of 3, including other students' `email`, `phone`, `birth_date`, `guardian_name` and `guardian_phone`. Fixed in 027.
- [ ] A view created with `security_invoker` must be dropped and recreated, not `CREATE OR REPLACE`d, because the attribute cannot be changed in place. That is why 027 uses `DROP` + `CREATE`.

## Tables

- [ ] RLS is enabled: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- [ ] Every role that legitimately reads or writes the table has a policy. Also check the policies are not merely permissive by accident.
- [ ] `GRANT ALL` to `authenticated` (Supabase's default) means RLS is the only brake. Assume any missing policy is a full read/write hole.
- [ ] A table with no UI is still exposed. PostgREST serves the whole `public` schema and the anon key is public inside the bundle. `supabase.from('messages').select()` from the browser console is enough to read everything that table holds, with no interface required. Migration 028 dropped `conversations`, `conversation_participants` and `messages` for this reason.

## Policies

- [ ] No unqualified column reference inside a subquery. In `WHERE cp.conversation_id = conversation_id`, the bare `conversation_id` resolves to `cp.conversation_id` (nearest scope wins), so the filter reduces to `cp.conversation_id = cp.conversation_id`, always true. That let any authenticated user read every conversation in the academy. Fixed in 019.
- [ ] A policy cannot compare against the previous row. `OLD` only exists inside a trigger function, so immutability checks must be `BEFORE UPDATE` triggers. Migration 017 used triggers for exactly this on notifications and profiles.
- [ ] Soft deletes need the filter in the policy. `get_conversation_messages` applied `deleted_at IS NULL` but the direct `SELECT` policy did not, so a raw PostgREST read returned rows the app considered deleted.

## Column-level protection

RLS decides which rows a statement may touch. It cannot decide which columns may change. For that you need a `BEFORE UPDATE` trigger with an explicit denylist.

- [ ] A denylist trigger exists wherever a non-admin should not rewrite a field, and it lists every protected column explicitly. `restrict_student_task_update` blocks `title`, `description`, `course_id`, `student_id`, `assigned_by`, `created_by`, `due_date`, `position`, `id`, `created_at`.
- [ ] `course_id` must be in that list even though `assignments_context_xor` already enforces exclusivity. A student with an individual task could otherwise move it into one of their own courses by setting `course_id` and `student_id` to NULL without violating the CHECK.
- [ ] The trigger must survive a table rename. `ALTER TABLE ... RENAME` moves triggers with the table (they are bound to the table OID), but if the old table is later dropped the trigger goes with it. `trg_restrict_student_task_update` was lost exactly this way between 021 and 026, and was restored in 036. After any rename, verify the guard still exists.
- [ ] The denylist must match the current column set. When migration 023 removed `progress`, `attendance` and `next_lesson` from `profiles`, the trigger from 017 still referenced them, so every student UPDATE on `profiles` failed with `record "new" has no field "progress"` (42703). Column removal requires a trigger audit.

## Roles and identity

- [ ] `role` is read from `profiles.role`, never from the JWT or `user_metadata`. The trigger `trg_protect_profiles_role` (007) blocks non-admins from changing it, and `handle_new_user` forces `role = 'student'` on signup.
- [ ] New functions that check privilege use `public.is_admin()` and set `SET search_path = public`.

## Functions

- [ ] No `CREATE OR REPLACE` that changes a return type. PostgreSQL raises `42P13` and the statement aborts. This is why 017 could not be re-applied, and why 016 had to `DROP` the function first. The same applies to changing argument types.
- [ ] `SET search_path = public` on every function.
- [ ] `SECURITY DEFINER` only where the function genuinely needs elevated rights, and the body is reviewed for what it does with them.

## Post-migration checks

- [ ] `supabase db reset --local` rebuilds cleanly from zero.
- [ ] `supabase db diff --linked` returns nothing.
- [ ] `supabase/ci_verification.sql` passes.
- [ ] `supabase/rls_tests.sql` passes.
- [ ] The new table is listed in the RLS table list in `supabase/ci_verification.sql`. CI asserts that list, so an unlisted table is never checked.
