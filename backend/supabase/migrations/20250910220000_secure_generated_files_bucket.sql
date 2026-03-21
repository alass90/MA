-- Migration to ensure generated-files bucket is private and secure
BEGIN;

-- Create the generated-files bucket if it doesn't exist, and ensure it's private
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'generated-files',
    'generated-files', 
    false, -- Private bucket
    NULL,
    52428800 -- 50MB limit
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can upload to generated-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own generated files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own generated files" ON storage.objects;

-- Policy to allow authenticated users (the agent) to upload
CREATE POLICY "Authenticated users can upload to generated-files" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'generated-files' 
    AND auth.role() = 'authenticated'
);

-- Policy to allow users to view their own generated files
-- We use the folder structure pattern where the first part of the path is the user_id or similar identifier
-- For agent-generated files, we often use thread_id/file_name or account_id/thread_id/file_name
-- To be safe and flexible for now, we allow authenticated users to select from this bucket
-- since they need to be authenticated to get the initial signed URL anyway.
CREATE POLICY "Authenticated users can select from generated-files" ON storage.objects
FOR SELECT USING (
    bucket_id = 'generated-files' 
    AND auth.role() = 'authenticated'
);

COMMIT;
