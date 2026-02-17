-- Run this once in Supabase SQL Editor.
-- It adds the missing RLS policies required for:
-- 1) Advisors to create content requests
-- 2) Advisors/compliance/admins to create new content versions
-- 3) Compliance/admin to move requests through approval statuses
-- 4) Compliance/admin to leave review notes

DROP POLICY IF EXISTS "Advisor create own requests" ON content_requests;
CREATE POLICY "Advisor create own requests" ON content_requests
FOR INSERT
WITH CHECK (
  advisor_id = auth.uid()
  AND org_id = get_auth_org_id()
  AND get_auth_role() IN ('advisor', 'admin')
);

DROP POLICY IF EXISTS "Compliance/Admin update all requests" ON content_requests;
CREATE POLICY "Compliance/Admin update all requests" ON content_requests
FOR UPDATE
USING (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('compliance', 'admin')
)
WITH CHECK (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('compliance', 'admin')
);

DROP POLICY IF EXISTS "Create versions for accessible requests" ON content_versions;
CREATE POLICY "Create versions for accessible requests" ON content_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM content_requests r
    WHERE r.id = content_versions.request_id
      AND (
        r.advisor_id = auth.uid()
        OR (
          r.org_id = get_auth_org_id()
          AND get_auth_role() IN ('compliance', 'admin')
        )
      )
  )
);

DROP POLICY IF EXISTS "Compliance create review" ON compliance_reviews;
DROP POLICY IF EXISTS "Compliance/Admin create review" ON compliance_reviews;
CREATE POLICY "Compliance/Admin create review" ON compliance_reviews
FOR INSERT
WITH CHECK (
  get_auth_role() IN ('compliance', 'admin')
);
