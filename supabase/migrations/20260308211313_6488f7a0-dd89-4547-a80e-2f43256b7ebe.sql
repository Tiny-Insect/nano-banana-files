
-- Create storage bucket for generated images
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-images', 'generated-images', true) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for reference images
INSERT INTO storage.buckets (id, name, public) VALUES ('reference-images', 'reference-images', true) ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read generated images (public bucket)
CREATE POLICY "Public read generated images" ON storage.objects FOR SELECT USING (bucket_id = 'generated-images');

-- Allow anyone to upload generated images (no auth required for this app)
CREATE POLICY "Public upload generated images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'generated-images');

-- Allow anyone to delete generated images
CREATE POLICY "Public delete generated images" ON storage.objects FOR DELETE USING (bucket_id = 'generated-images');

-- Allow anyone to read reference images
CREATE POLICY "Public read reference images" ON storage.objects FOR SELECT USING (bucket_id = 'reference-images');

-- Allow anyone to upload reference images
CREATE POLICY "Public upload reference images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reference-images');
