-- =========================================================
-- STEP 1: DIAGNOSE — Run these first to check current state
-- =========================================================

-- Check if table exists
SELECT to_regclass('public.compliance_highlights') AS table_exists;

-- Check RLS policies
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'compliance_highlights';

-- Check if get_auth_role returns the right value for logged-in user
SELECT get_auth_role() AS my_role, get_auth_org_id() AS my_org_id;

-- =========================================================
-- STEP 2: CREATE TABLE (if Step 1 shows table_exists = NULL)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.compliance_highlights (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.content_requests(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.content_versions(id) ON DELETE SET NULL,
  highlight_id text NOT NULL,
  selected_text text NOT NULL,
  note text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (request_id, highlight_id)
);

CREATE INDEX IF NOT EXISTS compliance_highlights_request_idx
  ON public.compliance_highlights(request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS compliance_highlights_org_idx
  ON public.compliance_highlights(org_id);

-- =========================================================
-- STEP 3: ENABLE RLS + POLICIES (always safe to re-run)
-- =========================================================

ALTER TABLE public.compliance_highlights ENABLE ROW LEVEL SECURITY;

-- View: same-org advisors, compliance, admin can read
DROP POLICY IF EXISTS "View org compliance highlights" ON public.compliance_highlights;
CREATE POLICY "View org compliance highlights"
ON public.compliance_highlights
FOR SELECT
USING (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('advisor', 'compliance', 'admin')
);

-- Insert: compliance + admin only
DROP POLICY IF EXISTS "Compliance/Admin create highlights" ON public.compliance_highlights;
CREATE POLICY "Compliance/Admin create highlights"
ON public.compliance_highlights
FOR INSERT
WITH CHECK (
  org_id = get_auth_org_id()
  AND created_by = auth.uid()
  AND get_auth_role() IN ('compliance', 'admin')
);

-- Update: advisor/compliance/admin can update (for resolving)
DROP POLICY IF EXISTS "Advisor/Compliance/Admin update highlights" ON public.compliance_highlights;
CREATE POLICY "Advisor/Compliance/Admin update highlights"
ON public.compliance_highlights
FOR UPDATE
USING (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('advisor', 'compliance', 'admin')
)
WITH CHECK (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('advisor', 'compliance', 'admin')
);

-- =========================================================
-- STEP 4: VERIFY insert works for YOUR user
-- (Replace the UUIDs below with real values from your DB)
-- =========================================================
-- SELECT id, role, org_id FROM profiles WHERE id = auth.uid();
-- SELECT id FROM content_requests LIMIT 1;
-- Then try a manual insert to confirm:
-- INSERT INTO compliance_highlights (org_id, request_id, highlight_id, selected_text, note, created_by)
-- VALUES ('<your_org_id>', '<some_request_id>', 'test-123', 'Selected text here', 'Test note', auth.uid());
