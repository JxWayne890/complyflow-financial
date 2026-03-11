ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enable_review_emails BOOLEAN DEFAULT false;
