-- RLS isolation test — SETUP. Run in Supabase Dashboard SQL editor.
-- The SQL editor runs as postgres, bypassing RLS, so these inserts succeed.
--
-- 1. Create two test users in Dashboard -> Authentication -> Add user
--    (e.g. test-a@example.com, test-b@example.com). Copy their UUIDs from
--    the users list.
-- 2. Paste the two UUIDs below, run this file, note the business ids
--    from the Notices (or re-read them from the businesses table).
-- 3. Run rls-check.mjs (same folder) with the project URL, anon key and
--    the two test users' emails/passwords.
-- 4. After a PASS, clean up with the DELETE at the bottom of this file
--    and remove the two test users in Authentication.

DO $$
DECLARE
  user_a uuid := 'PASTE-USER-A-UUID-HERE';
  user_b uuid := 'PASTE-USER-B-UUID-HERE';
  biz_a uuid;
  biz_b uuid;
BEGIN
  INSERT INTO public.businesses (name, mode) VALUES ('TEST-A', 'expense') RETURNING id INTO biz_a;
  INSERT INTO public.businesses (name, mode) VALUES ('TEST-B', 'expense') RETURNING id INTO biz_b;

  INSERT INTO public.memberships (business_id, user_id, role, status)
  VALUES (biz_a, user_a, 'owner', 'active'),
         (biz_b, user_b, 'owner', 'active');

  -- One seed receipt per business, so the check is non-vacuous:
  -- a broken policy would make a user see 2 receipts instead of 1.
  INSERT INTO public.receipts (business_id, category, currency, source, total, review_status, vendor, warnings)
  VALUES (biz_a, 'other', 'CAD', 'test', 1.00, 'draft', 'TEST-A receipt', '{}'),
         (biz_b, 'other', 'CAD', 'test', 1.00, 'draft', 'TEST-B receipt', '{}');

  RAISE NOTICE 'business A (TEST-A): %', biz_a;
  RAISE NOTICE 'business B (TEST-B): %', biz_b;
END $$;

-- CLEANUP (run only after a PASS, then delete the test users in Authentication):
-- DELETE FROM public.receipts WHERE vendor LIKE 'TEST-% receipt';
-- DELETE FROM public.businesses WHERE name IN ('TEST-A', 'TEST-B');
-- (memberships in those businesses are deleted automatically by ON DELETE
--  CASCADE; receipts carry no foreign key, so they are deleted explicitly.)
