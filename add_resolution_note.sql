-- =========================================================
-- STEP 1: Add resolution_note to compliance_highlights
-- =========================================================

-- Safe to re-run: adds the column if it doesn't exist
ALTER TABLE public.compliance_highlights 
ADD COLUMN IF NOT EXISTS resolution_note text;

-- =========================================================
-- STEP 2: Verify the column was added
-- =========================================================

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'compliance_highlights' 
  AND column_name = 'resolution_note';
