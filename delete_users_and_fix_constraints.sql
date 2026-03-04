-- 1. Update Foreign Key Constraints to allow Cascading Deletes
-- This ensures that when a Profile is deleted, related records are also removed
-- instead of blocking the deletion.

-- Fix for content_requests table (advisor_id)
ALTER TABLE IF EXISTS public.content_requests
DROP CONSTRAINT IF EXISTS content_requests_advisor_id_fkey,
ADD CONSTRAINT content_requests_advisor_id_fkey 
  FOREIGN KEY (advisor_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- Fix for compliance_reviews table (reviewer_id)
ALTER TABLE IF EXISTS public.compliance_reviews
DROP CONSTRAINT IF EXISTS compliance_reviews_reviewer_id_fkey,
ADD CONSTRAINT compliance_reviews_reviewer_id_fkey 
  FOREIGN KEY (reviewer_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- Fix for clients table (linked_user_id)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'linked_user_id'
    ) THEN
        ALTER TABLE public.clients
        DROP CONSTRAINT IF EXISTS clients_linked_user_id_fkey,
        ADD CONSTRAINT clients_linked_user_id_fkey 
          FOREIGN KEY (linked_user_id) 
          REFERENCES auth.users(id) 
          ON DELETE CASCADE;
    END IF;
END $$;


-- 2. Delete the specific profiles requested by email
-- Note: We delete from auth.users which cascades to profiles and beyond
DELETE FROM auth.users 
WHERE email IN (
  'theprovidersystem@gmail.com',
  'thejohnwjohnson@gmail.com',
  'realadvisor@gmail.com',
  '2@2.co'
);
