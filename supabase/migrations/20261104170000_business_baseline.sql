-- Business (multi-tenant) baseline.
--
-- The live database gained businesses / memberships / business_id through
-- the Supabase Dashboard, so those objects exist there but not in
-- migrations. Everything below is idempotent: it is a no-op where the live
-- objects already exist, and it rebuilds the same shape on a fresh database.
-- DO NOT apply to production until Supabase is resumed and a backup exists.
-- After applying, regenerate src/integrations/supabase/types.ts
-- (supabase gen types) and re-run the two-user isolation test.

-- Enums (create only when missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_mode') THEN
    CREATE TYPE public.app_mode AS ENUM ('job', 'expense');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role') THEN
    CREATE TYPE public.membership_role AS ENUM ('owner', 'admin', 'member', 'accountant', 'read_only');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
    CREATE TYPE public.membership_status AS ENUM ('invited', 'active');
  END IF;
END $$;

-- Tables (columns mirror src/integrations/supabase/types.ts)
CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mode public.app_mode NOT NULL DEFAULT 'expense',
  currency text NOT NULL DEFAULT 'CAD',
  country text NOT NULL DEFAULT 'CA',
  onboarded boolean NOT NULL DEFAULT false,
  theme text NOT NULL DEFAULT 'default',
  accounting_software text NOT NULL DEFAULT 'none',
  export_audience text NOT NULL DEFAULT 'accountant',
  budget_warn_pct numeric NOT NULL DEFAULT 80,
  budget_critical_pct numeric NOT NULL DEFAULT 100,
  logo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  invited_by uuid,
  invited_email text,
  role public.membership_role NOT NULL DEFAULT 'member',
  status public.membership_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

-- business_id columns on pre-business tables (no-op when already present)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.receipt_audit ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.inbound_aliases ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.inbound_emails ADD COLUMN IF NOT EXISTS business_id uuid;

CREATE INDEX IF NOT EXISTS memberships_business_idx ON public.memberships (business_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON public.memberships (user_id);
CREATE INDEX IF NOT EXISTS projects_business_idx ON public.projects (business_id);
CREATE INDEX IF NOT EXISTS receipts_business_idx ON public.receipts (business_id);

-- updated_at trigger for businesses (reuses update_updated_at_column()
-- from the first migration)
DROP TRIGGER IF EXISTS businesses_updated ON public.businesses;
CREATE TRIGGER businesses_updated BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Membership helper. SECURITY DEFINER so policies can use it without
-- recursing into the memberships table's own RLS.
CREATE OR REPLACE FUNCTION public.is_business_member(bid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE business_id = bid AND user_id = auth.uid() AND status = 'active'
  );
$$;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

-- Businesses: members read/write their own businesses; any authenticated
-- user may create one (the app then inserts the owner membership row).
DROP POLICY IF EXISTS "business member read" ON public.businesses;
CREATE POLICY "business member read" ON public.businesses FOR SELECT TO authenticated
  USING (public.is_business_member(id));
DROP POLICY IF EXISTS "business member write" ON public.businesses;
CREATE POLICY "business member write" ON public.businesses FOR UPDATE TO authenticated
  USING (public.is_business_member(id)) WITH CHECK (public.is_business_member(id));
DROP POLICY IF EXISTS "business create" ON public.businesses;
CREATE POLICY "business create" ON public.businesses FOR INSERT TO authenticated WITH CHECK (true);

-- Memberships: a user always sees their own rows; members see fellow members.
DROP POLICY IF EXISTS "membership own read" ON public.memberships;
CREATE POLICY "membership own read" ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_business_member(business_id));
DROP POLICY IF EXISTS "membership own write" ON public.memberships;
CREATE POLICY "membership own write" ON public.memberships FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_business_member(business_id))
  WITH CHECK (user_id = auth.uid() OR public.is_business_member(business_id));

-- Business-scoped tables. These policies sit ALONGSIDE the older user_id
-- policies from the first migration (permissive policies combine with OR),
-- so pre-business rows stay visible to their owners.
DROP POLICY IF EXISTS "business projects" ON public.projects;
CREATE POLICY "business projects" ON public.projects FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
DROP POLICY IF EXISTS "business receipts" ON public.receipts;
CREATE POLICY "business receipts" ON public.receipts FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
DROP POLICY IF EXISTS "business audit" ON public.receipt_audit;
CREATE POLICY "business audit" ON public.receipt_audit FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
DROP POLICY IF EXISTS "business aliases" ON public.inbound_aliases;
CREATE POLICY "business aliases" ON public.inbound_aliases FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
DROP POLICY IF EXISTS "business inbound emails" ON public.inbound_emails;
CREATE POLICY "business inbound emails" ON public.inbound_emails FOR ALL TO authenticated
  USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));

-- Storage: the webhook stores receipt images at <business_id>/<file>, but
-- the original "receipt images" policies only allow a first folder equal to
-- the caller's auth.uid(). Add business-scoped storage policies alongside
-- them (old user-folder files keep working through the original policies).
-- The regex guard keeps non-UUID folder names from breaking the cast.
DROP POLICY IF EXISTS "receipt images business select" ON storage.objects;
CREATE POLICY "receipt images business select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_business_member((storage.foldername(name))[1]::uuid));
DROP POLICY IF EXISTS "receipt images business insert" ON storage.objects;
CREATE POLICY "receipt images business insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_business_member((storage.foldername(name))[1]::uuid));
DROP POLICY IF EXISTS "receipt images business update" ON storage.objects;
CREATE POLICY "receipt images business update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_business_member((storage.foldername(name))[1]::uuid));
DROP POLICY IF EXISTS "receipt images business delete" ON storage.objects;
CREATE POLICY "receipt images business delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_business_member((storage.foldername(name))[1]::uuid));
