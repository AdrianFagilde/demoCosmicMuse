# AGENTS.md — Academia Cosmo Music Dashboard

> Compact instructions for future OpenCode sessions. Only signals that would otherwise be missed.

---

## Commands

| Command                 | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `npm install`           | Install dependencies                              |
| `npm start`             | Dev server at http://localhost:3000               |
| `npm run build`         | Production bundle in `build/` (Vite `outDir`)     |
| `npm run serve`         | Preview the production build                      |
| `npm run lint`          | ESLint                                            |
| `npm run typecheck`     | `tsc --noEmit`                                    |
| `npm run format`        | Apply Prettier (`prettier --write .`)             |
| `npm run test`          | Vitest run                                        |
| `npm run test:watch`    | Vitest in watch mode                              |
| `npm run test:coverage` | Vitest with v8 coverage                           |
| `npm run verify`        | lint + build + bundle env assertion (see quirk 1) |

**Before committing, run the CI set**: `npm run lint && npm run typecheck && npm run test && npm run build`.
CI (GitHub Actions, `.github/workflows/npm.yml`) runs exactly that on Node 20/22 across Linux + Windows, then a second job boots local Supabase (`supabase db reset --local`) and runs `supabase/ci_verification.sql` + `supabase/rls_tests.sql`. A migration that only fails at runtime will pass the first job and fail the second.

**Env**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are required. `VITE_BUILD_VERSION` is optional (defaults to git short HEAD, else a timestamp). Never set `VITE_VAPID_PUBLIC_KEY`: Web Push was removed in migration 031.

---

## Architecture

- React 19 + Vite 8 + CoreUI React 5 + Bootstrap 5, Supabase (Auth, Postgres with RLS, Storage).
- RLS policies are the only real authorization. The UI merely hides controls by role.
- Roles are `admin` / `student` stored in `profiles.role` — NOT in the JWT or `user_metadata`.
- First admin: create the user in Supabase Auth, then set `role = 'admin'` manually in `profiles`.
- The anon key ships inside the bundle, so the entire `public` schema is reachable from the browser console. Anything left in the schema without RLS is exposed, interface or not.

Key paths:

- `src/routes.js` — lazy routes; each entry may carry `roles: ['admin']` to gate it.
- `src/navigation.jsx` — sidebar entries, filtered by role.
- `src/context/AuthContext.jsx` — session + profile source of truth.
- `src/hooks/useSupabase*.js` — one hook per domain; `useSupabaseQuery.js` is the generic wrapper (`{data, loading, error, refetch}`); callers must wrap `queryFn` in `useCallback`.
- `src/utils/dates.js` — mandatory date helpers (see quirk 2).
- `src/lib/supabase.js` — creates the client; throws at module load if env vars are missing.
- `supabase/migrations/` — numbered SQL, apply strictly in order.
- `supabase/functions/` — `create-student`, `delete-user` (use the service role key).
- `supabase/BASELINE.md` — schema state, migration history, and the reasoning behind the tricky ones.
- `public/sw.js` — offline shell + bundle update; never cache `*.supabase.co`.
- `scripts/assert-bundle-env.mjs` — post-build check used by `npm run verify`.
- `vercel.json` — SPA rewrites, cache-control, and security headers.

---

## Critical quirks

1. `npm run build` does NOT execute app code: the env guard `throw` in `src/lib/supabase.js` never runs during bundling. Missing env vars are only caught by `npm run verify` inspecting the bundle. Verify, not build, is the gate. `scripts/assert-bundle-env.mjs` also fails if the bundle still contains the string "Faltan variables de entorno".
2. PostgREST returns dates as `'YYYY-MM-DD'` strings; `new Date()` treats them as midnight UTC and can shift a day in negative-offset timezones. Always go through `src/utils/dates.js` (`parseDbDate`, `localDateKey`, `isOverdue`, `getUrgency`); never call `new Date()` on a DB date directly.
3. Migrations are applied once, in numeric order. 018/019/020 are idempotent by design (DROP/CREATE or catalog guards only); 001–017 are not, and 017 aborts with `42P13` on re-apply because its `CREATE OR REPLACE FUNCTION` changed a return type. Do not re-run a migration to "fix" a failure.
4. `profiles.role` is trigger-protected (`trg_protect_profiles_role`, 007); new signups always get `role = 'student'` from `handle_new_user`.
5. Views over RLS tables must use `WITH (security_invoker = true)` (027), otherwise they run as the owner and bypass student RLS. A view without it leaked every student's PII before 027.
6. RLS restricts rows, never columns. Column-level protection needs a trigger — e.g. `trg_restrict_student_task_update` (036) blocks students from rewriting their task's title/dates. It was silently lost when 021 renamed the table and 026 dropped the old one; a renamed table's triggers follow the table, they are not recreated.
7. Tasks were unified in 021: the table is `tasks`, with exactly one of `course_id` or `student_id` (CHECK `assignments_context_xor`). Progress on course tasks lives in `checklist_progress`, not on the task row. `ALTER TABLE ... RENAME` does NOT rename constraints, so 025/026 had to rename them to `tasks_*_fkey` by hand.
8. Web Push is fully removed (031): no VAPID env, no push table, no SW push/notificationclick listeners. Messaging tables were dropped in 028 — do not reintroduce.
9. Service worker cache busting: `vite.config.mjs` stamps `BUILD_VERSION` into `build/sw.js` after the build. Never hardcode a version in `public/sw.js`; the placeholder `'dev'` is what gets replaced.

---

## Adding a page

1. Create the view under `src/views/<area>/<Name>.jsx`.
2. Register it in `src/routes.js` (lazy; add `roles` to restrict).
3. Add the sidebar entry in `src/navigation.jsx` if it should be visible.
4. Fetch data through the matching `useSupabase*` hook; handle dates with `src/utils/dates.js`.
5. Add a test next to its siblings in `src/hooks/__tests__/` or `src/utils/__tests__/`.
6. Run the CI set before committing.

## Testing

- Vitest with jsdom: 27 files / 264 tests covering every `useSupabase*` hook and every `src/utils/*` module. Tests live in `__tests__/` folders next to the code they cover, named `<module>.test.ts`.
- `npm run test` takes ~60s (jsdom env is recreated per file).
- No component or view tests, and no e2e. The DB side is covered by SQL instead: `supabase/ci_verification.sql` (schema invariants) and `supabase/rls_tests.sql` (RLS behaviour under a real JWT), both run against a local Supabase in CI.
- `supabase/VERIFICACION_017.sql` holds the manual verification for 017. Its block B writes real rows and must run under `psql`, not the SQL Editor.

## Deploy

- Vercel. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables (the anon key is public by design). CI injects placeholder values so the artifact never carries `undefined`, but it does not talk to a real Supabase project.
- `vercel.json` sets `/assets/*` to immutable one-year cache and everything else to no-store, with `X-Frame-Options: DENY`, `nosniff`, and a restrictive `Permissions-Policy`. Keep it that way when editing.

## Security reminders

- Never trust `user_metadata` or JWT claims for role checks — only `profiles.role` plus RLS.
- New RPCs and views must respect RLS; add `security_invoker = true` when a view reads `profiles`, and a trigger when you need column-level protection.
- A table with no UI is still exposed via PostgREST. Drop unused tables rather than leaving them guarded.
- Edge Functions run with the service role key: keep them minimal and never ship that key to the client.
- `npm run verify` before any deploy that claims a config change.
