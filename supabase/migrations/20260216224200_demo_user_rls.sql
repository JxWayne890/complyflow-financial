-- Allow the local demo user to insert content requests
CREATE OR REPLACE FUNCTION is_demo_user(uid uuid) RETURNS boolean AS $$
BEGIN
  RETURN uid = '00000000-0000-0000-0000-000000000000'::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Advisor create own requests" ON content_requests;
CREATE POLICY "Advisor create own requests" ON content_requests
FOR INSERT
WITH CHECK (
  (advisor_id = auth.uid() AND org_id = get_auth_org_id() AND get_auth_role() IN ('advisor', 'admin'))
  OR (advisor_id = '00000000-0000-0000-0000-000000000000'::uuid)
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
        OR r.advisor_id = '00000000-0000-0000-0000-000000000000'::uuid
        OR (
          r.org_id = get_auth_org_id()
          AND get_auth_role() IN ('compliance', 'admin')
        )
      )
  )
);
