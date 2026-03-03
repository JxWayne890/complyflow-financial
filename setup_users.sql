-- Allow 'client' role in the profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'advisor', 'compliance', 'client'));

-- Set roles for the three users
UPDATE profiles SET role = 'advisor', name = 'Advisor' WHERE email = '1@1.co';
UPDATE profiles SET role = 'compliance', name = 'Compliance Officer' WHERE email = '1@2.co';
UPDATE profiles SET role = 'client', name = 'Client User' WHERE email = '1@3.co';

-- Make all three users share the same organization (advisor's org)
UPDATE profiles SET org_id = (SELECT org_id FROM profiles WHERE email = '1@1.co') WHERE email IN ('1@2.co', '1@3.co');
