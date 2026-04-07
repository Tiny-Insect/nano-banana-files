-- Create a public storage bucket for generated images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('generated-images', 'generated-images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Allow edge functions (service role) and anon to read
CREATE POLICY "Anyone can read generated images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'generated-images');

-- Allow service role to insert (edge function uses service role)
CREATE POLICY "Service role can upload generated images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'generated-images');

-- Also allow anon to insert for edge function context
CREATE POLICY "Anon can upload generated images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'generated-images');