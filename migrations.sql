-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  compliance_required boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Profiles (Users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  org_id uuid REFERENCES organizations(id),
  role text NOT NULL CHECK (role IN ('admin', 'advisor', 'compliance')),
  name text,
  email text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Clients
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  company text,
  audience_type text CHECK (audience_type IN ('general_public', 'accredited', 'qualified')),
  notes text,
  avatar_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'onboarding')),
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Client Social Accounts
CREATE TABLE IF NOT EXISTS client_social_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  platform text CHECK (platform IN ('linkedin', 'facebook', 'twitter', 'instagram')),
  account_name text,
  connected boolean DEFAULT false,
  blotato_connection_id text,
  posting_preference text DEFAULT 'manual' CHECK (posting_preference IN ('auto', 'manual', 'scheduled')),
  created_at timestamp with time zone DEFAULT now()
);

-- 5. Topics
CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES organizations(id),
  category text,
  theme text,
  topic text NOT NULL,
  active boolean DEFAULT true,
  source text DEFAULT 'manual',
  external_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Content Requests (The main container for a piece of work)
CREATE TABLE IF NOT EXISTS content_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid REFERENCES organizations(id),
  advisor_id uuid REFERENCES profiles(id),
  client_id uuid REFERENCES clients(id),
  topic_id uuid REFERENCES topics(id),
  topic_text text,
  content_type text CHECK (content_type IN ('blog', 'linkedin', 'facebook', 'ad', 'video_script')),
  instructions text,
  status text CHECK (status IN ('draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'scheduled', 'posted', 'rejected')),
  current_version_id uuid, -- Circular reference updated later
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 5. Content Versions (Snapshots of content)
CREATE TABLE IF NOT EXISTS content_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid REFERENCES content_requests(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  generated_by text CHECK (generated_by IN ('ai', 'human')),
  title text,
  body text,
  disclaimers text,
  compliance_notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Compliance Reviews
CREATE TABLE IF NOT EXISTS compliance_reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid REFERENCES content_requests(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES profiles(id),
  decision text CHECK (decision IN ('approved', 'changes_requested', 'rejected')),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- 7. Assets (Images/Videos)
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid REFERENCES content_requests(id) ON DELETE CASCADE,
  asset_type text CHECK (asset_type IN ('image', 'video')),
  provider text,
  prompt text,
  url text,
  created_at timestamp with time zone DEFAULT now()
);

-- 8. Social Variants (Derived from approved content)
CREATE TABLE IF NOT EXISTS social_variants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid REFERENCES content_requests(id) ON DELETE CASCADE,
  platform text,
  content text,
  hashtags text,
  created_at timestamp with time zone DEFAULT now()
);

-- 9. Posting Jobs
CREATE TABLE IF NOT EXISTS posting_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid REFERENCES content_requests(id) ON DELETE CASCADE,
  platform text,
  status text CHECK (status IN ('queued', 'sent', 'failed')),
  provider text,
  external_job_id text,
  error text,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS POLICIES

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_jobs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user org_id
CREATE OR REPLACE FUNCTION get_auth_org_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Policies

-- Organizations: Users can view their own org
CREATE POLICY "View own org" ON organizations FOR SELECT
USING (id = get_auth_org_id());

-- Profiles: View profiles in same org
CREATE POLICY "View org profiles" ON profiles FOR SELECT
USING (org_id = get_auth_org_id());

-- Topics: View topics in same org
CREATE POLICY "View org topics" ON topics FOR SELECT
USING (org_id = get_auth_org_id());

-- Content Requests:
-- Advisor: View/Edit own
-- Compliance: View all in org
-- Admin: View all in org

CREATE POLICY "Advisor view own" ON content_requests FOR SELECT
USING (advisor_id = auth.uid());

CREATE POLICY "Advisor update own" ON content_requests FOR UPDATE
USING (advisor_id = auth.uid());

CREATE POLICY "Compliance/Admin view all" ON content_requests FOR SELECT
USING (
  org_id = get_auth_org_id() AND 
  (get_auth_role() IN ('compliance', 'admin'))
);

-- Content Versions: Inherit access from request
-- Simplified: view if you can view the request
CREATE POLICY "View versions of accessible requests" ON content_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM content_requests 
    WHERE content_requests.id = content_versions.request_id 
    AND (
      advisor_id = auth.uid() OR
      (content_requests.org_id = get_auth_org_id() AND get_auth_role() IN ('compliance', 'admin'))
    )
  )
);

-- Compliance Reviews:
-- Everyone can read
-- Only Compliance can insert
CREATE POLICY "View reviews" ON compliance_reviews FOR SELECT
USING (
   EXISTS (
    SELECT 1 FROM content_requests 
    WHERE content_requests.id = compliance_reviews.request_id 
    AND content_requests.org_id = get_auth_org_id()
  )
);

CREATE POLICY "Compliance create review" ON compliance_reviews FOR INSERT
WITH CHECK (
  get_auth_role() = 'compliance'
);

-- Clients: View clients in same org
CREATE POLICY "View org clients" ON clients FOR SELECT
USING (org_id = get_auth_org_id());

CREATE POLICY "Manage org clients" ON clients FOR ALL
USING (org_id = get_auth_org_id());

-- Client Social Accounts: View if you can view the client
CREATE POLICY "View client social accounts" ON client_social_accounts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_social_accounts.client_id
    AND clients.org_id = get_auth_org_id()
  )
);

CREATE POLICY "Manage client social accounts" ON client_social_accounts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_social_accounts.client_id
    AND clients.org_id = get_auth_org_id()
  )
);
