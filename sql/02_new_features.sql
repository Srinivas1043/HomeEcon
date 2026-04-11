-- ==========================================
-- 1. DYNAMIC WALLET BALANCES (TRIGGER ENGINE)
-- ==========================================

-- Function to perfectly sync Wallet Account balances upon any transaction change
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.account_id IS NOT NULL THEN
            UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF (TG_OP = 'DELETE') THEN
        IF OLD.account_id IS NOT NULL THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
        END IF;
        RETURN OLD;
    END IF;

    -- Handle UPDATE (account changed, amount changed, or type changed)
    IF (TG_OP = 'UPDATE') THEN
        -- Revert the old transaction effect
        IF OLD.account_id IS NOT NULL THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
        END IF;

        -- Apply the new transaction effect
        IF NEW.account_id IS NOT NULL THEN
            UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Map the Trigger to the Transactions table
DROP TRIGGER IF EXISTS tr_update_account_balance ON transactions;
CREATE TRIGGER tr_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- OPTIONAL BACKFILL: Recompute all existing balances mathematically
WITH aggregated_balances AS (
  SELECT 
    account_id,
    SUM(amount) as net_change
  FROM transactions
  WHERE account_id IS NOT NULL
  GROUP BY account_id
)
UPDATE accounts a
SET balance = COALESCE(ab.net_change, 0)
FROM aggregated_balances ab
WHERE a.id = ab.account_id;


-- ==========================================
-- 2. GROCERY & MEAL PLANNER SCHEMA
-- ==========================================

CREATE TABLE IF NOT EXISTS meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    ingredients JSONB NOT NULL DEFAULT '[]', -- E.g. ["Chicken", "Rice", "Tomato"]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL, -- E.g. "Monday", "Tuesday"
    meal_id UUID REFERENCES meals(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE (household_id, day_of_week, meal_id)
);

-- Enable Security for Groceries
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household Meals" ON meals;
CREATE POLICY "Household Meals" ON meals FOR ALL 
USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Household Meal Plans" ON meal_plans;
CREATE POLICY "Household Meal Plans" ON meal_plans FOR ALL 
USING (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (household_id = (SELECT household_id FROM profiles WHERE id = auth.uid()));

-- Automatically attach household_id to Grocery inserts
DROP TRIGGER IF EXISTS tr_meals_household ON meals;
CREATE TRIGGER tr_meals_household BEFORE INSERT ON meals FOR EACH ROW EXECUTE FUNCTION set_household_id_from_auth();

DROP TRIGGER IF EXISTS tr_meal_plans_household ON meal_plans;
CREATE TRIGGER tr_meal_plans_household BEFORE INSERT ON meal_plans FOR EACH ROW EXECUTE FUNCTION set_household_id_from_auth();
