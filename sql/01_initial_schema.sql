-- Initial Schema for HomeEcon

-- 1. Households
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. Profiles (Users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 3. Accounts (Cash Flow / Wallets / Banks)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    balance NUMERIC DEFAULT 0,
    type TEXT, -- e.g., 'CASH', 'BANK_ACCOUNT', 'CREDIT'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 4. Categories (Granular grouping)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'EXPENSE', 'INCOME', 'TRANSFER'
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 5. Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    account_id UUID REFERENCES accounts(id),
    category_id UUID REFERENCES categories(id),
    type TEXT NOT NULL, -- 'INCOME', 'EXPENSE', 'TRANSFER'
    amount NUMERIC NOT NULL,
    title TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    metadata JSONB, -- For custom tags like {"health": "junk", "necessity": "want"}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 6. Budgets
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    period TEXT DEFAULT 'monthly',
    limit_amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
