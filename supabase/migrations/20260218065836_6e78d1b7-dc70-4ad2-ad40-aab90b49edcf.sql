
-- Create bucket for intervention photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'intervention-photos',
  'intervention-photos',
  true,
  10485760, -- 10MB max per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for intervention-photos bucket
CREATE POLICY "Authenticated users can upload intervention photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'intervention-photos');

CREATE POLICY "Intervention photos are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'intervention-photos');

CREATE POLICY "Authenticated users can delete their intervention photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'intervention-photos');

-- Create table to track intervention photos in Supabase
CREATE TABLE IF NOT EXISTS public.intervention_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('avant', 'pendant', 'apres', 'oibt', 'defaut')),
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  original_filename TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.intervention_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view photos of their tenant"
ON public.intervention_photos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert photos"
ON public.intervention_photos FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can delete their own photos"
ON public.intervention_photos FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid()::text);
