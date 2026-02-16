-- SETTINGS
-- Replace with the email you want to use for login
-- AND the user ID from Supabase Auth after you sign up
-- OR just run this to create a demo user and organization.

-- 1. Create a Demo Organization (Use a unique name to identify it)
INSERT INTO organizations (name)
SELECT 'Demo Wealth Management'
WHERE NOT EXISTS (
    SELECT 1 FROM organizations WHERE name = 'Demo Wealth Management'
);

-- 2. Get the Org ID
DO $$
DECLARE
    v_org_id UUID;
    v_user_id UUID := 'YOUR_USER_ID_HERE'; -- REPLACE THIS after signing up in Supabase
BEGIN
    SELECT id INTO v_org_id FROM organizations WHERE name = 'Demo Wealth Management';

    -- 3. Create a Profile for your Auth User
    -- You should first sign up in the Supabase Dashboard -> Authentication -> Users
    -- Then copy your User ID and replace 'YOUR_USER_ID_HERE' above.
    
    INSERT INTO profiles (id, org_id, role, name, email)
    VALUES (
        v_user_id,
        v_org_id,
        'advisor',
        'Demo Advisor',
        'advisor@demo.com' -- Replace with your actual email
    )
    ON CONFLICT (id) DO UPDATE
    SET org_id = EXCLUDED.org_id,
        role = EXCLUDED.role,
        name = EXCLUDED.name;

    -- 4. Create a Demo Client
    INSERT INTO clients (org_id, name, company, contact_email, audience_type, status)
    VALUES (
        v_org_id,
        'Sarah Chen',
        'Meridian Wealth',
        'sarah@meridian.com',
        'accredited',
        'active'
    )
    ON CONFLICT DO NOTHING;

END $$;
