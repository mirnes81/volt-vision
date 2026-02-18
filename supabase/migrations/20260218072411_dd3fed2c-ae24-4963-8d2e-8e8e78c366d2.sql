-- Mettre à jour le bucket intervention-photos pour accepter tous les types d'images mobiles
-- et augmenter la limite de taille à 50MB
UPDATE storage.buckets 
SET 
  file_size_limit = 52428800, -- 50MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp', 'image/tiff', 'application/octet-stream']
WHERE id = 'intervention-photos';