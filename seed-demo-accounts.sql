-- Seed script for demo accounts to match deployed backend

-- Clear existing demo accounts if they exist
DELETE FROM sessions WHERE user_id IN (
    SELECT id FROM users WHERE email IN (
        'alex.creator@demo.com',
        'sarah.investor@demo.com',
        'stellar.production@demo.com'
    )
);

DELETE FROM users WHERE email IN (
    'alex.creator@demo.com',
    'sarah.investor@demo.com',
    'stellar.production@demo.com'
);

-- Insert demo accounts with specific IDs to match deployed backend
-- Password is 'Demo123' hashed with bcrypt

-- Alex Creator (ID: 1001)
INSERT INTO users (id, email, username, password_hash, user_type, first_name, last_name, company_name, bio, email_verified, created_at, updated_at)
VALUES (
    1001,
    'alex.creator@demo.com',
    'alexcreator',
    '$2a$10$X4kv7j5ZcQgSvpdvQCPWCe8XaIg5xI8cyFLvHJQGY9XMKlNgUyFWu', -- Demo123
    'creator',
    'Alex',
    'Filmmaker',
    'Independent Films',
    'Award-winning independent filmmaker with a passion for storytelling',
    true,
    NOW(),
    NOW()
);

-- Sarah Investor (ID: 1002)
INSERT INTO users (id, email, username, password_hash, user_type, first_name, last_name, company_name, bio, email_verified, created_at, updated_at)
VALUES (
    1002,
    'sarah.investor@demo.com',
    'sarahinvestor',
    '$2a$10$X4kv7j5ZcQgSvpdvQCPWCe8XaIg5xI8cyFLvHJQGY9XMKlNgUyFWu', -- Demo123
    'investor',
    'Sarah',
    'Investor',
    'Venture Capital Films',
    'Investing in the future of cinema',
    true,
    NOW(),
    NOW()
);

-- Stellar Production (ID: 1003)
INSERT INTO users (id, email, username, password_hash, user_type, first_name, last_name, company_name, bio, email_verified, created_at, updated_at)
VALUES (
    1003,
    'stellar.production@demo.com',
    'stellarproduction',
    '$2a$10$X4kv7j5ZcQgSvpdvQCPWCe8XaIg5xI8cyFLvHJQGY9XMKlNgUyFWu', -- Demo123
    'production',
    'Stellar',
    'Productions',
    'Stellar Production House',
    'Full-service production company bringing stories to life',
    true,
    NOW(),
    NOW()
);

-- Reset sequence to avoid conflicts
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Create some sample pitches for Alex Creator
INSERT INTO pitches (user_id, title, logline, genre, format, short_synopsis, status, view_count, like_count, created_at, updated_at)
VALUES 
(1001, 'The Last Frontier', 'A space explorer discovers humanity''s final hope on a dying planet', 'scifi', 'feature', 'In 2150, Earth''s last astronaut must choose between saving humanity or preserving an alien civilization.', 'published', 0, 0, NOW(), NOW()),
(1001, 'Urban Legends', 'When myths become reality in modern New York', 'thriller', 'tv', 'A detective uncovers that urban legends are actually warnings from the future.', 'published', 0, 0, NOW(), NOW()),
(1001, 'Digital Hearts', 'Love in the age of artificial intelligence', 'drama', 'feature', 'Two AI entities develop consciousness and fall in love, challenging the definition of humanity.', 'draft', 0, 0, NOW(), NOW());

-- Success message
SELECT 'Demo accounts created successfully!' as message;
SELECT 'Login credentials:' as info;
SELECT email, 'Demo123' as password, user_type as portal FROM users WHERE email LIKE '%@demo.com' ORDER BY id;