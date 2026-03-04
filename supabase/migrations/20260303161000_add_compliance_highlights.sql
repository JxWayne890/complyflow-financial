-- Inline compliance highlight notes for advisor/compliance collaboration

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

ALTER TABLE public.compliance_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View org compliance highlights" ON public.compliance_highlights;
CREATE POLICY "View org compliance highlights"
ON public.compliance_highlights
FOR SELECT
USING (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('advisor', 'compliance', 'admin')
);

DROP POLICY IF EXISTS "Compliance/Admin create highlights" ON public.compliance_highlights;
CREATE POLICY "Compliance/Admin create highlights"
ON public.compliance_highlights
FOR INSERT
WITH CHECK (
  org_id = get_auth_org_id()
  AND created_by = auth.uid()
  AND get_auth_role() IN ('compliance', 'admin')
);

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
