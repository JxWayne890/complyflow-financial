-- Grounded citation pipeline: source chunks, audit logs, and persisted citation payloads

ALTER TABLE public.content_versions
  ADD COLUMN IF NOT EXISTS citation_payload jsonb,
  ADD COLUMN IF NOT EXISTS source_payload jsonb,
  ADD COLUMN IF NOT EXISTS source_limitations text,
  ADD COLUMN IF NOT EXISTS grounding_status text
    CHECK (grounding_status IN ('grounded', 'limited', 'ungrounded'));

CREATE TABLE IF NOT EXISTS public.citation_source_chunks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  title text NOT NULL,
  source_type text NOT NULL,
  canonical_url text,
  document_name text,
  page_number integer,
  section_heading text,
  published_date date,
  chunk_text text NOT NULL,
  chunk_index integer NOT NULL,
  authority_score numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (org_id, source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS citation_source_chunks_org_idx
  ON public.citation_source_chunks(org_id, is_active);

CREATE INDEX IF NOT EXISTS citation_source_chunks_source_idx
  ON public.citation_source_chunks(source_id, chunk_index);

CREATE INDEX IF NOT EXISTS citation_source_chunks_authority_idx
  ON public.citation_source_chunks(authority_score DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.grounding_audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.content_requests(id) ON DELETE SET NULL,
  topic text,
  query_text text,
  provider text,
  used_chunks jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_limitations text,
  grounding_status text NOT NULL DEFAULT 'ungrounded'
    CHECK (grounding_status IN ('grounded', 'limited', 'ungrounded')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grounding_audit_logs_org_idx
  ON public.grounding_audit_logs(org_id, created_at DESC);

ALTER TABLE public.citation_source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grounding_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View org citation source chunks" ON public.citation_source_chunks;
CREATE POLICY "View org citation source chunks"
ON public.citation_source_chunks
FOR SELECT
USING (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('advisor', 'compliance', 'admin')
);

DROP POLICY IF EXISTS "Manage org citation source chunks" ON public.citation_source_chunks;
CREATE POLICY "Manage org citation source chunks"
ON public.citation_source_chunks
FOR ALL
USING (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('advisor', 'compliance', 'admin')
)
WITH CHECK (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('advisor', 'compliance', 'admin')
);

DROP POLICY IF EXISTS "View org grounding audit logs" ON public.grounding_audit_logs;
CREATE POLICY "View org grounding audit logs"
ON public.grounding_audit_logs
FOR SELECT
USING (
  org_id = get_auth_org_id()
  AND get_auth_role() IN ('advisor', 'compliance', 'admin')
);
