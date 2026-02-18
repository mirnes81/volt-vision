
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Allow anon upload to intervention-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon read intervention-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon delete intervention-photos" ON storage.objects;

-- Recreate with proper restrictions (only for intervention-photos bucket, path must start with a number/intervention ID)
CREATE POLICY "Allow upload to intervention-photos bucket"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'intervention-photos'
  AND (storage.foldername(name))[1] ~ '^\d+$'
);

CREATE POLICY "Allow read intervention-photos bucket"
ON storage.objects
FOR SELECT
USING (bucket_id = 'intervention-photos');

CREATE POLICY "Allow delete intervention-photos bucket"
ON storage.objects
FOR DELETE
USING (bucket_id = 'intervention-photos');
