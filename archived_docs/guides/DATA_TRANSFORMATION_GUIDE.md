# Data Transformation Guide: From Mock to Production Database

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema Structure](#database-schema-structure)
3. [Data Transformation Process](#data-transformation-process)
4. [Database Seeding Implementation](#database-seeding-implementation)
5. [API Endpoint Implementations](#api-endpoint-implementations)
6. [Frontend Integration](#frontend-integration)
7. [Migration Strategies](#migration-strategies)
8. [Best Practices](#best-practices)
9. [Testing & Validation](#testing--validation)
10. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Architecture Overview

### System Components

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                 │     │                  │     │                  │
│  Frontend       │────▶│  Oak Server      │────▶│  PostgreSQL      │
│  (React/Vite)   │     │  (Deno Runtime)  │     │  (Neon/Supabase) │
│                 │     │                  │     │                  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
        │                       │                         │
        ▼                       ▼                         ▼
   API Client              Services Layer            Drizzle ORM
   - Axios                 - UserService             - Schema
   - Type Safety           - PitchService            - Migrations
   - Caching              - NDAService              - Queries
```

### Data Flow Architecture

1. **Frontend State Management**: Zustand stores manage client-side state
2. **API Communication**: Axios with interceptors for auth and error handling
3. **Backend Services**: Modular service architecture with clear separation of concerns
4. **Database Layer**: Drizzle ORM with PostgreSQL for type-safe queries

---

## Database Schema Structure

### Core Tables and Relationships

```sql
-- User Types Enum
CREATE TYPE user_type AS ENUM ('creator', 'production', 'investor', 'viewer');

-- Main Entities
users (1) ─────< (∞) pitches
     │                 │
     │                 │
     ▼                 ▼
sessions           pitch_views
messages           ndas
follows            transactions
```

### Key Schema Definitions

```typescript
// src/db/schema.ts

// User Schema with Enhanced Security
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  userType: userTypeEnum("user_type").notNull().default("viewer"),
  
  // Profile Information
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  bio: text("bio"),
  profileImage: text("profile_image_url"),
  
  // Company Information (production/investors)
  companyName: text("company_name"),
  companyVerified: boolean("company_verified").default(false),
  
  // Security Features
  emailVerified: boolean("email_verified").default(false),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  
  // Subscription
  subscriptionTier: subscriptionTierEnum("subscription_tier").default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pitch Schema with Rich Media Support
export const pitches = pgTable("pitches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  
  // Core Content
  title: varchar("title", { length: 200 }).notNull(),
  logline: text("logline").notNull(),
  genre: genreEnum("genre").notNull(),
  format: formatEnum("format").notNull(),
  
  // Detailed Content (NDA-protected)
  shortSynopsis: text("short_synopsis"),
  longSynopsis: text("long_synopsis"),
  characters: jsonb("characters").$type<Character[]>(),
  themes: jsonb("themes").$type<string[]>(),
  
  // Production Details
  budgetBracket: varchar("budget_bracket", { length: 50 }),
  estimatedBudget: decimal("estimated_budget", { precision: 12, scale: 2 }),
  productionTimeline: text("production_timeline"),
  
  // Media Assets
  titleImage: text("title_image_url"),
  lookbookUrl: text("lookbook_url"),
  pitchDeckUrl: text("pitch_deck_url"),
  scriptUrl: text("script_url"),
  trailerUrl: text("trailer_url"),
  additionalMedia: jsonb("additional_media").$type<MediaAsset[]>(),
  
  // Visibility & Metrics
  status: pitchStatusEnum("status").default("draft"),
  viewCount: integer("view_count").default(0),
  ndaCount: integer("nda_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## Data Transformation Process

### Step 1: Mock Data Structure Analysis

```typescript
// Example Mock Data Structure
interface MockPitch {
  id: string;
  title: string;
  creator: string;
  description: string;
  genre: string;
  budget: string;
  media?: string[];
}

// Transform to Database Schema
interface DatabasePitch {
  id: number;
  userId: number;
  title: string;
  logline: string;
  genre: Genre;
  format: Format;
  budgetBracket: string;
  estimatedBudget: number;
  additionalMedia: MediaAsset[];
  status: PitchStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

### Step 2: Transformation Functions

```typescript
// src/utils/dataTransformers.ts

import { MockPitch, DatabasePitch } from './types';
import { genreEnum, formatEnum } from '../db/schema';

export class DataTransformer {
  /**
   * Transform mock pitch data to database format
   */
  static transformMockPitch(
    mockData: MockPitch,
    userId: number
  ): Partial<DatabasePitch> {
    return {
      userId,
      title: mockData.title,
      logline: mockData.description || '',
      genre: this.mapGenre(mockData.genre),
      format: this.inferFormat(mockData),
      budgetBracket: this.categorizeBudget(mockData.budget),
      estimatedBudget: this.parseBudget(mockData.budget),
      additionalMedia: this.transformMediaAssets(mockData.media),
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Map mock genres to database enum values
   */
  private static mapGenre(mockGenre: string): typeof genreEnum {
    const genreMap: Record<string, typeof genreEnum> = {
      'drama': 'drama',
      'comedy': 'comedy',
      'action': 'action',
      'sci-fi': 'scifi',
      'science fiction': 'scifi',
      'horror': 'horror',
      'thriller': 'thriller',
      'documentary': 'documentary',
      'animation': 'animation',
      'fantasy': 'fantasy',
      'romance': 'romance',
    };
    
    return genreMap[mockGenre.toLowerCase()] || 'other';
  }

  /**
   * Infer format from mock data
   */
  private static inferFormat(mockData: MockPitch): typeof formatEnum {
    const title = mockData.title.toLowerCase();
    
    if (title.includes('series') || title.includes('season')) {
      return 'tv';
    }
    if (title.includes('short')) {
      return 'short';
    }
    if (title.includes('web')) {
      return 'webseries';
    }
    
    return 'feature';
  }

  /**
   * Parse budget string to numeric value
   */
  private static parseBudget(budgetString: string): number {
    // Remove currency symbols and commas
    const cleanBudget = budgetString.replace(/[$,€£¥]/g, '');
    
    // Handle ranges (e.g., "1M-5M")
    if (cleanBudget.includes('-')) {
      const [min, max] = cleanBudget.split('-');
      return (this.parseAmount(min) + this.parseAmount(max)) / 2;
    }
    
    return this.parseAmount(cleanBudget);
  }

  /**
   * Parse amount with K, M, B suffixes
   */
  private static parseAmount(amount: string): number {
    const multipliers: Record<string, number> = {
      'K': 1000,
      'M': 1000000,
      'B': 1000000000,
    };
    
    const match = amount.match(/(\d+\.?\d*)([KMB])?/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase();
    
    return suffix ? value * multipliers[suffix] : value;
  }

  /**
   * Categorize budget into brackets
   */
  private static categorizeBudget(budget: string): string {
    const amount = this.parseBudget(budget);
    
    if (amount < 100000) return 'micro';
    if (amount < 1000000) return 'low';
    if (amount < 10000000) return 'medium';
    if (amount < 50000000) return 'high';
    return 'blockbuster';
  }

  /**
   * Transform media array to structured format
   */
  private static transformMediaAssets(
    media?: string[]
  ): MediaAsset[] {
    if (!media) return [];
    
    return media.map((url, index) => ({
      type: this.inferMediaType(url),
      url,
      title: `Media Asset ${index + 1}`,
      uploadedAt: new Date().toISOString(),
    }));
  }

  /**
   * Infer media type from URL or filename
   */
  private static inferMediaType(url: string): MediaAssetType {
    const lower = url.toLowerCase();
    
    if (lower.includes('lookbook')) return 'lookbook';
    if (lower.includes('script') || lower.endsWith('.pdf')) return 'script';
    if (lower.includes('trailer') || lower.endsWith('.mp4')) return 'trailer';
    if (lower.includes('pitch') || lower.includes('deck')) return 'pitch_deck';
    if (lower.includes('budget')) return 'budget_breakdown';
    
    return 'other';
  }
}
```

---

## Database Seeding Implementation

### Comprehensive Seed Script

```typescript
// src/db/seed.ts

import { db } from './database';
import { users, pitches, ndas, messages, follows } from './schema';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';
import { DataTransformer } from '../utils/dataTransformers';

interface SeedOptions {
  userCount: number;
  pitchesPerUser: number;
  ndasPerPitch: number;
  messagesPerPitch: number;
  followRelations: number;
}

export class DatabaseSeeder {
  private options: SeedOptions;
  private createdUsers: any[] = [];
  private createdPitches: any[] = [];

  constructor(options: Partial<SeedOptions> = {}) {
    this.options = {
      userCount: 50,
      pitchesPerUser: 3,
      ndasPerPitch: 5,
      messagesPerPitch: 10,
      followRelations: 100,
      ...options
    };
  }

  /**
   * Main seed function
   */
  async seed() {
    console.log('🌱 Starting database seed...');
    
    try {
      // Clean existing data (optional)
      if (process.env.CLEAN_SEED === 'true') {
        await this.cleanDatabase();
      }

      // Seed in order of dependencies
      await this.seedUsers();
      await this.seedPitches();
      await this.seedNDAs();
      await this.seedMessages();
      await this.seedFollows();
      await this.seedAnalytics();
      
      console.log('✅ Database seeding completed successfully!');
      return {
        users: this.createdUsers.length,
        pitches: this.createdPitches.length,
      };
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      throw error;
    }
  }

  /**
   * Clean database tables
   */
  private async cleanDatabase() {
    console.log('🧹 Cleaning database...');
    
    // Delete in reverse order of foreign key dependencies
    await db.delete(messages);
    await db.delete(follows);
    await db.delete(ndas);
    await db.delete(pitches);
    await db.delete(users);
    
    // Reset sequences
    await db.execute(sql`
      ALTER SEQUENCE users_id_seq RESTART WITH 1;
      ALTER SEQUENCE pitches_id_seq RESTART WITH 1;
      ALTER SEQUENCE ndas_id_seq RESTART WITH 1;
      ALTER SEQUENCE messages_id_seq RESTART WITH 1;
      ALTER SEQUENCE follows_id_seq RESTART WITH 1;
    `);
  }

  /**
   * Seed users with diverse profiles
   */
  private async seedUsers() {
    console.log('👥 Seeding users...');
    
    const userTypes = ['creator', 'production', 'investor', 'viewer'];
    const subscriptionTiers = ['free', 'creator', 'pro', 'investor'];
    
    for (let i = 0; i < this.options.userCount; i++) {
      const userType = faker.helpers.arrayElement(userTypes);
      const isCompanyType = ['production', 'investor'].includes(userType);
      
      const user = await db.insert(users).values({
        email: faker.internet.email(),
        username: faker.internet.username(),
        passwordHash: await bcrypt.hash('Demo123!', 10),
        userType,
        
        // Profile
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        bio: faker.lorem.paragraph(),
        profileImage: faker.image.avatar(),
        location: `${faker.location.city()}, ${faker.location.country()}`,
        phone: faker.phone.number(),
        
        // Company info for production/investors
        ...(isCompanyType && {
          companyName: faker.company.name(),
          companyNumber: faker.string.alphanumeric(10).toUpperCase(),
          companyWebsite: faker.internet.url(),
          companyAddress: faker.location.streetAddress(true),
          companyVerified: faker.datatype.boolean(0.7),
        }),
        
        // Subscription
        subscriptionTier: faker.helpers.arrayElement(subscriptionTiers),
        emailVerified: faker.datatype.boolean(0.8),
        
        // Activity timestamps
        createdAt: faker.date.past({ years: 2 }),
        lastLoginAt: faker.date.recent({ days: 30 }),
      }).returning();
      
      this.createdUsers.push(user[0]);
    }
    
    // Create specific demo accounts
    await this.createDemoAccounts();
    
    console.log(`✅ Created ${this.createdUsers.length} users`);
  }

  /**
   * Create demo accounts for testing
   */
  private async createDemoAccounts() {
    const demoAccounts = [
      {
        email: 'alex.creator@demo.com',
        username: 'alexcreator',
        userType: 'creator',
        firstName: 'Alex',
        lastName: 'Creative',
        companyName: 'Independent Films',
        bio: 'Award-winning independent filmmaker with 10+ years experience',
        subscriptionTier: 'pro',
      },
      {
        email: 'sarah.investor@demo.com',
        username: 'sarahinvestor',
        userType: 'investor',
        firstName: 'Sarah',
        lastName: 'Investor',
        companyName: 'Venture Capital Films',
        bio: 'Film investment specialist focused on emerging talent',
        subscriptionTier: 'investor',
      },
      {
        email: 'stellar.production@demo.com',
        username: 'stellarprod',
        userType: 'production',
        firstName: 'John',
        lastName: 'Producer',
        companyName: 'Stellar Productions',
        bio: 'Major production house with 50+ feature films',
        subscriptionTier: 'pro',
      },
    ];
    
    for (const account of demoAccounts) {
      const user = await db.insert(users).values({
        ...account,
        passwordHash: await bcrypt.hash('Demo123!', 10),
        emailVerified: true,
        companyVerified: true,
        profileImage: faker.image.avatar(),
      }).returning();
      
      this.createdUsers.push(user[0]);
    }
  }

  /**
   * Seed pitches with rich content
   */
  private async seedPitches() {
    console.log('🎬 Seeding pitches...');
    
    const creators = this.createdUsers.filter(u => 
      ['creator', 'production'].includes(u.userType)
    );
    
    for (const creator of creators) {
      const pitchCount = faker.number.int({ 
        min: 1, 
        max: this.options.pitchesPerUser 
      });
      
      for (let i = 0; i < pitchCount; i++) {
        const pitch = await this.createRealisticPitch(creator.id);
        this.createdPitches.push(pitch);
      }
    }
    
    console.log(`✅ Created ${this.createdPitches.length} pitches`);
  }

  /**
   * Create a realistic pitch with full content
   */
  private async createRealisticPitch(userId: number) {
    const genres = ['drama', 'comedy', 'thriller', 'horror', 'scifi', 
                   'fantasy', 'documentary', 'animation', 'action', 'romance'];
    const formats = ['feature', 'tv', 'short', 'webseries'];
    
    const genre = faker.helpers.arrayElement(genres);
    const format = faker.helpers.arrayElement(formats);
    
    // Generate characters
    const characterCount = faker.number.int({ min: 3, max: 8 });
    const characters = Array.from({ length: characterCount }, () => ({
      name: faker.person.fullName(),
      description: faker.lorem.paragraph(),
      age: faker.number.int({ min: 18, max: 70 }).toString(),
      gender: faker.helpers.arrayElement(['male', 'female', 'non-binary']),
      actor: faker.datatype.boolean(0.3) ? faker.person.fullName() : undefined,
    }));
    
    // Generate themes
    const themes = faker.helpers.arrayElements([
      'redemption', 'love', 'betrayal', 'family', 'identity',
      'power', 'corruption', 'survival', 'justice', 'freedom',
      'sacrifice', 'ambition', 'friendship', 'revenge', 'hope'
    ], { min: 2, max: 5 });
    
    // Episode breakdown for TV/Webseries
    const episodeBreakdown = format === 'tv' || format === 'webseries'
      ? Array.from({ length: faker.number.int({ min: 6, max: 10 }) }, (_, i) => ({
          episodeNumber: i + 1,
          title: faker.lorem.sentence(3),
          synopsis: faker.lorem.paragraph(),
        }))
      : undefined;
    
    // Media assets
    const additionalMedia = faker.helpers.arrayElements([
      { 
        type: 'lookbook', 
        url: `https://storage.example.com/lookbook-${faker.string.uuid()}.pdf`,
        title: 'Visual Lookbook',
        description: 'Complete visual reference guide',
        uploadedAt: faker.date.recent().toISOString(),
      },
      {
        type: 'script',
        url: `https://storage.example.com/script-${faker.string.uuid()}.pdf`,
        title: format === 'feature' ? 'Full Screenplay' : 'Pilot Script',
        description: `${faker.number.int({ min: 90, max: 120 })} pages`,
        uploadedAt: faker.date.recent().toISOString(),
      },
      {
        type: 'pitch_deck',
        url: `https://storage.example.com/deck-${faker.string.uuid()}.pdf`,
        title: 'Investor Pitch Deck',
        description: '20-slide presentation',
        uploadedAt: faker.date.recent().toISOString(),
      },
      {
        type: 'trailer',
        url: `https://vimeo.com/${faker.number.int({ min: 100000000, max: 999999999 })}`,
        title: 'Concept Trailer',
        description: '2-minute proof of concept',
        uploadedAt: faker.date.recent().toISOString(),
      },
    ], { min: 1, max: 4 });
    
    const budgetAmount = this.generateRealisticBudget(format);
    
    const pitch = await db.insert(pitches).values({
      userId,
      title: this.generateTitle(genre, format),
      logline: this.generateLogline(genre),
      genre,
      format,
      
      // Content
      shortSynopsis: faker.lorem.paragraphs(2),
      longSynopsis: faker.lorem.paragraphs(5),
      opener: faker.lorem.paragraph(),
      premise: faker.lorem.paragraphs(2),
      targetAudience: this.generateTargetAudience(genre, format),
      
      // Structured data
      characters,
      themes,
      episodeBreakdown,
      
      // Budget
      budgetBracket: this.getBudgetBracket(budgetAmount),
      estimatedBudget: budgetAmount.toString(),
      productionTimeline: this.generateProductionTimeline(format),
      
      // Media
      titleImage: faker.image.urlPicsumPhotos({ width: 1920, height: 1080 }),
      lookbookUrl: faker.datatype.boolean(0.6) ? additionalMedia[0]?.url : null,
      scriptUrl: faker.datatype.boolean(0.7) ? additionalMedia[1]?.url : null,
      pitchDeckUrl: faker.datatype.boolean(0.5) ? additionalMedia[2]?.url : null,
      trailerUrl: faker.datatype.boolean(0.3) ? additionalMedia[3]?.url : null,
      additionalMedia,
      
      // Visibility settings
      visibilitySettings: {
        showShortSynopsis: true,
        showCharacters: faker.datatype.boolean(0.6),
        showBudget: faker.datatype.boolean(0.4),
        showMedia: faker.datatype.boolean(0.7),
      },
      
      // Status and metrics
      status: faker.helpers.weightedArrayElement([
        { weight: 1, value: 'draft' },
        { weight: 3, value: 'published' },
        { weight: 0.5, value: 'archived' },
      ]),
      publishedAt: faker.datatype.boolean(0.7) ? faker.date.past() : null,
      viewCount: faker.number.int({ min: 0, max: 10000 }),
      likeCount: faker.number.int({ min: 0, max: 500 }),
      ndaCount: faker.number.int({ min: 0, max: 50 }),
      aiUsed: faker.datatype.boolean(0.2),
      
      createdAt: faker.date.past({ years: 1 }),
      updatedAt: faker.date.recent({ days: 30 }),
    }).returning();
    
    return pitch[0];
  }

  /**
   * Generate realistic title based on genre and format
   */
  private generateTitle(genre: string, format: string): string {
    const titleTemplates = {
      drama: ['The Last {{noun}}', '{{adjective}} {{noun}}', 'Letters from {{place}}'],
      comedy: ['{{adjective}} {{occupation}}', 'The {{noun}} Club', 'My {{relation}} the {{occupation}}'],
      thriller: ['{{time}} Hours', 'The {{adjective}} {{noun}}', 'Code {{color}}'],
      horror: ['The {{adjective}} {{place}}', '{{number}} Days of {{noun}}', 'Night of the {{creature}}'],
      scifi: ['{{planet}} Rising', 'The {{adjective}} Protocol', 'Beyond {{place}}'],
      fantasy: ['The {{noun}} of {{place}}', '{{creature}} Kingdom', 'Chronicles of {{name}}'],
      action: ['{{occupation}}: {{adjective}} {{noun}}', 'Operation {{color}}', 'The {{number}}'],
      documentary: ['The {{noun}} Truth', 'Inside {{company}}', 'The {{adjective}} Story'],
      animation: ['{{adjective}} {{animal}}', 'The {{noun}} Adventure', '{{place}} Tales'],
      romance: ['{{season}} in {{city}}', 'The {{adjective}} Letter', 'Love and {{noun}}'],
    };
    
    const template = faker.helpers.arrayElement(titleTemplates[genre] || titleTemplates.drama);
    
    return template
      .replace('{{noun}}', faker.word.noun())
      .replace('{{adjective}}', faker.word.adjective())
      .replace('{{place}}', faker.location.city())
      .replace('{{occupation}}', faker.person.jobTitle())
      .replace('{{relation}}', faker.helpers.arrayElement(['Father', 'Mother', 'Brother', 'Sister']))
      .replace('{{time}}', faker.number.int({ min: 12, max: 72 }).toString())
      .replace('{{color}}', faker.color.human())
      .replace('{{number}}', faker.number.int({ min: 1, max: 13 }).toString())
      .replace('{{planet}}', faker.helpers.arrayElement(['Mars', 'Venus', 'Saturn', 'Neptune']))
      .replace('{{creature}}', faker.animal.type())
      .replace('{{name}}', faker.person.firstName())
      .replace('{{company}}', faker.company.name())
      .replace('{{animal}}', faker.animal.dog())
      .replace('{{season}}', faker.helpers.arrayElement(['Spring', 'Summer', 'Autumn', 'Winter']))
      .replace('{{city}}', faker.location.city());
  }

  /**
   * Generate compelling logline
   */
  private generateLogline(genre: string): string {
    const templates = [
      'When {{event}}, a {{protagonist}} must {{goal}} before {{stakes}}.',
      'A {{protagonist}} discovers {{discovery}} and must {{challenge}} to {{outcome}}.',
      'In a world where {{worldbuilding}}, a {{protagonist}} fights to {{goal}}.',
      'After {{inciting}}, a {{protagonist}} embarks on a journey to {{quest}}.',
      'A {{protagonist}} struggles with {{internal}} while trying to {{external}}.',
    ];
    
    const template = faker.helpers.arrayElement(templates);
    
    return template
      .replace('{{event}}', faker.lorem.words(3))
      .replace('{{protagonist}}', faker.helpers.arrayElement([
        'struggling artist', 'detective', 'single parent', 'war veteran',
        'young entrepreneur', 'retired teacher', 'ambitious lawyer',
      ]))
      .replace('{{goal}}', faker.lorem.words(4))
      .replace('{{stakes}}', faker.lorem.words(3))
      .replace('{{discovery}}', faker.lorem.words(3))
      .replace('{{challenge}}', faker.lorem.words(4))
      .replace('{{outcome}}', faker.lorem.words(3))
      .replace('{{worldbuilding}}', faker.lorem.words(5))
      .replace('{{inciting}}', faker.lorem.words(4))
      .replace('{{quest}}', faker.lorem.words(3))
      .replace('{{internal}}', faker.lorem.words(2))
      .replace('{{external}}', faker.lorem.words(3));
  }

  /**
   * Generate realistic budget based on format
   */
  private generateRealisticBudget(format: string): number {
    const budgetRanges = {
      feature: { min: 500000, max: 100000000 },
      tv: { min: 1000000, max: 10000000 }, // per episode
      short: { min: 5000, max: 100000 },
      webseries: { min: 50000, max: 1000000 }, // per season
    };
    
    const range = budgetRanges[format] || budgetRanges.feature;
    return faker.number.int(range);
  }

  /**
   * Categorize budget into brackets
   */
  private getBudgetBracket(amount: number): string {
    if (amount < 100000) return 'micro';
    if (amount < 1000000) return 'low';
    if (amount < 10000000) return 'medium';
    if (amount < 50000000) return 'high';
    return 'blockbuster';
  }

  /**
   * Generate target audience description
   */
  private generateTargetAudience(genre: string, format: string): string {
    const ageRanges = ['13-17', '18-24', '25-34', '35-49', '50+'];
    const primaryAge = faker.helpers.arrayElement(ageRanges);
    
    const demographics = faker.helpers.arrayElements([
      'urban professionals',
      'families',
      'young adults',
      'cinephiles',
      'genre enthusiasts',
      'streaming subscribers',
      'arthouse audience',
    ], { min: 1, max: 3 });
    
    return `Primary: Ages ${primaryAge}, ${demographics.join(', ')}. ${faker.lorem.sentence()}`;
  }

  /**
   * Generate production timeline
   */
  private generateProductionTimeline(format: string): string {
    const phases = {
      feature: [
        { phase: 'Pre-production', duration: '3-6 months' },
        { phase: 'Principal Photography', duration: '2-3 months' },
        { phase: 'Post-production', duration: '6-9 months' },
        { phase: 'Distribution', duration: '3-6 months' },
      ],
      tv: [
        { phase: 'Development', duration: '2-4 months' },
        { phase: 'Pilot Production', duration: '1-2 months' },
        { phase: 'Season Production', duration: '6-8 months' },
        { phase: 'Post-production', duration: '3-4 months' },
      ],
      short: [
        { phase: 'Pre-production', duration: '1-2 months' },
        { phase: 'Production', duration: '1-2 weeks' },
        { phase: 'Post-production', duration: '2-3 months' },
      ],
      webseries: [
        { phase: 'Development', duration: '1-2 months' },
        { phase: 'Production', duration: '3-4 months' },
        { phase: 'Post-production', duration: '2-3 months' },
        { phase: 'Release Strategy', duration: '1 month' },
      ],
    };
    
    const timeline = phases[format] || phases.feature;
    return timeline.map(p => `${p.phase}: ${p.duration}`).join('\n');
  }

  /**
   * Seed NDA agreements
   */
  private async seedNDAs() {
    console.log('📜 Seeding NDAs...');
    
    const investors = this.createdUsers.filter(u => u.userType === 'investor');
    const publishedPitches = this.createdPitches.filter(p => p.status === 'published');
    
    let ndaCount = 0;
    
    for (const pitch of publishedPitches) {
      const ndaSigners = faker.helpers.arrayElements(
        investors,
        { min: 0, max: Math.min(this.options.ndasPerPitch, investors.length) }
      );
      
      for (const signer of ndaSigners) {
        await db.insert(ndas).values({
          pitchId: pitch.id,
          signerId: signer.id,
          ndaType: faker.helpers.arrayElement(['basic', 'enhanced', 'custom']),
          ndaVersion: '1.0',
          ipAddress: faker.internet.ipv4(),
          userAgent: faker.internet.userAgent(),
          signedAt: faker.date.recent({ days: 30 }),
          signatureData: {
            signedName: `${signer.firstName} ${signer.lastName}`,
            signedCompany: signer.companyName,
            timestamp: faker.date.recent().toISOString(),
          },
          accessGranted: faker.datatype.boolean(0.95),
          expiresAt: faker.date.future({ years: 1 }),
        });
        
        ndaCount++;
      }
    }
    
    console.log(`✅ Created ${ndaCount} NDA agreements`);
  }

  /**
   * Seed messages between users
   */
  private async seedMessages() {
    console.log('💬 Seeding messages...');
    
    let messageCount = 0;
    const publishedPitches = this.createdPitches.filter(p => p.status === 'published');
    
    for (const pitch of publishedPitches) {
      const messageLimit = faker.number.int({ 
        min: 0, 
        max: this.options.messagesPerPitch 
      });
      
      for (let i = 0; i < messageLimit; i++) {
        const sender = faker.helpers.arrayElement(this.createdUsers);
        const receiver = this.createdUsers.find(u => u.id === pitch.userId);
        
        if (sender.id !== receiver.id) {
          await db.insert(messages).values({
            pitchId: pitch.id,
            senderId: sender.id,
            receiverId: receiver.id,
            subject: faker.lorem.sentence(),
            content: faker.lorem.paragraphs({ min: 1, max: 3 }),
            isRead: faker.datatype.boolean(0.7),
            offPlatformRequested: faker.datatype.boolean(0.1),
            offPlatformApproved: faker.datatype.boolean(0.05),
            sentAt: faker.date.recent({ days: 14 }),
            readAt: faker.datatype.boolean(0.7) ? faker.date.recent({ days: 7 }) : null,
          });
          
          messageCount++;
        }
      }
    }
    
    console.log(`✅ Created ${messageCount} messages`);
  }

  /**
   * Seed follow relationships
   */
  private async seedFollows() {
    console.log('👥 Seeding follow relationships...');
    
    let followCount = 0;
    
    // User following creators
    for (let i = 0; i < this.options.followRelations / 2; i++) {
      const follower = faker.helpers.arrayElement(this.createdUsers);
      const creator = faker.helpers.arrayElement(
        this.createdUsers.filter(u => ['creator', 'production'].includes(u.userType))
      );
      
      if (follower.id !== creator.id) {
        try {
          await db.insert(follows).values({
            followerId: follower.id,
            creatorId: creator.id,
            followedAt: faker.date.recent({ days: 60 }),
          });
          followCount++;
        } catch (e) {
          // Handle duplicate constraint violations
        }
      }
    }
    
    // User following pitches
    for (let i = 0; i < this.options.followRelations / 2; i++) {
      const follower = faker.helpers.arrayElement(this.createdUsers);
      const pitch = faker.helpers.arrayElement(this.createdPitches);
      
      try {
        await db.insert(follows).values({
          followerId: follower.id,
          pitchId: pitch.id,
          followedAt: faker.date.recent({ days: 60 }),
        });
        followCount++;
      } catch (e) {
        // Handle duplicate constraint violations
      }
    }
    
    console.log(`✅ Created ${followCount} follow relationships`);
  }

  /**
   * Seed analytics data
   */
  private async seedAnalytics() {
    console.log('📊 Seeding analytics data...');
    
    for (const pitch of this.createdPitches) {
      const viewCount = faker.number.int({ min: 10, max: 1000 });
      
      for (let i = 0; i < viewCount; i++) {
        const viewer = faker.helpers.arrayElement(this.createdUsers);
        
        await db.insert(pitchViews).values({
          pitchId: pitch.id,
          viewerId: viewer.id,
          viewType: faker.helpers.arrayElement(['browse', 'detail', 'media']),
          ipAddress: faker.internet.ipv4(),
          userAgent: faker.internet.userAgent(),
          referrer: faker.helpers.arrayElement([
            'https://google.com',
            'https://facebook.com',
            'https://twitter.com',
            'direct',
            null,
          ]),
          sessionId: faker.string.uuid(),
          viewDuration: faker.number.int({ min: 5, max: 600 }),
          scrollDepth: faker.number.int({ min: 10, max: 100 }),
          clickedWatchThis: faker.datatype.boolean(0.15),
          viewedAt: faker.date.recent({ days: 30 }),
        });
      }
    }
    
    console.log('✅ Analytics data seeded');
  }
}

// Execute seeding
if (import.meta.main) {
  const seeder = new DatabaseSeeder({
    userCount: parseInt(Deno.env.get('SEED_USER_COUNT') || '50'),
    pitchesPerUser: parseInt(Deno.env.get('SEED_PITCHES_PER_USER') || '3'),
    ndasPerPitch: parseInt(Deno.env.get('SEED_NDAS_PER_PITCH') || '5'),
    messagesPerPitch: parseInt(Deno.env.get('SEED_MESSAGES_PER_PITCH') || '10'),
    followRelations: parseInt(Deno.env.get('SEED_FOLLOW_RELATIONS') || '100'),
  });
  
  await seeder.seed();
}
```

### Running the Seed Script

```bash
# Development environment
deno run --allow-env --allow-net --allow-read src/db/seed.ts

# With environment variables
SEED_USER_COUNT=100 SEED_PITCHES_PER_USER=5 deno run --allow-all src/db/seed.ts

# Clean seed (removes existing data first)
CLEAN_SEED=true deno run --allow-all src/db/seed.ts
```

---

## API Endpoint Implementations

### Pitch Service with Database Integration

```typescript
// src/services/pitch.service.ts

import { db } from '../db/database';
import { pitches, users, ndas, pitchViews } from '../db/schema';
import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import type { NewPitch, Pitch, PitchFilter } from '../types';

export class PitchService {
  /**
   * Create a new pitch
   */
  static async createPitch(data: NewPitch, userId: number): Promise<Pitch> {
    const [pitch] = await db.insert(pitches)
      .values({
        ...data,
        userId,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    // Track creation event
    await AnalyticsService.trackEvent({
      eventType: 'pitch_created',
      userId,
      pitchId: pitch.id,
      metadata: { format: pitch.format, genre: pitch.genre },
    });
    
    return pitch;
  }

  /**
   * Get pitch by ID with related data
   */
  static async getPitchById(
    pitchId: number,
    viewerId?: number
  ): Promise<Pitch | null> {
    // Check NDA status if viewer is provided
    let hasNDAAccess = false;
    if (viewerId) {
      const nda = await db.select()
        .from(ndas)
        .where(
          and(
            eq(ndas.pitchId, pitchId),
            eq(ndas.signerId, viewerId),
            eq(ndas.accessGranted, true)
          )
        )
        .limit(1);
      
      hasNDAAccess = nda.length > 0;
    }
    
    // Fetch pitch with creator info
    const result = await db
      .select({
        pitch: pitches,
        creator: {
          id: users.id,
          username: users.username,
          userType: users.userType,
          companyName: users.companyName,
          profileImage: users.profileImage,
        },
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
      .where(eq(pitches.id, pitchId))
      .limit(1);
    
    if (result.length === 0) return null;
    
    const { pitch, creator } = result[0];
    
    // Track view
    if (viewerId) {
      await this.trackPitchView(pitchId, viewerId);
    }
    
    // Apply visibility settings based on NDA status
    if (!hasNDAAccess && !this.isOwner(pitch.userId, viewerId)) {
      return this.applyVisibilityRestrictions(pitch, creator);
    }
    
    return { ...pitch, creator };
  }

  /**
   * Search and filter pitches
   */
  static async searchPitches(
    filters: PitchFilter,
    page = 1,
    limit = 20
  ): Promise<{ pitches: Pitch[]; total: number }> {
    const offset = (page - 1) * limit;
    
    // Build where conditions
    const conditions = [];
    
    if (filters.search) {
      conditions.push(
        or(
          like(pitches.title, `%${filters.search}%`),
          like(pitches.logline, `%${filters.search}%`),
          like(pitches.shortSynopsis, `%${filters.search}%`)
        )
      );
    }
    
    if (filters.genre) {
      conditions.push(eq(pitches.genre, filters.genre));
    }
    
    if (filters.format) {
      conditions.push(eq(pitches.format, filters.format));
    }
    
    if (filters.budgetMin || filters.budgetMax) {
      if (filters.budgetMin) {
        conditions.push(sql`${pitches.estimatedBudget} >= ${filters.budgetMin}`);
      }
      if (filters.budgetMax) {
        conditions.push(sql`${pitches.estimatedBudget} <= ${filters.budgetMax}`);
      }
    }
    
    // Only show published pitches in search
    conditions.push(eq(pitches.status, 'published'));
    
    // Execute query with pagination
    const [results, countResult] = await Promise.all([
      db.select({
        pitch: pitches,
        creator: {
          id: users.id,
          username: users.username,
          userType: users.userType,
          companyName: users.companyName,
        },
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        filters.sortBy === 'views' ? desc(pitches.viewCount) :
        filters.sortBy === 'likes' ? desc(pitches.likeCount) :
        filters.sortBy === 'recent' ? desc(pitches.createdAt) :
        desc(pitches.publishedAt)
      )
      .limit(limit)
      .offset(offset),
      
      db.select({ count: sql`count(*)` })
        .from(pitches)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);
    
    return {
      pitches: results.map(r => ({ ...r.pitch, creator: r.creator })),
      total: Number(countResult[0].count),
    };
  }

  /**
   * Update pitch
   */
  static async updatePitch(
    pitchId: number,
    userId: number,
    updates: Partial<Pitch>
  ): Promise<Pitch> {
    // Verify ownership
    const pitch = await db.select()
      .from(pitches)
      .where(and(eq(pitches.id, pitchId), eq(pitches.userId, userId)))
      .limit(1);
    
    if (pitch.length === 0) {
      throw new Error('Pitch not found or unauthorized');
    }
    
    // Perform update
    const [updated] = await db.update(pitches)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(pitches.id, pitchId))
      .returning();
    
    return updated;
  }

  /**
   * Publish a pitch
   */
  static async publishPitch(
    pitchId: number,
    userId: number
  ): Promise<Pitch> {
    return this.updatePitch(pitchId, userId, {
      status: 'published',
      publishedAt: new Date(),
    });
  }

  /**
   * Delete pitch (soft delete by archiving)
   */
  static async deletePitch(
    pitchId: number,
    userId: number
  ): Promise<void> {
    await this.updatePitch(pitchId, userId, {
      status: 'archived',
    });
  }

  /**
   * Get user's pitches
   */
  static async getUserPitches(
    userId: number,
    includeArchived = false
  ): Promise<Pitch[]> {
    const conditions = [eq(pitches.userId, userId)];
    
    if (!includeArchived) {
      conditions.push(sql`${pitches.status} != 'archived'`);
    }
    
    const results = await db.select()
      .from(pitches)
      .where(and(...conditions))
      .orderBy(desc(pitches.updatedAt));
    
    return results;
  }

  /**
   * Track pitch view
   */
  private static async trackPitchView(
    pitchId: number,
    viewerId?: number
  ): Promise<void> {
    // Record view
    await db.insert(pitchViews).values({
      pitchId,
      viewerId,
      viewType: 'detail',
      viewedAt: new Date(),
    });
    
    // Increment view counter
    await db.update(pitches)
      .set({
        viewCount: sql`${pitches.viewCount} + 1`,
      })
      .where(eq(pitches.id, pitchId));
  }

  /**
   * Apply visibility restrictions for non-NDA users
   */
  private static applyVisibilityRestrictions(
    pitch: any,
    creator: any
  ): any {
    const { visibilitySettings } = pitch;
    
    return {
      ...pitch,
      creator,
      // Hide protected content
      longSynopsis: visibilitySettings.showShortSynopsis ? pitch.longSynopsis : null,
      characters: visibilitySettings.showCharacters ? pitch.characters : null,
      estimatedBudget: visibilitySettings.showBudget ? pitch.estimatedBudget : null,
      budgetBracket: visibilitySettings.showBudget ? pitch.budgetBracket : null,
      lookbookUrl: visibilitySettings.showMedia ? pitch.lookbookUrl : null,
      scriptUrl: visibilitySettings.showMedia ? pitch.scriptUrl : null,
      pitchDeckUrl: visibilitySettings.showMedia ? pitch.pitchDeckUrl : null,
      additionalMedia: visibilitySettings.showMedia ? pitch.additionalMedia : [],
    };
  }

  /**
   * Check if user is owner of pitch
   */
  private static isOwner(pitchUserId: number, viewerId?: number): boolean {
    return viewerId ? pitchUserId === viewerId : false;
  }
}
```

### RESTful API Routes

```typescript
// src/routes/pitch.routes.ts

import { Router } from 'oak';
import { PitchService } from '../services/pitch.service';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { pitchSchema, pitchUpdateSchema } from '../schemas/pitch.schema';

const router = new Router({ prefix: '/api/pitches' });

/**
 * GET /api/pitches - Search and list pitches
 */
router.get('/', async (ctx) => {
  const params = Object.fromEntries(ctx.request.url.searchParams);
  
  const filters = {
    search: params.q,
    genre: params.genre,
    format: params.format,
    budgetMin: params.budgetMin ? parseInt(params.budgetMin) : undefined,
    budgetMax: params.budgetMax ? parseInt(params.budgetMax) : undefined,
    sortBy: params.sortBy || 'recent',
  };
  
  const page = parseInt(params.page || '1');
  const limit = parseInt(params.limit || '20');
  
  const results = await PitchService.searchPitches(filters, page, limit);
  
  ctx.response.body = {
    success: true,
    data: results.pitches,
    pagination: {
      page,
      limit,
      total: results.total,
      pages: Math.ceil(results.total / limit),
    },
  };
});

/**
 * GET /api/pitches/:id - Get single pitch
 */
router.get('/:id', async (ctx) => {
  const pitchId = parseInt(ctx.params.id);
  const viewerId = ctx.state.user?.id;
  
  const pitch = await PitchService.getPitchById(pitchId, viewerId);
  
  if (!pitch) {
    ctx.response.status = 404;
    ctx.response.body = { success: false, error: 'Pitch not found' };
    return;
  }
  
  ctx.response.body = { success: true, data: pitch };
});

/**
 * POST /api/pitches - Create new pitch
 */
router.post('/', authMiddleware, validateBody(pitchSchema), async (ctx) => {
  const userId = ctx.state.user.id;
  const pitchData = ctx.request.body;
  
  const pitch = await PitchService.createPitch(pitchData, userId);
  
  ctx.response.status = 201;
  ctx.response.body = { success: true, data: pitch };
});

/**
 * PATCH /api/pitches/:id - Update pitch
 */
router.patch('/:id', authMiddleware, validateBody(pitchUpdateSchema), async (ctx) => {
  const pitchId = parseInt(ctx.params.id);
  const userId = ctx.state.user.id;
  const updates = ctx.request.body;
  
  try {
    const pitch = await PitchService.updatePitch(pitchId, userId, updates);
    ctx.response.body = { success: true, data: pitch };
  } catch (error) {
    ctx.response.status = 403;
    ctx.response.body = { success: false, error: error.message };
  }
});

/**
 * POST /api/pitches/:id/publish - Publish pitch
 */
router.post('/:id/publish', authMiddleware, async (ctx) => {
  const pitchId = parseInt(ctx.params.id);
  const userId = ctx.state.user.id;
  
  try {
    const pitch = await PitchService.publishPitch(pitchId, userId);
    ctx.response.body = { success: true, data: pitch };
  } catch (error) {
    ctx.response.status = 403;
    ctx.response.body = { success: false, error: error.message };
  }
});

/**
 * DELETE /api/pitches/:id - Archive pitch
 */
router.delete('/:id', authMiddleware, async (ctx) => {
  const pitchId = parseInt(ctx.params.id);
  const userId = ctx.state.user.id;
  
  try {
    await PitchService.deletePitch(pitchId, userId);
    ctx.response.body = { success: true, message: 'Pitch archived' };
  } catch (error) {
    ctx.response.status = 403;
    ctx.response.body = { success: false, error: error.message };
  }
});

/**
 * GET /api/pitches/:id/analytics - Get pitch analytics
 */
router.get('/:id/analytics', authMiddleware, async (ctx) => {
  const pitchId = parseInt(ctx.params.id);
  const userId = ctx.state.user.id;
  
  const analytics = await AnalyticsService.getPitchAnalytics(pitchId, userId);
  
  if (!analytics) {
    ctx.response.status = 403;
    ctx.response.body = { success: false, error: 'Unauthorized' };
    return;
  }
  
  ctx.response.body = { success: true, data: analytics };
});

export default router;
```

---

## Frontend Integration

### API Client with Type Safety

```typescript
// src/lib/api-client.ts

import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../store/authStore';

class ApiClient {
  private client: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor for auth
    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request with caching
   */
  async get<T>(url: string, options?: { cache?: boolean }): Promise<T> {
    if (options?.cache) {
      const cached = this.getFromCache(url);
      if (cached) return cached;
    }

    const response = await this.client.get<{ success: boolean; data: T }>(url);
    
    if (options?.cache) {
      this.setCache(url, response.data.data);
    }
    
    return response.data.data;
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<{ success: boolean; data: T }>(url, data);
    this.invalidateCache(url);
    return response.data.data;
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<{ success: boolean; data: T }>(url, data);
    this.invalidateCache(url);
    return response.data.data;
  }

  /**
   * DELETE request
   */
  async delete(url: string): Promise<void> {
    await this.client.delete(url);
    this.invalidateCache(url);
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateCache(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach((key) => {
      if (key.includes(pattern.split('/')[2])) { // Extract resource name
        this.cache.delete(key);
      }
    });
  }
}

export const apiClient = new ApiClient();
```

### Pitch Store with Real Data

```typescript
// src/store/pitchStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../lib/api-client';
import type { Pitch, PitchFilter } from '../types';

interface PitchStore {
  // State
  pitches: Pitch[];
  currentPitch: Pitch | null;
  userPitches: Pitch[];
  loading: boolean;
  error: string | null;
  filters: PitchFilter;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };

  // Actions
  fetchPitches: (filters?: PitchFilter, page?: number) => Promise<void>;
  fetchPitchById: (id: number) => Promise<void>;
  fetchUserPitches: () => Promise<void>;
  createPitch: (data: Partial<Pitch>) => Promise<Pitch>;
  updatePitch: (id: number, data: Partial<Pitch>) => Promise<void>;
  publishPitch: (id: number) => Promise<void>;
  deletePitch: (id: number) => Promise<void>;
  setFilters: (filters: PitchFilter) => void;
  clearError: () => void;
}

export const usePitchStore = create<PitchStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      pitches: [],
      currentPitch: null,
      userPitches: [],
      loading: false,
      error: null,
      filters: {},
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },

      // Fetch all pitches with filters
      fetchPitches: async (filters = {}, page = 1) => {
        set({ loading: true, error: null });
        
        try {
          const params = new URLSearchParams({
            page: page.toString(),
            limit: '20',
            ...(filters.search && { q: filters.search }),
            ...(filters.genre && { genre: filters.genre }),
            ...(filters.format && { format: filters.format }),
            ...(filters.budgetMin && { budgetMin: filters.budgetMin.toString() }),
            ...(filters.budgetMax && { budgetMax: filters.budgetMax.toString() }),
            ...(filters.sortBy && { sortBy: filters.sortBy }),
          });

          const response = await apiClient.get<{
            data: Pitch[];
            pagination: typeof get().pagination;
          }>(`/api/pitches?${params}`, { cache: true });

          set({
            pitches: response.data,
            pagination: response.pagination,
            filters,
            loading: false,
          });
        } catch (error) {
          set({
            error: error.message || 'Failed to fetch pitches',
            loading: false,
          });
        }
      },

      // Fetch single pitch
      fetchPitchById: async (id: number) => {
        set({ loading: true, error: null });
        
        try {
          const pitch = await apiClient.get<Pitch>(`/api/pitches/${id}`);
          set({ currentPitch: pitch, loading: false });
        } catch (error) {
          set({
            error: error.message || 'Failed to fetch pitch',
            loading: false,
          });
        }
      },

      // Fetch user's pitches
      fetchUserPitches: async () => {
        set({ loading: true, error: null });
        
        try {
          const pitches = await apiClient.get<Pitch[]>('/api/user/pitches');
          set({ userPitches: pitches, loading: false });
        } catch (error) {
          set({
            error: error.message || 'Failed to fetch your pitches',
            loading: false,
          });
        }
      },

      // Create new pitch
      createPitch: async (data: Partial<Pitch>) => {
        set({ loading: true, error: null });
        
        try {
          const pitch = await apiClient.post<Pitch>('/api/pitches', data);
          
          set((state) => ({
            userPitches: [...state.userPitches, pitch],
            loading: false,
          }));
          
          return pitch;
        } catch (error) {
          set({
            error: error.message || 'Failed to create pitch',
            loading: false,
          });
          throw error;
        }
      },

      // Update pitch
      updatePitch: async (id: number, data: Partial<Pitch>) => {
        set({ loading: true, error: null });
        
        try {
          const updated = await apiClient.patch<Pitch>(`/api/pitches/${id}`, data);
          
          set((state) => ({
            userPitches: state.userPitches.map((p) => 
              p.id === id ? updated : p
            ),
            currentPitch: state.currentPitch?.id === id ? updated : state.currentPitch,
            loading: false,
          }));
        } catch (error) {
          set({
            error: error.message || 'Failed to update pitch',
            loading: false,
          });
          throw error;
        }
      },

      // Publish pitch
      publishPitch: async (id: number) => {
        set({ loading: true, error: null });
        
        try {
          const published = await apiClient.post<Pitch>(`/api/pitches/${id}/publish`);
          
          set((state) => ({
            userPitches: state.userPitches.map((p) => 
              p.id === id ? published : p
            ),
            currentPitch: state.currentPitch?.id === id ? published : state.currentPitch,
            loading: false,
          }));
        } catch (error) {
          set({
            error: error.message || 'Failed to publish pitch',
            loading: false,
          });
          throw error;
        }
      },

      // Delete/Archive pitch
      deletePitch: async (id: number) => {
        set({ loading: true, error: null });
        
        try {
          await apiClient.delete(`/api/pitches/${id}`);
          
          set((state) => ({
            userPitches: state.userPitches.filter((p) => p.id !== id),
            loading: false,
          }));
        } catch (error) {
          set({
            error: error.message || 'Failed to delete pitch',
            loading: false,
          });
          throw error;
        }
      },

      // Set filters
      setFilters: (filters: PitchFilter) => {
        set({ filters });
        get().fetchPitches(filters);
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'pitch-store',
    }
  )
);
```

### React Component Integration

```tsx
// src/pages/PitchList.tsx

import React, { useEffect, useState } from 'react';
import { usePitchStore } from '../store/pitchStore';
import { PitchCard } from '../components/PitchCard';
import { FilterPanel } from '../components/FilterPanel';
import { Pagination } from '../components/Pagination';
import { LoadingSpinner } from '../components/Loading';

export const PitchList: React.FC = () => {
  const {
    pitches,
    loading,
    error,
    pagination,
    filters,
    fetchPitches,
    setFilters,
  } = usePitchStore();

  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    fetchPitches();
  }, []);

  const handleFilterChange = (newFilters: typeof filters) => {
    setLocalFilters(newFilters);
    setFilters(newFilters);
  };

  const handlePageChange = (page: number) => {
    fetchPitches(filters, page);
  };

  if (loading && pitches.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <p>{error}</p>
        <button onClick={() => fetchPitches()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex gap-4">
        {/* Filter Panel */}
        <aside className="w-64">
          <FilterPanel
            filters={localFilters}
            onChange={handleFilterChange}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {pitches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No pitches found</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pitches.map((pitch) => (
                  <PitchCard key={pitch.id} pitch={pitch} />
                ))}
              </div>

              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
};
```

---

## Migration Strategies

### Incremental Migration from Mock to Production

```typescript
// src/migrations/mock-to-production.ts

export class MockToProductionMigration {
  private mockDataSource: any;
  private productionDb: any;
  private batchSize = 100;

  /**
   * Phase 1: Dual-write strategy
   * Write to both mock and production, read from mock
   */
  async phase1_dualWrite() {
    console.log('📝 Phase 1: Enabling dual-write mode...');
    
    // Intercept all write operations
    this.interceptWriteOperations({
      onCreate: async (data) => {
        // Write to mock (primary)
        const mockResult = await this.mockDataSource.create(data);
        
        // Write to production (secondary)
        try {
          await this.productionDb.insert(data);
        } catch (error) {
          console.error('Production write failed:', error);
          // Don't fail the operation if production write fails
        }
        
        return mockResult;
      },
    });
  }

  /**
   * Phase 2: Data synchronization
   * Migrate all existing mock data to production
   */
  async phase2_syncData() {
    console.log('🔄 Phase 2: Synchronizing data...');
    
    const mockData = await this.mockDataSource.getAll();
    const batches = this.createBatches(mockData, this.batchSize);
    
    for (const [index, batch] of batches.entries()) {
      console.log(`Processing batch ${index + 1}/${batches.length}`);
      
      await this.processBatch(batch);
      
      // Add delay to prevent overwhelming the database
      await this.delay(100);
    }
  }

  /**
   * Phase 3: Shadow reads
   * Read from production, fallback to mock if not found
   */
  async phase3_shadowReads() {
    console.log('👁 Phase 3: Enabling shadow reads...');
    
    this.interceptReadOperations({
      onRead: async (id) => {
        try {
          // Try production first
          const prodData = await this.productionDb.findById(id);
          if (prodData) return prodData;
        } catch (error) {
          console.error('Production read failed:', error);
        }
        
        // Fallback to mock
        return this.mockDataSource.findById(id);
      },
    });
  }

  /**
   * Phase 4: Production primary
   * Read from production, write to production, mock as backup
   */
  async phase4_productionPrimary() {
    console.log('🚀 Phase 4: Production as primary...');
    
    // Switch primary data source
    this.setPrimaryDataSource('production');
    
    // Keep mock as read-only backup
    this.mockDataSource.setReadOnly(true);
  }

  /**
   * Phase 5: Cleanup
   * Remove mock data dependencies
   */
  async phase5_cleanup() {
    console.log('🧹 Phase 5: Cleaning up...');
    
    // Archive mock data
    await this.archiveMockData();
    
    // Remove mock data interceptors
    this.removeInterceptors();
    
    // Update configuration
    await this.updateConfiguration({
      dataSource: 'production',
      mockEnabled: false,
    });
  }

  /**
   * Rollback strategy
   */
  async rollback(toPhase: number) {
    console.log(`⏪ Rolling back to phase ${toPhase}...`);
    
    switch (toPhase) {
      case 0:
        // Full rollback to mock only
        this.setPrimaryDataSource('mock');
        this.productionDb.setReadOnly(true);
        break;
      
      case 1:
        // Rollback to dual-write
        await this.phase1_dualWrite();
        break;
      
      case 2:
        // Keep synchronized data, revert to mock primary
        this.setPrimaryDataSource('mock');
        break;
      
      default:
        throw new Error(`Invalid rollback phase: ${toPhase}`);
    }
  }

  /**
   * Health checks
   */
  async validateMigration(): Promise<ValidationReport> {
    const report: ValidationReport = {
      totalRecords: 0,
      matchedRecords: 0,
      missingInProduction: [],
      missingInMock: [],
      dataMismatches: [],
    };
    
    // Compare record counts
    const mockCount = await this.mockDataSource.count();
    const prodCount = await this.productionDb.count();
    
    report.totalRecords = mockCount;
    
    // Detailed comparison
    const mockRecords = await this.mockDataSource.getAll();
    
    for (const mockRecord of mockRecords) {
      const prodRecord = await this.productionDb.findById(mockRecord.id);
      
      if (!prodRecord) {
        report.missingInProduction.push(mockRecord.id);
      } else if (this.hasDataMismatch(mockRecord, prodRecord)) {
        report.dataMismatches.push({
          id: mockRecord.id,
          differences: this.findDifferences(mockRecord, prodRecord),
        });
      } else {
        report.matchedRecords++;
      }
    }
    
    return report;
  }

  /**
   * Utility functions
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  private async processBatch(batch: any[]) {
    const transformedBatch = batch.map(item => 
      DataTransformer.transformMockPitch(item, item.userId)
    );
    
    await this.productionDb.insertMany(transformedBatch);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private hasDataMismatch(record1: any, record2: any): boolean {
    const keys = Object.keys(record1);
    
    return keys.some(key => {
      if (typeof record1[key] === 'object') {
        return JSON.stringify(record1[key]) !== JSON.stringify(record2[key]);
      }
      return record1[key] !== record2[key];
    });
  }

  private findDifferences(record1: any, record2: any): any {
    const differences: any = {};
    
    Object.keys(record1).forEach(key => {
      if (record1[key] !== record2[key]) {
        differences[key] = {
          mock: record1[key],
          production: record2[key],
        };
      }
    });
    
    return differences;
  }
}

// Migration execution script
if (import.meta.main) {
  const migration = new MockToProductionMigration();
  
  const phase = parseInt(Deno.env.get('MIGRATION_PHASE') || '1');
  
  try {
    switch (phase) {
      case 1:
        await migration.phase1_dualWrite();
        break;
      case 2:
        await migration.phase2_syncData();
        break;
      case 3:
        await migration.phase3_shadowReads();
        break;
      case 4:
        await migration.phase4_productionPrimary();
        break;
      case 5:
        await migration.phase5_cleanup();
        break;
      default:
        console.error('Invalid migration phase');
    }
    
    // Validate after each phase
    const report = await migration.validateMigration();
    console.log('Validation Report:', report);
    
  } catch (error) {
    console.error('Migration failed:', error);
    
    // Attempt rollback
    if (phase > 1) {
      await migration.rollback(phase - 1);
    }
  }
}
```

---

## Best Practices

### 1. Data Validation

```typescript
// src/validation/pitch.validation.ts

import { z } from 'zod';

export const pitchValidationSchema = z.object({
  title: z.string().min(3).max(200),
  logline: z.string().min(10).max(500),
  genre: z.enum(['drama', 'comedy', 'thriller', 'horror', 'scifi', 
                  'fantasy', 'documentary', 'animation', 'action', 'romance', 'other']),
  format: z.enum(['feature', 'tv', 'short', 'webseries', 'other']),
  shortSynopsis: z.string().max(1000).optional(),
  longSynopsis: z.string().max(5000).optional(),
  estimatedBudget: z.number().positive().optional(),
  characters: z.array(z.object({
    name: z.string(),
    description: z.string(),
    age: z.string().optional(),
    gender: z.string().optional(),
  })).optional(),
});

export const validatePitchData = (data: unknown) => {
  return pitchValidationSchema.parse(data);
};
```

### 2. Error Handling

```typescript
// src/utils/errorHandler.ts

export class DataTransformationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DataTransformationError';
  }
}

export const handleTransformationError = (error: any) => {
  console.error('Transformation error:', error);
  
  if (error instanceof DataTransformationError) {
    // Specific handling for transformation errors
    logToMonitoring({
      level: 'error',
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }
  
  // Notify administrators for critical errors
  if (error.code === 'CRITICAL_TRANSFORMATION_FAILURE') {
    notifyAdmins({
      subject: 'Critical Data Transformation Failure',
      body: error.message,
      details: error.details,
    });
  }
};
```

### 3. Performance Optimization

```typescript
// src/optimization/batchProcessor.ts

export class BatchProcessor {
  private queue: any[] = [];
  private processing = false;
  private batchSize = 100;
  private processInterval = 1000; // ms

  async addToQueue(items: any[]) {
    this.queue.push(...items);
    
    if (!this.processing) {
      this.startProcessing();
    }
  }

  private async startProcessing() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      
      await this.processBatchWithRetry(batch);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, this.processInterval));
    }
    
    this.processing = false;
  }

  private async processBatchWithRetry(batch: any[], retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.processBatch(batch);
        return;
      } catch (error) {
        console.error(`Batch processing failed (attempt ${attempt + 1}):`, error);
        
        if (attempt === retries - 1) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  private async processBatch(batch: any[]) {
    // Process in parallel with concurrency limit
    const concurrency = 5;
    const results = [];
    
    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(item => this.processItem(item))
      );
      results.push(...chunkResults);
    }
    
    return results;
  }

  private async processItem(item: any) {
    // Individual item processing
    return DataTransformer.transformMockPitch(item, item.userId);
  }
}
```

---

## Testing & Validation

### Integration Tests

```typescript
// src/tests/dataTransformation.test.ts

import { assertEquals, assertExists } from 'deno/testing/asserts.ts';
import { DataTransformer } from '../utils/dataTransformers';
import { DatabaseSeeder } from '../db/seed';

Deno.test('Data Transformation Suite', async (t) => {
  
  await t.step('transforms mock pitch to database format', () => {
    const mockPitch = {
      id: '123',
      title: 'Test Movie',
      creator: 'John Doe',
      description: 'A test movie description',
      genre: 'Action',
      budget: '$5M',
      media: ['http://example.com/poster.jpg'],
    };
    
    const transformed = DataTransformer.transformMockPitch(mockPitch, 1);
    
    assertEquals(transformed.title, 'Test Movie');
    assertEquals(transformed.genre, 'action');
    assertEquals(transformed.format, 'feature');
    assertEquals(transformed.estimatedBudget, 5000000);
    assertExists(transformed.additionalMedia);
  });
  
  await t.step('handles budget parsing correctly', () => {
    const testCases = [
      { input: '$1M', expected: 1000000 },
      { input: '500K', expected: 500000 },
      { input: '1.5M', expected: 1500000 },
      { input: '$10M-$20M', expected: 15000000 },
      { input: '5000', expected: 5000 },
    ];
    
    testCases.forEach(({ input, expected }) => {
      const result = DataTransformer.parseBudget(input);
      assertEquals(result, expected);
    });
  });
  
  await t.step('categorizes budget brackets correctly', () => {
    const testCases = [
      { amount: 50000, expected: 'micro' },
      { amount: 500000, expected: 'low' },
      { amount: 5000000, expected: 'medium' },
      { amount: 25000000, expected: 'high' },
      { amount: 100000000, expected: 'blockbuster' },
    ];
    
    testCases.forEach(({ amount, expected }) => {
      const result = DataTransformer.categorizeBudget(amount.toString());
      assertEquals(result, expected);
    });
  });
});

Deno.test('Database Seeding', async (t) => {
  
  await t.step('seeds database with realistic data', async () => {
    const seeder = new DatabaseSeeder({
      userCount: 10,
      pitchesPerUser: 2,
      ndasPerPitch: 1,
      messagesPerPitch: 2,
      followRelations: 5,
    });
    
    const result = await seeder.seed();
    
    assertEquals(result.users, 10);
    assertExists(result.pitches);
  });
});
```

### Data Validation Tests

```typescript
// src/tests/validation.test.ts

Deno.test('Pitch Validation', async (t) => {
  
  await t.step('validates required fields', () => {
    const invalidPitch = {
      title: 'Te', // Too short
      logline: 'Short', // Too short
    };
    
    let error;
    try {
      validatePitchData(invalidPitch);
    } catch (e) {
      error = e;
    }
    
    assertExists(error);
  });
  
  await t.step('validates enum values', () => {
    const invalidPitch = {
      title: 'Valid Title',
      logline: 'Valid logline for the pitch',
      genre: 'invalid-genre', // Invalid enum
      format: 'invalid-format', // Invalid enum
    };
    
    let error;
    try {
      validatePitchData(invalidPitch);
    } catch (e) {
      error = e;
    }
    
    assertExists(error);
  });
});
```

---

## Monitoring & Maintenance

### Data Quality Monitoring

```typescript
// src/monitoring/dataQuality.ts

export class DataQualityMonitor {
  private metrics: Map<string, any> = new Map();
  
  async runQualityChecks(): Promise<QualityReport> {
    const report: QualityReport = {
      timestamp: new Date(),
      checks: [],
      overallHealth: 'healthy',
    };
    
    // Check for data completeness
    report.checks.push(await this.checkDataCompleteness());
    
    // Check for data consistency
    report.checks.push(await this.checkDataConsistency());
    
    // Check for data accuracy
    report.checks.push(await this.checkDataAccuracy());
    
    // Check for data freshness
    report.checks.push(await this.checkDataFreshness());
    
    // Determine overall health
    const failedChecks = report.checks.filter(c => c.status === 'failed');
    if (failedChecks.length > 0) {
      report.overallHealth = 'unhealthy';
    } else {
      const warningChecks = report.checks.filter(c => c.status === 'warning');
      if (warningChecks.length > 0) {
        report.overallHealth = 'degraded';
      }
    }
    
    return report;
  }
  
  private async checkDataCompleteness(): Promise<QualityCheck> {
    const totalPitches = await db.select({ count: sql`count(*)` })
      .from(pitches);
    
    const incompletePitches = await db.select({ count: sql`count(*)` })
      .from(pitches)
      .where(
        or(
          eq(pitches.title, null),
          eq(pitches.logline, null),
          eq(pitches.genre, null)
        )
      );
    
    const completenessRatio = 
      (totalPitches[0].count - incompletePitches[0].count) / totalPitches[0].count;
    
    return {
      name: 'Data Completeness',
      status: completenessRatio > 0.95 ? 'passed' : 
              completenessRatio > 0.85 ? 'warning' : 'failed',
      value: completenessRatio,
      message: `${(completenessRatio * 100).toFixed(2)}% of pitches have complete required fields`,
    };
  }
  
  private async checkDataConsistency(): Promise<QualityCheck> {
    // Check for orphaned records
    const orphanedNDAs = await db.select({ count: sql`count(*)` })
      .from(ndas)
      .leftJoin(pitches, eq(ndas.pitchId, pitches.id))
      .where(eq(pitches.id, null));
    
    const hasOrphans = orphanedNDAs[0].count > 0;
    
    return {
      name: 'Data Consistency',
      status: hasOrphans ? 'failed' : 'passed',
      value: orphanedNDAs[0].count,
      message: hasOrphans ? 
        `Found ${orphanedNDAs[0].count} orphaned NDA records` : 
        'No orphaned records found',
    };
  }
  
  private async checkDataAccuracy(): Promise<QualityCheck> {
    // Check for invalid budget values
    const invalidBudgets = await db.select({ count: sql`count(*)` })
      .from(pitches)
      .where(
        and(
          sql`${pitches.estimatedBudget} IS NOT NULL`,
          or(
            sql`${pitches.estimatedBudget} < 0`,
            sql`${pitches.estimatedBudget} > 1000000000`
          )
        )
      );
    
    const hasInvalidBudgets = invalidBudgets[0].count > 0;
    
    return {
      name: 'Data Accuracy',
      status: hasInvalidBudgets ? 'warning' : 'passed',
      value: invalidBudgets[0].count,
      message: hasInvalidBudgets ? 
        `Found ${invalidBudgets[0].count} pitches with suspicious budget values` : 
        'All budget values within expected ranges',
    };
  }
  
  private async checkDataFreshness(): Promise<QualityCheck> {
    const recentActivity = await db.select({ count: sql`count(*)` })
      .from(pitches)
      .where(
        sql`${pitches.updatedAt} > NOW() - INTERVAL '24 hours'`
      );
    
    const hasRecentActivity = recentActivity[0].count > 0;
    
    return {
      name: 'Data Freshness',
      status: hasRecentActivity ? 'passed' : 'warning',
      value: recentActivity[0].count,
      message: `${recentActivity[0].count} pitches updated in the last 24 hours`,
    };
  }
}

// Schedule regular monitoring
if (import.meta.main) {
  const monitor = new DataQualityMonitor();
  
  // Run checks every hour
  setInterval(async () => {
    const report = await monitor.runQualityChecks();
    
    console.log('Data Quality Report:', report);
    
    if (report.overallHealth !== 'healthy') {
      // Send alert
      await notifyAdmins({
        subject: `Data Quality Alert: ${report.overallHealth}`,
        body: JSON.stringify(report, null, 2),
      });
    }
  }, 60 * 60 * 1000);
}
```

---

## Conclusion

This comprehensive guide provides a complete roadmap for transforming mock data into a production-ready database system. The key aspects covered include:

1. **Architecture Design**: Clear separation between frontend, backend, and database layers
2. **Data Transformation**: Robust functions to convert mock data to database schemas
3. **Database Seeding**: Comprehensive seeding scripts with realistic data generation
4. **API Implementation**: Type-safe API endpoints with proper error handling
5. **Frontend Integration**: React components with Zustand state management
6. **Migration Strategy**: Phased approach for safe production deployment
7. **Testing & Monitoring**: Comprehensive test suites and quality monitoring

### Next Steps

1. **Environment Setup**: Configure database connections and environment variables
2. **Initial Seeding**: Run seed scripts to populate development database
3. **API Testing**: Validate all endpoints with integration tests
4. **Frontend Migration**: Update components to use real API calls
5. **Performance Testing**: Load test with realistic data volumes
6. **Production Deployment**: Follow phased migration strategy
7. **Monitoring Setup**: Implement data quality monitoring

### Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/current/)
- [Deno Deploy Documentation](https://deno.com/deploy/docs)
- [React Query for Data Fetching](https://tanstack.com/query/latest)
- [Zustand State Management](https://zustand-demo.pmnd.rs/)

---

*This guide is a living document and should be updated as the system evolves and new patterns emerge.*