// Rebuild Production Database Script
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'npm:drizzle-orm@0.35.3';

const DATABASE_URL = Deno.env.get('DATABASE_URL');

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  Deno.exit(1);
}

console.log('🔄 Starting production database rebuild...');
console.log('📍 Database:', DATABASE_URL.includes('neon.tech') ? 'Neon Production' : 'Local');

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function rebuildDatabase() {
  try {
    // Step 1: Drop all existing tables
    console.log('\n📦 Dropping all existing tables...');
    const dropTablesQuery = sql`
      DO $$ 
      DECLARE
        r RECORD;
      BEGIN
        -- Drop all tables in public schema
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `;
    await db.execute(dropTablesQuery);
    console.log('✅ All tables dropped');

    // Step 2: Create all tables with proper schema
    console.log('\n🏗️ Creating fresh schema...');
    
    // Users table
    await db.execute(sql`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        "userType" VARCHAR(50),
        role VARCHAR(50),
        bio TEXT,
        "profilePicture" VARCHAR(500),
        "companyName" VARCHAR(255),
        "companyLogo" VARCHAR(500),
        "linkedIn" VARCHAR(500),
        twitter VARCHAR(500),
        website VARCHAR(500),
        phone VARCHAR(50),
        location VARCHAR(255),
        verified BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "lastLogin" TIMESTAMP,
        "emailVerified" BOOLEAN DEFAULT false,
        "twoFactorEnabled" BOOLEAN DEFAULT false
      )
    `);
    console.log('✅ Users table created');

    // Pitches table
    await db.execute(sql`
      CREATE TABLE pitches (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        tagline VARCHAR(500),
        description TEXT,
        "videoUrl" VARCHAR(500),
        "thumbnailUrl" VARCHAR(500),
        genre VARCHAR(100),
        "targetAudience" VARCHAR(255),
        budget DECIMAL(15, 2),
        "fundingGoal" DECIMAL(15, 2),
        "currentFunding" DECIMAL(15, 2) DEFAULT 0,
        "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'draft',
        visibility VARCHAR(50) DEFAULT 'public',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "publishedAt" TIMESTAMP,
        "viewCount" INTEGER DEFAULT 0,
        "likeCount" INTEGER DEFAULT 0,
        "shareCount" INTEGER DEFAULT 0,
        "commentCount" INTEGER DEFAULT 0,
        "pitchDeck" VARCHAR(500),
        "businessPlan" VARCHAR(500),
        script VARCHAR(500),
        duration INTEGER,
        "shootingLocation" VARCHAR(255),
        "startDate" DATE,
        "endDate" DATE,
        "roiProjection" DECIMAL(5, 2),
        "distributionStrategy" TEXT,
        "marketingStrategy" TEXT,
        "cast" TEXT,
        crew TEXT,
        "comparableFilms" TEXT,
        "uniqueSellingPoints" TEXT,
        "creatorId" INTEGER REFERENCES users(id),
        "creatorType" VARCHAR(50),
        "ndaRequired" BOOLEAN DEFAULT false,
        "ndaUrl" VARCHAR(500),
        "ndaCount" INTEGER DEFAULT 0,
        "investmentCount" INTEGER DEFAULT 0,
        "minimumInvestment" DECIMAL(15, 2),
        featured BOOLEAN DEFAULT false,
        trending BOOLEAN DEFAULT false,
        "editorChoice" BOOLEAN DEFAULT false,
        "completionPercentage" INTEGER DEFAULT 0,
        tags TEXT[],
        attachments JSONB,
        metadata JSONB
      )
    `);
    console.log('✅ Pitches table created');

    // Messages table
    await db.execute(sql`
      CREATE TABLE messages (
        id SERIAL PRIMARY KEY,
        "conversationId" INTEGER,
        "senderId" INTEGER REFERENCES users(id),
        "receiverId" INTEGER REFERENCES users(id),
        content TEXT,
        "messageType" VARCHAR(50) DEFAULT 'text',
        attachments JSONB,
        "isRead" BOOLEAN DEFAULT false,
        "isEdited" BOOLEAN DEFAULT false,
        "isDeleted" BOOLEAN DEFAULT false,
        "parentMessageId" INTEGER,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "readAt" TIMESTAMP,
        "deletedAt" TIMESTAMP,
        metadata JSONB
      )
    `);
    console.log('✅ Messages table created');

    // Conversations table
    await db.execute(sql`
      CREATE TABLE conversations (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        "pitchId" INTEGER REFERENCES pitches(id),
        "isGroup" BOOLEAN DEFAULT false,
        "createdById" INTEGER REFERENCES users(id),
        "lastMessageId" INTEGER,
        "lastMessageAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )
    `);
    console.log('✅ Conversations table created');

    // Conversation participants
    await db.execute(sql`
      CREATE TABLE conversation_participants (
        id SERIAL PRIMARY KEY,
        "conversationId" INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "lastReadMessageId" INTEGER,
        "lastReadAt" TIMESTAMP,
        "notificationEnabled" BOOLEAN DEFAULT true,
        role VARCHAR(50) DEFAULT 'member',
        "leftAt" TIMESTAMP,
        UNIQUE("conversationId", "userId")
      )
    `);
    console.log('✅ Conversation participants table created');

    // NDAs table
    await db.execute(sql`
      CREATE TABLE ndas (
        id SERIAL PRIMARY KEY,
        "pitchId" INTEGER REFERENCES pitches(id),
        "signerId" INTEGER REFERENCES users(id),
        "ndaType" VARCHAR(50) DEFAULT 'standard',
        "signedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "ipAddress" VARCHAR(50),
        "userAgent" TEXT,
        "signatureData" JSONB,
        "accessGranted" BOOLEAN DEFAULT true,
        "accessRevokedAt" TIMESTAMP,
        "customNdaUrl" VARCHAR(500),
        metadata JSONB
      )
    `);
    console.log('✅ NDAs table created');

    // NDA Requests table
    await db.execute(sql`
      CREATE TABLE nda_requests (
        id SERIAL PRIMARY KEY,
        "pitchId" INTEGER REFERENCES pitches(id),
        "requesterId" INTEGER REFERENCES users(id),
        "ownerId" INTEGER REFERENCES users(id),
        "ndaType" VARCHAR(50) DEFAULT 'standard',
        status VARCHAR(50) DEFAULT 'pending',
        "requestMessage" TEXT,
        "responseMessage" TEXT,
        "rejectionReason" TEXT,
        "requestedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "respondedAt" TIMESTAMP,
        "companyInfo" JSONB,
        metadata JSONB
      )
    `);
    console.log('✅ NDA Requests table created');

    // Investments table
    await db.execute(sql`
      CREATE TABLE investments (
        id SERIAL PRIMARY KEY,
        "pitchId" INTEGER REFERENCES pitches(id),
        "investorId" INTEGER REFERENCES users(id),
        amount DECIMAL(15, 2) NOT NULL,
        "investmentType" VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        "transactionId" VARCHAR(255),
        "paymentMethod" VARCHAR(100),
        "paymentStatus" VARCHAR(50),
        "investedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "returnOnInvestment" DECIMAL(15, 2),
        notes TEXT,
        documents JSONB,
        terms JSONB,
        metadata JSONB
      )
    `);
    console.log('✅ Investments table created');

    // Notifications table
    await db.execute(sql`
      CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES users(id),
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        "isRead" BOOLEAN DEFAULT false,
        "actionUrl" VARCHAR(500),
        "relatedPitchId" INTEGER REFERENCES pitches(id),
        "relatedUserId" INTEGER REFERENCES users(id),
        "relatedInvestmentId" INTEGER,
        "relatedNdaRequestId" INTEGER,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "readAt" TIMESTAMP,
        metadata JSONB
      )
    `);
    console.log('✅ Notifications table created');

    // Analytics Events table
    await db.execute(sql`
      CREATE TABLE analytics_events (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES users(id),
        "eventType" VARCHAR(100) NOT NULL,
        "eventCategory" VARCHAR(100),
        "eventAction" VARCHAR(255),
        "eventLabel" VARCHAR(255),
        "eventValue" DECIMAL(15, 2),
        "pitchId" INTEGER REFERENCES pitches(id),
        "sessionId" VARCHAR(255),
        "ipAddress" VARCHAR(50),
        "userAgent" TEXT,
        "referrer" TEXT,
        "pageUrl" TEXT,
        metadata JSONB,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Analytics Events table created');

    // Pitch Views table
    await db.execute(sql`
      CREATE TABLE pitch_views (
        id SERIAL PRIMARY KEY,
        "pitchId" INTEGER REFERENCES pitches(id),
        "viewerId" INTEGER REFERENCES users(id),
        "viewerType" VARCHAR(50),
        "viewDuration" INTEGER,
        "viewPercentage" DECIMAL(5, 2),
        "ipAddress" VARCHAR(50),
        "userAgent" TEXT,
        "referrer" TEXT,
        "viewedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )
    `);
    console.log('✅ Pitch Views table created');

    // Follows table
    await db.execute(sql`
      CREATE TABLE follows (
        id SERIAL PRIMARY KEY,
        "followerId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        "followingId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("followerId", "followingId")
      )
    `);
    console.log('✅ Follows table created');

    // Watchlist table
    await db.execute(sql`
      CREATE TABLE watchlist (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        "pitchId" INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        "addedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        "notificationEnabled" BOOLEAN DEFAULT true,
        UNIQUE("userId", "pitchId")
      )
    `);
    console.log('✅ Watchlist table created');

    // Portfolio table
    await db.execute(sql`
      CREATE TABLE portfolio (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        "pitchId" INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        "investmentId" INTEGER REFERENCES investments(id),
        "addedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        metadata JSONB,
        UNIQUE("userId", "pitchId")
      )
    `);
    console.log('✅ Portfolio table created');

    // Comments table
    await db.execute(sql`
      CREATE TABLE comments (
        id SERIAL PRIMARY KEY,
        "pitchId" INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
        "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        "parentId" INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "isEdited" BOOLEAN DEFAULT false,
        "isDeleted" BOOLEAN DEFAULT false,
        likes INTEGER DEFAULT 0,
        metadata JSONB
      )
    `);
    console.log('✅ Comments table created');

    // Payments table
    await db.execute(sql`
      CREATE TABLE payments (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES users(id),
        "pitchId" INTEGER REFERENCES pitches(id),
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        "paymentMethod" VARCHAR(50),
        "paymentStatus" VARCHAR(50) DEFAULT 'pending',
        "transactionId" VARCHAR(255) UNIQUE,
        "stripePaymentIntentId" VARCHAR(255),
        "stripeCustomerId" VARCHAR(255),
        description TEXT,
        metadata JSONB,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "processedAt" TIMESTAMP,
        "failedAt" TIMESTAMP,
        "refundedAt" TIMESTAMP,
        "failureReason" TEXT
      )
    `);
    console.log('✅ Payments table created');

    // Create indexes for performance
    console.log('\n📊 Creating indexes...');
    await db.execute(sql`CREATE INDEX idx_pitches_userid ON pitches("userId")`);
    await db.execute(sql`CREATE INDEX idx_pitches_status ON pitches(status)`);
    await db.execute(sql`CREATE INDEX idx_messages_conversationid ON messages("conversationId")`);
    await db.execute(sql`CREATE INDEX idx_ndas_pitchid ON ndas("pitchId")`);
    await db.execute(sql`CREATE INDEX idx_notifications_userid ON notifications("userId")`);
    console.log('✅ Indexes created');

    console.log('\n✨ Database rebuild complete!');
    
  } catch (error) {
    console.error('❌ Error rebuilding database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the rebuild
await rebuildDatabase();