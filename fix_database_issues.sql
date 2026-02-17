-- 1. Ensure Client Tables Exist (Idempotent)
-- (In case previous migration wasn't run)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS client_content_shares (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  content_version_id uuid REFERENCES content_versions(id) ON DELETE CASCADE,
  shared_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  UNIQUE(client_id, content_version_id)
);

-- RLS for Shares
ALTER TABLE client_content_shares ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Manage client shares'
    ) THEN
        CREATE POLICY "Manage client shares" ON client_content_shares FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = client_content_shares.client_id
            AND clients.org_id = get_auth_org_id()
          )
        );
    END IF;
END $$;


-- 2. Fix the Auto-Profile Trigger to ignore Clients
-- (Clients are handled by the invite-client Edge Function, not this trigger)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_org_id uuid;
  v_is_client boolean;
BEGIN
  -- Check metadata for 'is_client' flag
  -- We cast to boolean to handle potential nulls gracefully (null::boolean is null, so we coalesce or check)
  v_is_client := COALESCE((NEW.raw_user_meta_data->>'is_client')::boolean, false);

  IF v_is_client THEN
    -- It's a client invite. The Edge Function handles profile creation.
    -- We successfully exit without creating a junk Organization.
    RETURN NEW;
  END IF;

  -- Default Logic for Signups (Admins/Advisors signing up themselves)
  
  -- 1. Create a default Organization
  INSERT INTO public.organizations (name)
  VALUES (NEW.email || '''s Organization')
  RETURNING id INTO v_org_id;

  -- 2. Create a Profile linked to the new Organization
  INSERT INTO public.profiles (id, org_id, role, name, email)
  VALUES (
    NEW.id,
    v_org_id,
    'admin', -- Default role for new signups is admin
    SPLIT_PART(NEW.email, '@', 1),
    NEW.email
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
