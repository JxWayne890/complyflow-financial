ALTER TABLE assets ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
