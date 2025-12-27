/**
 * Direct application of new tables for Creator and Production portals
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = Deno.env.get('DATABASE_URL');

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  Deno.exit(1);
}

const sql = neon(DATABASE_URL);

async function applyNewTables() {
  console.log('🚀 Applying Creator and Production Portal tables...\n');
  
  try {
    // Test connection
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connected:', result[0].current_time);
    
    // Create contracts table
    console.log('\n📋 Creating contracts table...');
    await sql`
      CREATE TABLE IF NOT EXISTS contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('investment', 'production', 'distribution', 'licensing', 'other')),
        status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'negotiation', 'active', 'completed', 'terminated', 'expired')),
        counterparty_name VARCHAR(255) NOT NULL,
        counterparty_type VARCHAR(50) CHECK (counterparty_type IN ('investor', 'production_company', 'distributor', 'platform', 'other')),
        counterparty_id UUID REFERENCES users(id) ON DELETE SET NULL,
        start_date DATE,
        end_date DATE,
        value DECIMAL(12, 2),
        currency VARCHAR(3) DEFAULT 'USD',
        payment_terms TEXT,
        deliverables JSONB,
        milestones JSONB,
        contract_url TEXT,
        signed_date TIMESTAMP,
        signed_by JSONB,
        notes TEXT,
        tags TEXT[],
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ contracts table created');
    
    // Create contract_milestones table
    console.log('📋 Creating contract_milestones table...');
    await sql`
      CREATE TABLE IF NOT EXISTS contract_milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATE NOT NULL,
        completed_date DATE,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
        payment_amount DECIMAL(12, 2),
        payment_status VARCHAR(50) CHECK (payment_status IN ('pending', 'invoiced', 'paid', 'overdue')),
        deliverables JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ contract_milestones table created');
    
    // Create creator_revenue table
    console.log('📋 Creating creator_revenue table...');
    await sql`
      CREATE TABLE IF NOT EXISTS creator_revenue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('investment', 'contract', 'royalty', 'licensing', 'merchandise', 'crowdfunding', 'other')),
        source_id UUID,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        received_date DATE NOT NULL,
        payment_method VARCHAR(50),
        transaction_id VARCHAR(255),
        description TEXT,
        tax_withheld DECIMAL(12, 2),
        net_amount DECIMAL(12, 2),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ creator_revenue table created');
    
    // Create production_companies table
    console.log('📋 Creating production_companies table...');
    await sql`
      CREATE TABLE IF NOT EXISTS production_companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        logo_url TEXT,
        website VARCHAR(255),
        description TEXT,
        specialties TEXT[],
        founded_year INTEGER,
        company_size VARCHAR(50),
        location VARCHAR(255),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        social_links JSONB,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ production_companies table created');
    
    // Create production_projects table
    console.log('📋 Creating production_projects table...');
    await sql`
      CREATE TABLE IF NOT EXISTS production_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES production_companies(id) ON DELETE CASCADE,
        pitch_id UUID REFERENCES pitches(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('feature', 'series', 'documentary', 'short', 'commercial', 'music_video')),
        status VARCHAR(50) NOT NULL DEFAULT 'development' CHECK (status IN ('development', 'pre_production', 'production', 'post_production', 'completed', 'on_hold', 'cancelled')),
        start_date DATE,
        end_date DATE,
        shooting_start_date DATE,
        shooting_end_date DATE,
        release_date DATE,
        budget DECIMAL(12, 2),
        actual_budget DECIMAL(12, 2),
        budget_currency VARCHAR(3) DEFAULT 'USD',
        director VARCHAR(255),
        producer VARCHAR(255),
        cinematographer VARCHAR(255),
        synopsis TEXT,
        shooting_locations TEXT[],
        distribution_plan TEXT,
        target_audience TEXT,
        completion_percentage INTEGER DEFAULT 0,
        quality_score INTEGER,
        on_time BOOLEAN,
        on_budget BOOLEAN,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ production_projects table created');
    
    // Create production_talent table
    console.log('📋 Creating production_talent table...');
    await sql`
      CREATE TABLE IF NOT EXISTS production_talent (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        company_id UUID REFERENCES production_companies(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        stage_name VARCHAR(200),
        talent_type VARCHAR(50) NOT NULL CHECK (talent_type IN ('actor', 'director', 'writer', 'producer', 'cinematographer', 'editor', 'composer', 'other')),
        union_affiliations TEXT[],
        representation VARCHAR(255),
        day_rate DECIMAL(10, 2),
        currency VARCHAR(3) DEFAULT 'USD',
        availability_status VARCHAR(50) DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'on_project', 'unavailable')),
        resume_url TEXT,
        reel_url TEXT,
        portfolio_url TEXT,
        imdb_url TEXT,
        skills TEXT[],
        languages TEXT[],
        accents TEXT[],
        age_range VARCHAR(20),
        height VARCHAR(20),
        location VARCHAR(255),
        willing_to_travel BOOLEAN DEFAULT TRUE,
        rating DECIMAL(3, 2),
        years_experience INTEGER,
        credits_count INTEGER,
        awards JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ production_talent table created');
    
    // Create production_crew table
    console.log('📋 Creating production_crew table...');
    await sql`
      CREATE TABLE IF NOT EXISTS production_crew (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        crew_member_id UUID REFERENCES users(id) ON DELETE CASCADE,
        company_id UUID REFERENCES production_companies(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        department VARCHAR(100) NOT NULL CHECK (department IN ('camera', 'lighting', 'sound', 'art', 'costume', 'makeup', 'production', 'post_production', 'vfx', 'stunts', 'other')),
        position VARCHAR(200) NOT NULL,
        union_member BOOLEAN DEFAULT FALSE,
        union_number VARCHAR(100),
        day_rate DECIMAL(10, 2),
        kit_rental_rate DECIMAL(10, 2),
        currency VARCHAR(3) DEFAULT 'USD',
        availability_status VARCHAR(50) DEFAULT 'available',
        current_project VARCHAR(255),
        available_from DATE,
        years_experience INTEGER,
        specialties TEXT[],
        equipment_owned TEXT[],
        software_proficiency TEXT[],
        email VARCHAR(255),
        phone VARCHAR(50),
        location VARCHAR(255),
        willing_to_travel BOOLEAN DEFAULT TRUE,
        passport_valid BOOLEAN,
        resume_url TEXT,
        portfolio_url TEXT,
        references JSONB,
        rating DECIMAL(3, 2),
        completed_projects INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ production_crew table created');
    
    // Create location_scouts table
    console.log('📋 Creating location_scouts table...');
    await sql`
      CREATE TABLE IF NOT EXISTS location_scouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES production_companies(id) ON DELETE CASCADE,
        scouted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL CHECK (type IN ('studio', 'house', 'office', 'warehouse', 'outdoor', 'historical', 'commercial', 'residential', 'industrial', 'natural', 'other')),
        address TEXT NOT NULL,
        city VARCHAR(100),
        state_province VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        availability_status VARCHAR(50) DEFAULT 'available',
        daily_rate DECIMAL(10, 2),
        weekly_rate DECIMAL(10, 2),
        currency VARCHAR(3) DEFAULT 'USD',
        min_rental_days INTEGER DEFAULT 1,
        square_footage INTEGER,
        parking_spaces INTEGER,
        power_available BOOLEAN DEFAULT TRUE,
        restrooms INTEGER,
        kitchen_available BOOLEAN,
        green_room BOOLEAN,
        wifi_available BOOLEAN,
        noise_restrictions TEXT,
        time_restrictions TEXT,
        permit_required BOOLEAN DEFAULT TRUE,
        insurance_required BOOLEAN DEFAULT TRUE,
        photos JSONB,
        virtual_tour_url TEXT,
        floor_plan_url TEXT,
        owner_name VARCHAR(255),
        owner_phone VARCHAR(50),
        owner_email VARCHAR(255),
        tags TEXT[],
        notes TEXT,
        rating DECIMAL(3, 2),
        times_booked INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ location_scouts table created');
    
    // Create engagement tracking tables
    console.log('\n📊 Creating engagement tracking tables...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS pitch_views (
        pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        viewed_at TIMESTAMP DEFAULT NOW(),
        view_count INTEGER DEFAULT 1,
        watch_duration INTEGER,
        source VARCHAR(50),
        PRIMARY KEY (pitch_id, user_id)
      )
    `;
    console.log('✅ pitch_views table created');
    
    await sql`
      CREATE TABLE IF NOT EXISTS pitch_likes (
        pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (pitch_id, user_id)
      )
    `;
    console.log('✅ pitch_likes table created');
    
    await sql`
      CREATE TABLE IF NOT EXISTS pitch_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ pitch_shares table created');
    
    await sql`
      CREATE TABLE IF NOT EXISTS saved_pitches (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        saved_at TIMESTAMP DEFAULT NOW(),
        notes TEXT,
        PRIMARY KEY (user_id, pitch_id)
      )
    `;
    console.log('✅ saved_pitches table created');
    
    // Add indexes
    console.log('\n🔍 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_contracts_creator_id ON contracts(creator_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_production_projects_company ON production_projects(company_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_production_talent_type ON production_talent(talent_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pitch_views_pitch ON pitch_views(pitch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pitch_likes_pitch ON pitch_likes(pitch_id)`;
    console.log('✅ Indexes created');
    
    // Show summary
    const tableCount = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name IN (
        'contracts', 'contract_milestones', 'creator_revenue',
        'production_companies', 'production_projects', 'production_talent',
        'production_crew', 'location_scouts', 'pitch_views', 
        'pitch_likes', 'pitch_shares', 'saved_pitches'
      )
    `;
    
    console.log('\n✨ Successfully created', tableCount[0].count, 'new tables');
    
    const allTables = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    
    console.log('📊 Total tables in database:', allTables[0].count);
    
  } catch (error) {
    console.error('❌ Failed to apply tables:', error);
    Deno.exit(1);
  }
}

// Run the script
if (import.meta.main) {
  await applyNewTables();
  console.log('\n✅ All Creator and Production Portal tables created successfully!\n');
  Deno.exit(0);
}