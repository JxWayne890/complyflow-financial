-- ============================================================
-- FIX: Single-Organization Signup
-- All new signups join the SAME organization.
-- ============================================================

-- Step 1: Consolidate all existing profiles into the admin's organization
-- (Replace the org_id below with your admin's full org_id if different)
DO $$
DECLARE
  v_main_org_id uuid;
BEGIN
  -- Find the admin's org (the "real" organization)
  SELECT org_id INTO v_main_org_id
  FROM profiles
  WHERE role = 'admin'
  LIMIT 1;

  IF v_main_org_id IS NULL THEN
    RAISE EXCEPTION 'No admin profile found. Please create one first.';
  END IF;

  -- Move ALL profiles into the admin's org
  UPDATE profiles
  SET org_id = v_main_org_id
  WHERE org_id != v_main_org_id;

  -- Move ALL clients into the admin's org
  UPDATE clients
  SET org_id = v_main_org_id
  WHERE org_id != v_main_org_id;

  -- Move ALL content_requests into the admin's org
  UPDATE content_requests
  SET org_id = v_main_org_id
  WHERE org_id != v_main_org_id;

  -- Move ALL topics into the admin's org
  UPDATE topics
  SET org_id = v_main_org_id
  WHERE org_id != v_main_org_id;

  -- Clean up orphaned organizations (keep only the main one)
  DELETE FROM organizations
  WHERE id != v_main_org_id;

  RAISE NOTICE 'All data consolidated into org: %', v_main_org_id;
END $$;


-- Step 2: Update the signup trigger so ALL new users join the single org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_org_id uuid;
  v_is_client boolean;
  v_role text;
  v_name text;
BEGIN
  -- Check if this is a client invite (handled by Edge Function)
  v_is_client := COALESCE((NEW.raw_user_meta_data->>'is_client')::boolean, false);
  IF v_is_client THEN
    RETURN NEW;
  END IF;

  -- Get the single shared organization
  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;

  -- If no org exists yet (first-ever signup), create one
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name)
    VALUES ('ComplyFlow')
    RETURNING id INTO v_org_id;
  END IF;

  -- Use the role from signup form metadata, default to 'advisor'
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'advisor');

  -- Use full_name from signup form, fallback to email prefix
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Create the profile in the shared organization
  INSERT INTO public.profiles (id, org_id, role, name, email)
  VALUES (
    NEW.id,
    v_org_id,
    v_role,
    v_name,
    NEW.email
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
