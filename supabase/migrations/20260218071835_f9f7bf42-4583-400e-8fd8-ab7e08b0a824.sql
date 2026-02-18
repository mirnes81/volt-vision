
-- Allow uploads to intervention-photos bucket for Dolibarr (anon) users
CREATE POLICY "Allow anon upload to intervention-photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'intervention-photos');

-- Allow anon to read/view photos
CREATE POLICY "Allow anon read intervention-photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'intervention-photos');

-- Allow anon to delete their own photos
CREATE POLICY "Allow anon delete intervention-photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'intervention-photos');
