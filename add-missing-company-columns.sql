-- Add missing company-related columns to users table

BEGIN;

-- Add missing company columns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'company_website'
    ) THEN
        ALTER TABLE users ADD COLUMN company_website TEXT;
        RAISE NOTICE 'Added company_website column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'company_number'
    ) THEN
        ALTER TABLE users ADD COLUMN company_number VARCHAR(100);
        RAISE NOTICE 'Added company_number column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'company_address'
    ) THEN
        ALTER TABLE users ADD COLUMN company_address TEXT;
        RAISE NOTICE 'Added company_address column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email_verified'
    ) THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added email_verified column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email_verification_token'
    ) THEN
        ALTER TABLE users ADD COLUMN email_verification_token TEXT;
        RAISE NOTICE 'Added email_verification_token column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email_verified_at'
    ) THEN
        ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP;
        RAISE NOTICE 'Added email_verified_at column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'company_verified'
    ) THEN
        ALTER TABLE users ADD COLUMN company_verified BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added company_verified column to users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added is_active column to users table';
    END IF;
END $$;

COMMIT;

SELECT 'Company columns migration completed successfully!' as status;