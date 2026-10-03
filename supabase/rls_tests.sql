-- =============================================================================
-- RLS verification (Block B: real JWT context).
--
-- ci_verification.sql checks the *shape* of the security model (RLS enabled,
-- policies present). This file checks the *behaviour*: it seeds fixtures as the
-- superuser, then impersonates each user by setting request.jwt.claims and
-- asserting, per role, exactly what can and cannot be seen or written.
--
-- Everything runs inside a single transaction that is rolled back at the end,
-- so the database is left untouched and the file is safe to run repeatedly.
--
-- Run after `supabase db reset`:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/rls_tests.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- FIXTURES (superuser: RLS does not apply; the profiles are created by the
-- handle_new_user() trigger of the auth.users inserts).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin    constant uuid := '11111111-1111-1111-1111-111111111111';
  v_student1 constant uuid := '22222222-2222-2222-2222-222222222222'; -- enrolled
  v_student2 constant uuid := '33333333-3333-3333-3333-333333333333'; -- not enrolled
  v_course   constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-admin@test.dev', now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"RLS Admin","username":"rls_admin"}'::jsonb, now(), now()),
    (v_student1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-student1@test.dev', now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"RLS Student One","username":"rls_student1"}'::jsonb, now(), now()),
    (v_student2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-student2@test.dev', now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"RLS Student Two","username":"rls_student2"}'::jsonb, now(), now());

  -- Promotion is done without JWT claims (trusted context), like the SQL editor.
  UPDATE public.profiles SET role = 'admin' WHERE id = v_admin;

  INSERT INTO public.student_metrics (student_id, progress, attendance)
  VALUES (v_student1, 40, 90), (v_student2, 10, 80);

  INSERT INTO public.courses (id, title, instrument, level, created_by)
  VALUES (v_course, 'RLS Course', 'Piano', 'Principiante', v_admin);

  INSERT INTO public.course_enrollments (course_id, student_id)
  VALUES (v_course, v_student1);

  -- Course assignment (course_id set, student_id NULL) + its checklist item.
  INSERT INTO public.tasks (id, title, course_id, created_by)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'RLS Course Task', v_course, v_admin);

  INSERT INTO public.task_checklist_items (id, task_id, label)
  VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Item 1');

  -- Individual assignments, one per student.
  INSERT INTO public.tasks (id, title, student_id, assigned_by, created_by)
  VALUES
    ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'RLS Task S1', v_student1, v_admin, v_admin),
    ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'RLS Task S2', v_student2, v_admin, v_admin);

  INSERT INTO public.course_forms (id, course_id, title, created_by)
  VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', v_course, 'RLS Form', v_admin);

  INSERT INTO public.form_questions (id, form_id, question_text, type)
  VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Question?', 'short_text');

  INSERT INTO public.course_materials (id, course_id, title, type, url, created_by)
  VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', v_course, 'RLS Material', 'link', 'https://example.com', v_admin);

  INSERT INTO public.payments (id, student_id, amount, payment_date, method, frequency, recorded_by)
  VALUES ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', v_student1, 50.00, CURRENT_DATE, 'Efectivo', 'Mensual', v_admin);

  INSERT INTO public.notification_log (student_id, student_name, message, method, trigger_type)
  VALUES (v_student1, 'RLS Student One', 'Reminder', 'whatsapp', 'Manual');

  INSERT INTO public.lessons (id, student_id, instrument, lesson_date, lesson_time, duration, teacher)
  VALUES
    ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', v_student1, 'Piano', CURRENT_DATE, '10:00', '60 min', 'Profe'),
    ('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', v_student2, 'Piano', CURRENT_DATE, '11:00', '60 min', 'Profe');

  INSERT INTO public.notifications (id, sender_id, recipient_id, title, message)
  VALUES
    ('f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1', v_admin, v_student1, 'Hello S1', 'Body'),
    ('f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2', v_admin, v_student2, 'Hello S2', 'Body');

  -- Payment proofs live under '<studentId>/...'; each student may only read theirs.
  INSERT INTO storage.objects (id, bucket_id, name, owner)
  VALUES
    ('0a0a0a0a-0a0a-0a0a-0a0a-0a0a0a0a0a0a', 'payment-proofs', v_student1::text || '/proof.pdf', v_student1),
    ('0b0b0b0b-0b0b-0b0b-0b0b-0b0b0b0b0b0b', 'payment-proofs', v_student2::text || '/proof.pdf', v_student2);
