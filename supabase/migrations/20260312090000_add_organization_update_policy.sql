CREATE POLICY "Compliance/Admin update own org" ON organizations FOR UPDATE
USING (
  id = get_auth_org_id()
  AND get_auth_role() IN ('compliance', 'admin')
)
WITH CHECK (
  id = get_auth_org_id()
  AND get_auth_role() IN ('compliance', 'admin')
);
