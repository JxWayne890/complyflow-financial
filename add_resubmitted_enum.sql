-- The 'decision' column uses a CHECK constraint rather than an ENUM type.
-- We need to drop the existing constraint and add the new one.

DO $$
BEGIN
  -- We first must find the name of the constraint to drop it
  -- Standard naming convention in Supabase/Postgres is table_column_check
  -- If we can't be sure, we can just replace the constraint entirely
  
  ALTER TABLE public.compliance_reviews DROP CONSTRAINT IF EXISTS compliance_reviews_decision_check;
  
  ALTER TABLE public.compliance_reviews 
  ADD CONSTRAINT compliance_reviews_decision_check 
  CHECK (decision IN ('approved', 'changes_requested', 'rejected', 'resubmitted'));
  
END $$;
