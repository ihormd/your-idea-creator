-- OCR usage counters for the per-day scan quota (see
-- src/lib/ocr-quota.server.ts). No permissive RLS policies on purpose:
-- only the service-role key used by server code reads and writes this
-- table, so a client can never inflate or reset its own quota.

CREATE TABLE IF NOT EXISTS public.ocr_usage (
  scope text NOT NULL CHECK (scope IN ('user', 'business')),
  scope_id uuid NOT NULL,
  day date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, scope_id, day)
);

ALTER TABLE public.ocr_usage ENABLE ROW LEVEL SECURITY;
