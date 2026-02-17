-- Client Content Shares (The link between content and clients)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS client_content_shares (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  content_version_id uuid REFERENCES content_versions(id) ON DELETE CASCADE,
  shared_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  UNIQUE(client_id, content_version_id)
);

-- RLS
ALTER TABLE client_content_shares ENABLE ROW LEVEL SECURITY;

-- Advisor/Admin/Compliance can manage shares
CREATE POLICY "Manage client shares" ON client_content_shares FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_content_shares.client_id
    AND clients.org_id = get_auth_org_id()
  )
);
