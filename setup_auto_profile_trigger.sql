-- Create a function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- 1. Create a default Organization for the user
  INSERT INTO public.organizations (name)
  VALUES (NEW.email || '''s Organization')
  RETURNING id INTO v_org_id;

  -- 2. Create a Profile linked to the new Organization
  INSERT INTO public.profiles (id, org_id, role, name, email)
  VALUES (
    NEW.id,
    v_org_id,
    COALESCE((NEW.raw_user_meta_data->>'role'), 'advisor'), 
    COALESCE((NEW.raw_user_meta_data->>'full_name'), SPLIT_PART(NEW.email, '@', 1)), 
    NEW.email
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
