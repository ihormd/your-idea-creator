CREATE TABLE public.inbound_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  alias text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_aliases TO authenticated;
GRANT ALL ON public.inbound_aliases TO service_role;
ALTER TABLE public.inbound_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alias" ON public.inbound_aliases FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.inbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  alias text,
  from_email text,
  subject text,
  attachments_count integer NOT NULL DEFAULT 0,
  receipts_created integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed','ignored','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inbound_emails_user_idx ON public.inbound_emails (user_id, created_at DESC);
GRANT SELECT ON public.inbound_emails TO authenticated;
GRANT ALL ON public.inbound_emails TO service_role;
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inbound emails" ON public.inbound_emails FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'scan';