ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS export_audience text NOT NULL DEFAULT 'me';

DROP POLICY IF EXISTS "branding own read" ON storage.objects;
CREATE POLICY "branding own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "branding own insert" ON storage.objects;
CREATE POLICY "branding own insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "branding own update" ON storage.objects;
CREATE POLICY "branding own update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "branding own delete" ON storage.objects;
CREATE POLICY "branding own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);