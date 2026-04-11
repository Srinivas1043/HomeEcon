-- 1. Upgrade Profiles and Households for Invite Codes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Bootstrap missing profiles for old existing user accounts
INSERT INTO profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Create Household records for existing users if missing
INSERT INTO households (id, name)
SELECT id, 'My Household'
FROM profiles 
WHERE household_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Populate existing missing fields: Assign users to their own generated households
UPDATE profiles SET household_id = id WHERE household_id IS NULL;
UPDATE profiles SET invite_code = UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 6)) WHERE invite_code IS NULL;

-- 2. Tie existing transactions to the user's household
UPDATE transactions SET household_id = user_id WHERE household_id IS NULL;
UPDATE accounts SET household_id = (SELECT id FROM profiles LIMIT 1) WHERE household_id IS NULL;

-- 2.5 Auto-fill household_id trigger for seamless frontend inserts
CREATE OR REPLACE FUNCTION set_household_id_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.household_id IS NULL THEN
    NEW.household_id := (SELECT household_id FROM profiles WHERE id = auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_transactions_household ON transactions;
CREATE TRIGGER tr_transactions_household
BEFORE INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION set_household_id_from_auth();

DROP TRIGGER IF EXISTS tr_accounts_household ON accounts;
CREATE TRIGGER tr_accounts_household
BEFORE INSERT ON accounts
FOR EACH ROW EXECUTE FUNCTION set_household_id_from_auth();

-- 3. Enable RLS (The Vault)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create Security Policies (You can only read/write stuff in YOUR household)

-- Profiles Policy: Authenticated users can read profiles to join households
DROP POLICY IF EXISTS "Household Profile Access" ON profiles;
CREATE POLICY "Household Profile Access" ON profiles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow Profile Insert" ON profiles;
CREATE POLICY "Allow Profile Insert" ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow Profile Update" ON profiles;
CREATE POLICY "Allow Profile Update" ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Transactions Policy: Can read/write transactions mapped to your household
DROP POLICY IF EXISTS "Household Transaction Access" ON transactions;
CREATE POLICY "Household Transaction Access" ON transactions
    FOR SELECT
    USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Allow Transaction Write" ON transactions;
CREATE POLICY "Allow Transaction Write" ON transactions
    FOR ALL
    USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- Accounts Policy: Can read/write accounts mapped to your household
DROP POLICY IF EXISTS "Household Account Access" ON accounts;
CREATE POLICY "Household Account Access" ON accounts
    FOR SELECT
    USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Allow Account Write" ON accounts;
CREATE POLICY "Allow Account Write" ON accounts
    FOR ALL
    USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