END $$;

-- -----------------------------------------------------------------------------
-- ADMIN: full access.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin constant uuid := '11111111-1111-1111-1111-111111111111';
  v      integer;
  v_fail text := '';
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  EXECUTE 'SELECT count(*) FROM public.profiles' INTO v;
  IF v <> 3 THEN v_fail := v_fail || format('profiles=%s (want 3); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.payments' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('payments=%s (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.notification_log' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('notification_log=%s (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.lessons' INTO v;
  IF v <> 2 THEN v_fail := v_fail || format('lessons=%s (want 2); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.tasks' INTO v;
  IF v <> 3 THEN v_fail := v_fail || format('tasks=%s (want 3); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.courses' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('courses=%s (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.notifications' INTO v;
  IF v <> 2 THEN v_fail := v_fail || format('notifications=%s (want 2); ', v); END IF;

  EXECUTE 'RESET ROLE';
  IF v_fail <> '' THEN RAISE EXCEPTION 'RLS check failed (admin): %', v_fail; END IF;
END $$;

-- -----------------------------------------------------------------------------
-- ENROLLED STUDENT (student1).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_student1 constant uuid := '22222222-2222-2222-2222-222222222222';
  v      integer;
  v_fail text := '';
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_student1::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Identity: own profile + the admin's staff profile, never the other student.
  EXECUTE 'SELECT count(*) FROM public.profiles' INTO v;
  IF v <> 2 THEN v_fail := v_fail || format('sees %s profiles (want 2: self+staff); ', v); END IF;

  -- Admin-only tables.
  EXECUTE 'SELECT count(*) FROM public.payments' INTO v;
  IF v <> 0 THEN v_fail := v_fail || format('sees %s payments (want 0); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.notification_log' INTO v;
  IF v <> 0 THEN v_fail := v_fail || format('sees %s notification_log (want 0); ', v); END IF;

  -- Own lesson only.
  EXECUTE 'SELECT count(*) FROM public.lessons' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s lessons (want 1); ', v); END IF;

  -- Own individual assignment + the course assignment.
  EXECUTE 'SELECT count(*) FROM public.tasks' INTO v;
  IF v <> 2 THEN v_fail := v_fail || format('sees %s tasks (want 2); ', v); END IF;

  -- Enrolled course content.
  EXECUTE 'SELECT count(*) FROM public.courses' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s courses (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.task_checklist_items' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s checklist items (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.course_forms' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s forms (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.form_questions' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s questions (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.course_materials' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s materials (want 1); ', v); END IF;

  -- Own notification and own metrics only.
  EXECUTE 'SELECT count(*) FROM public.notifications' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s notifications (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.student_metrics' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s metrics (want 1); ', v); END IF;

  -- Storage: only own payment-proof folder.
  EXECUTE 'SELECT count(*) FROM storage.objects WHERE bucket_id = ''payment-proofs''' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s payment proofs (want 1); ', v); END IF;

  -- Can mark own notification as read.
  EXECUTE format('UPDATE public.notifications SET read = true WHERE recipient_id = %L', v_student1);
  GET DIAGNOSTICS v = ROW_COUNT;
  IF v <> 1 THEN v_fail := v_fail || format('updated %s own notifications (want 1); ', v); END IF;

  -- 032 re-enables the self-update on profiles, but only for the whitelisted
  -- columns (phone/instrument/avatar_url). The guard trigger must reject both
  -- role escalation and edits to sensitive columns.
  EXECUTE 'UPDATE public.profiles SET phone = ''+58 0000000'', instrument = ''Piano'' WHERE id = auth.uid()';
  GET DIAGNOSTICS v = ROW_COUNT;
  IF v <> 1 THEN v_fail := v_fail || format('updated own profile (%s rows, want 1); ', v); END IF;

  BEGIN
    EXECUTE 'UPDATE public.profiles SET role = ''admin'' WHERE id = auth.uid()';
    v_fail := v_fail || 'escalated own role (expected rejection); ';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;

  BEGIN
    EXECUTE 'UPDATE public.profiles SET status = ''Inactivo'' WHERE id = auth.uid()';
    v_fail := v_fail || 'changed own status (expected rejection); ';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;

  -- 027 removed the self-update on metrics: students cannot inflate progress.
  EXECUTE 'UPDATE public.student_metrics SET progress = 100 WHERE student_id = auth.uid()';
  GET DIAGNOSTICS v = ROW_COUNT;
  IF v <> 0 THEN v_fail := v_fail || format('updated own metrics (%s rows, want 0); ', v); END IF;

  -- Allowed writes on enrolled content.
  BEGIN
    EXECUTE format('INSERT INTO public.checklist_progress (item_id, student_id) VALUES (%L, %L)',
      'cccccccc-cccc-cccc-cccc-cccccccccccc', v_student1);
  EXCEPTION WHEN others THEN
    v_fail := v_fail || 'could not insert checklist_progress: ' || SQLERRM || '; ';
  END;

  BEGIN
    EXECUTE format('INSERT INTO public.form_submissions (form_id, student_id) VALUES (%L, %L)',
      'dddddddd-dddd-dddd-dddd-dddddddddddd', v_student1);
  EXCEPTION WHEN others THEN
    v_fail := v_fail || 'could not insert form_submission: ' || SQLERRM || '; ';
  END;

  EXECUTE 'RESET ROLE';
  IF v_fail <> '' THEN RAISE EXCEPTION 'RLS check failed (student1/enrolled): %', v_fail; END IF;
END $$;

-- -----------------------------------------------------------------------------
-- NON-ENROLLED STUDENT (student2).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_student2 constant uuid := '33333333-3333-3333-3333-333333333333';
  v      integer;
  v_fail text := '';
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_student2::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  EXECUTE 'SELECT count(*) FROM public.profiles' INTO v;
  IF v <> 2 THEN v_fail := v_fail || format('sees %s profiles (want 2: self+staff); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.payments' INTO v;
  IF v <> 0 THEN v_fail := v_fail || format('sees %s payments (want 0); ', v); END IF;

  -- Own individual assignment only; nothing from the course.
  EXECUTE 'SELECT count(*) FROM public.tasks' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s tasks (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.courses' INTO v;
  IF v <> 0 THEN v_fail := v_fail || format('sees %s courses (want 0); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.task_checklist_items' INTO v;
  IF v <> 0 THEN v_fail := v_fail || format('sees %s checklist items (want 0); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.course_forms' INTO v;
  IF v <> 0 THEN v_fail := v_fail || format('sees %s forms (want 0); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.course_materials' INTO v;
  IF v <> 0 THEN v_fail := v_fail || format('sees %s materials (want 0); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.notifications' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s notifications (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM public.student_metrics' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s metrics (want 1); ', v); END IF;

  EXECUTE 'SELECT count(*) FROM storage.objects WHERE bucket_id = ''payment-proofs''' INTO v;
  IF v <> 1 THEN v_fail := v_fail || format('sees %s payment proofs (want 1); ', v); END IF;

  -- Course writes must be rejected by RLS.
  BEGIN
    EXECUTE format('INSERT INTO public.checklist_progress (item_id, student_id) VALUES (%L, %L)',
      'cccccccc-cccc-cccc-cccc-cccccccccccc', v_student2);
    v_fail := v_fail || 'could insert checklist_progress for a course not enrolled; ';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;

  BEGIN
    EXECUTE format('INSERT INTO public.form_submissions (form_id, student_id) VALUES (%L, %L)',
      'dddddddd-dddd-dddd-dddd-dddddddddddd', v_student2);
    v_fail := v_fail || 'could insert form_submission for a course not enrolled; ';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;

  EXECUTE 'RESET ROLE';
  IF v_fail <> '' THEN RAISE EXCEPTION 'RLS check failed (student2/not enrolled): %', v_fail; END IF;
END $$;

ROLLBACK;
