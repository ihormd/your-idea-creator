CREATE TYPE public.app_mode AS ENUM ('job','expense');
CREATE TYPE public.project_status AS ENUM ('active','completed','archived');
CREATE TYPE public.review_status AS ENUM ('draft','needs_review','approved','exported');
CREATE TYPE public.expense_category AS ENUM ('materials','fuel','tools','equipment','subcontractors','permits','travel','meals','other');
CREATE TYPE public.payment_method AS ENUM ('cash','credit_card','debit_card','etransfer','cheque','other');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  mode public.app_mode NOT NULL DEFAULT 'job',
  country TEXT NOT NULL DEFAULT 'CA',
  currency TEXT NOT NULL DEFAULT 'CAD',
  accounting_software TEXT NOT NULL DEFAULT 'none',
  budget_warn_pct INTEGER NOT NULL DEFAULT 80,
  budget_critical_pct INTEGER NOT NULL DEFAULT 100,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, business_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'business_name',''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  customer TEXT,
  project_number TEXT,
  start_date DATE,
  end_date DATE,
  revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.project_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX projects_user_idx ON public.projects(user_id, status);

CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  image_path TEXT,
  vendor TEXT,
  receipt_date DATE,
  currency TEXT NOT NULL DEFAULT 'CAD',
  subtotal NUMERIC(14,2),
  gst_hst NUMERIC(14,2),
  other_tax NUMERIC(14,2),
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  category public.expense_category NOT NULL DEFAULT 'other',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  payment_method public.payment_method,
  receipt_number TEXT,
  notes TEXT,
  ai_raw JSONB,
  ai_confidence JSONB,
  warnings TEXT[] NOT NULL DEFAULT '{}',
  duplicate_of UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  review_status public.review_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own receipts" ON public.receipts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER receipts_updated BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX receipts_user_idx ON public.receipts(user_id, receipt_date DESC);
CREATE INDEX receipts_project_idx ON public.receipts(project_id);

CREATE TABLE public.receipt_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.receipt_audit TO authenticated;
GRANT ALL ON public.receipt_audit TO service_role;
ALTER TABLE public.receipt_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.receipt_audit FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own audit write" ON public.receipt_audit FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX receipt_audit_receipt_idx ON public.receipt_audit(receipt_id, created_at DESC);

CREATE POLICY "receipt images select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "receipt images insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "receipt images update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "receipt images delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);