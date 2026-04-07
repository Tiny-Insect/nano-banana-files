-- Create a public storage bucket for reference images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reference-images', 'reference-images', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

-- Allow anyone to upload reference images
CREATE POLICY "Anyone can upload reference images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'reference-images');

-- Allow anyone to read reference images
CREATE POLICY "Anyone can read reference images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'reference-images');

-- Allow anyone to delete reference images
CREATE POLICY "Anyone can delete reference images"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'reference-images');