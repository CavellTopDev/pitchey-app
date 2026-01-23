/**
 * Enhanced Test Data Factory
 * Provides comprehensive test data generation with realistic relationships and constraints
 */

import { faker } from "npm:@faker-js/faker@8.4.1";

// Define types locally (these match the database schema)
interface User {
  id: number;
  email: string;
  username: string;
  password: string;
  passwordHash: string;
  userType: string;
  firstName: string;
  lastName: string;
  phone?: string;
  location?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
  profileImageUrl?: string;
  companyName?: string;
  companyNumber?: string;
  companyWebsite?: string;
  companyAddress?: string;
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  emailVerifiedAt?: Date;
  companyVerified?: boolean;
  isActive: boolean;
  failedLoginAttempts?: number;
  lastFailedLogin?: Date | null;
  accountLockedUntil?: Date | null;
  accountLockedAt?: Date | null;
  accountLockReason?: string | null;
  lastPasswordChangeAt?: Date;
  passwordHistory?: string;
  requirePasswordChange?: boolean;
  twoFactorEnabled?: boolean;
  email_notifications?: boolean;
  marketing_emails?: boolean;
  privacy_settings?: string;
  preferred_genres?: string[];
  preferred_formats?: string[];
  preferred_budget_ranges?: string[];
  notification_frequency?: string;
  subscriptionTier?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Pitch {
  id: number;
  userId: number;
  title: string;
  logline: string;
  description?: string;
  genre: string;
  format?: string;
  formatCategory?: string;
  formatSubtype?: string;
  customFormat?: string | null;
  shortSynopsis?: string;
  longSynopsis?: string;
  opener?: string;
  premise?: string;
  targetAudience?: string;
  characters?: string;
  themes?: string;
  worldDescription?: string;
  episodeBreakdown?: string | null;
  budgetRange?: string;
  budgetBracket?: string;
  estimatedBudget?: string;
  stage?: string;
  videoUrl?: string | null;
  posterUrl?: string | null;
  pitchDeckUrl?: string | null;
  additionalMaterials?: string;
  visibility?: string;
  status?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  ndaCount?: number;
  titleImage?: string | null;
  lookbookUrl?: string | null;
  scriptUrl?: string | null;
  trailerUrl?: string | null;
  additionalMedia?: string;
  productionTimeline?: string;
  requireNda?: boolean;
  seekingInvestment?: boolean;
  productionStage?: string;
  publishedAt?: Date;
  visibilitySettings?: string;
  aiUsed?: boolean;
  aiTools?: string[];
  aiDisclosure?: string | null;
  shareCount?: number;
  feedback?: string;
  tags?: string[];
  archived?: boolean;
  archivedAt?: Date | null;
  metadata?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface NDA {
  id: number;
  pitchId: number;
  userId: number;
  signerId: number;
  status: string;
  ndaType: string;
  accessGranted: boolean;
  signedAt?: Date;
  expiresAt?: Date;
  documentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: number;
  conversationId?: number;
  senderId: number;
  receiverId: number;
  subject?: string;
  content: string;
  messageType: string;
  pitchId?: number | null;
  read: boolean;
  isRead?: boolean;
  metadata?: string;
  offPlatformRequested?: boolean;
  offPlatformApproved?: boolean;
  sentAt?: Date;
  readAt?: Date | null;
  createdAt: Date;
}

interface Investment {
  id: number;
  investorId: number;
  pitchId: number;
  amount: string;
  status: string;
  terms?: string;
  currentValue?: string;
  documents?: string[];
  notes?: string;
  roiPercentage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TestScenario = 
  | "empty_state"
  | "basic_user_flow"
  | "creator_with_pitches"
  | "investor_with_portfolio"
  | "production_with_reviews"
  | "active_nda_workflow"
  | "multi_user_collaboration"
  | "high_volume_data";

interface TestDataConfig {
  seed?: number;
  locale?: string;
  respectConstraints?: boolean;
  includeRelations?: boolean;
}

interface DatabaseSnapshot {
  id: string;
  timestamp: Date;
  tables: Record<string, unknown[]>;
  metadata: {
    userCount: number;
    pitchCount: number;
    ndaCount: number;
  };
}

export class EnhancedTestDataFactory {
  private static instance: EnhancedTestDataFactory;
  private config: TestDataConfig;
  private sequences: Map<string, number> = new Map();

  private constructor(config: TestDataConfig = {}) {
    this.config = {
      seed: 12345,
      locale: "en",
      respectConstraints: true,
      includeRelations: true,
      ...config,
    };

    if (this.config.seed) {
      faker.seed(this.config.seed);
    }
  }

  static getInstance(config?: TestDataConfig): EnhancedTestDataFactory {
    if (!EnhancedTestDataFactory.instance) {
      EnhancedTestDataFactory.instance = new EnhancedTestDataFactory(config);
    }
    return EnhancedTestDataFactory.instance;
  }

  // ==================== SEQUENCE MANAGEMENT ====================
  
  private nextSequence(key: string): number {
    const current = this.sequences.get(key) || 0;
    const next = current + 1;
    this.sequences.set(key, next);
    return next;
  }

  private resetSequences(): void {
    this.sequences.clear();
  }

  // ==================== USER FACTORIES ====================

  creator(overrides: Partial<User> = {}): Omit<User, "id" | "createdAt" | "updatedAt"> {
    const sequence = this.nextSequence("creator");
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    return {
      email: overrides.email || `creator${sequence}@pitchey.com`,
      username: overrides.username || `${firstName.toLowerCase()}${lastName.toLowerCase()}${sequence}`,
      password: overrides.password || "TestPassword123!",
      passwordHash: overrides.passwordHash || "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewenAiCkKEGu.tAa", // TestPassword123!
      userType: "creator",
      firstName,
      lastName,
      phone: faker.phone.number(),
      location: `${faker.location.city()}, ${faker.location.state()}`,
      bio: faker.lorem.paragraphs(2),
      website: `https://${firstName.toLowerCase()}${lastName.toLowerCase()}.com`,
      avatar_url: faker.image.avatar(),
      profileImageUrl: faker.image.avatar(),
      companyName: faker.company.name(),
      companyNumber: faker.string.alphanumeric(8).toUpperCase(),
      companyWebsite: faker.internet.url(),
      companyAddress: faker.location.streetAddress(true),
      emailVerified: true,
      emailVerificationToken: null,
      emailVerifiedAt: faker.date.past(),
      companyVerified: faker.datatype.boolean(0.7),
      isActive: true,
      failedLoginAttempts: 0,
      lastFailedLogin: null,
      accountLockedUntil: null,
      accountLockedAt: null,
      accountLockReason: null,
      lastPasswordChangeAt: faker.date.past(),
      passwordHistory: JSON.stringify([]),
      requirePasswordChange: false,
      twoFactorEnabled: faker.datatype.boolean(0.3),
      email_notifications: true,
      marketing_emails: faker.datatype.boolean(0.6),
      privacy_settings: JSON.stringify({
        profileVisibility: "public",
        showEmail: false,
        showPhone: false,
      }),
      preferred_genres: faker.helpers.arrayElements([
        "Drama", "Comedy", "Thriller", "Sci-Fi", "Horror", "Documentary"
      ], { min: 1, max: 3 }),
      preferred_formats: ["Feature Film"],
      preferred_budget_ranges: ["low", "medium"],
      notification_frequency: faker.helpers.arrayElement(["immediate", "daily", "weekly"]),
      subscriptionTier: faker.helpers.arrayElement(["free", "basic", "pro"]),
      subscriptionStartDate: faker.date.past(),
      subscriptionEndDate: faker.date.future(),
      stripeCustomerId: `cus_test_${faker.string.alphanumeric(14)}`,
      stripeSubscriptionId: `sub_test_${faker.string.alphanumeric(14)}`,
      lastLoginAt: faker.date.recent(),
      ...overrides,
    } as Omit<User, "id" | "createdAt" | "updatedAt">;
  }

  investor(overrides: Partial<User> = {}): Omit<User, "id" | "createdAt" | "updatedAt"> {
    const sequence = this.nextSequence("investor");
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    return this.creator({
      email: `investor${sequence}@pitchey.com`,
      username: `${firstName.toLowerCase()}${lastName.toLowerCase()}${sequence}`,
      userType: "investor",
      firstName,
      lastName,
      companyName: `${faker.company.name()} Capital`,
      bio: `Experienced investor with ${faker.number.int({ min: 5, max: 20 })} years in film financing. Looking for compelling stories and strong ROI potential.`,
      preferred_budget_ranges: faker.helpers.arrayElements(["medium", "high", "blockbuster"], { min: 1, max: 2 }),
      subscriptionTier: faker.helpers.arrayElement(["pro", "enterprise"]),
      ...overrides,
    });
  }

  production(overrides: Partial<User> = {}): Omit<User, "id" | "createdAt" | "updatedAt"> {
    const sequence = this.nextSequence("production");
    
    return this.creator({
      email: `production${sequence}@pitchey.com`,
      userType: "production",
      companyName: `${faker.company.name()} Studios`,
      bio: `Production company specializing in ${faker.helpers.arrayElement([
        "independent films", "documentaries", "commercial content", "streaming series"
      ])}. We bring stories to life.`,
      subscriptionTier: "enterprise",
      ...overrides,
    });
  }

  // ==================== PITCH FACTORIES ====================

  pitch(creatorId: number, overrides: Partial<Pitch> = {}): Omit<Pitch, "id" | "createdAt" | "updatedAt"> {
    const sequence = this.nextSequence("pitch");
    const genre = faker.helpers.arrayElement([
      "Drama", "Comedy", "Thriller", "Sci-Fi", "Horror", "Romance", "Action", "Documentary"
    ]);
    const title = this.generatePitchTitle(genre);
    
    return {
      userId: creatorId,
      title: overrides.title || title,
      logline: overrides.logline || this.generateLogline(title, genre),
      description: faker.lorem.paragraphs(3),
      genre,
      format: faker.helpers.arrayElement(["Feature Film", "TV Series", "Documentary", "Short Film"]),
      formatCategory: "Feature Film",
      formatSubtype: "Dramatic Feature",
      customFormat: null,
      shortSynopsis: faker.lorem.paragraphs(1),
      longSynopsis: faker.lorem.paragraphs(4),
      opener: faker.lorem.paragraphs(2),
      premise: faker.lorem.sentence(20),
      targetAudience: faker.helpers.arrayElement([
        "18-35 Adults", "25-54 Adults", "Teens", "Family", "Niche Adult"
      ]),
      characters: JSON.stringify(this.generateCharacters()),
      themes: faker.helpers.arrayElements([
        "Love", "Betrayal", "Redemption", "Coming of Age", "Power", "Justice", "Family", "Identity"
      ], { min: 2, max: 4 }).join(", "),
      worldDescription: faker.lorem.paragraphs(2),
      episodeBreakdown: null,
      budgetRange: faker.helpers.arrayElement(["low", "medium", "high"]),
      budgetBracket: faker.helpers.arrayElement(["under_1m", "1m_5m", "5m_15m"]),
      estimatedBudget: faker.number.int({ min: 500000, max: 15000000 }).toString(),
      stage: faker.helpers.arrayElement(["concept", "development", "pre-production", "production"]),
      videoUrl: faker.datatype.boolean(0.3) ? faker.internet.url() : null,
      posterUrl: faker.datatype.boolean(0.6) ? faker.image.url() : null,
      pitchDeckUrl: faker.datatype.boolean(0.8) ? faker.internet.url() : null,
      additionalMaterials: JSON.stringify([]),
      visibility: faker.helpers.arrayElement(["public", "private", "unlisted"]),
      status: faker.helpers.arrayElement(["active", "draft", "under_review"]),
      viewCount: faker.number.int({ min: 0, max: 1000 }),
      likeCount: faker.number.int({ min: 0, max: 100 }),
      commentCount: faker.number.int({ min: 0, max: 50 }),
      ndaCount: faker.number.int({ min: 0, max: 20 }),
      titleImage: faker.datatype.boolean(0.5) ? faker.image.url() : null,
      lookbookUrl: faker.datatype.boolean(0.4) ? faker.internet.url() : null,
      scriptUrl: faker.datatype.boolean(0.6) ? faker.internet.url() : null,
      trailerUrl: faker.datatype.boolean(0.3) ? faker.internet.url() : null,
      additionalMedia: JSON.stringify([]),
      productionTimeline: faker.lorem.sentences(3),
      requireNda: faker.datatype.boolean(0.7),
      seekingInvestment: faker.datatype.boolean(0.8),
      productionStage: faker.helpers.arrayElement(["concept", "development", "pre-production", "production", "post-production"]),
      publishedAt: faker.date.past(),
      visibilitySettings: JSON.stringify({
        showBudget: faker.datatype.boolean(0.6),
        showLocation: faker.datatype.boolean(0.4),
        showCharacters: true,
        showShortSynopsis: true,
      }),
      aiUsed: faker.datatype.boolean(0.2),
      aiTools: faker.datatype.boolean(0.2) ? ["ChatGPT", "Claude"] : [],
      aiDisclosure: faker.datatype.boolean(0.2) ? "AI assisted with initial story structure brainstorming" : null,
      shareCount: faker.number.int({ min: 0, max: 30 }),
      feedback: JSON.stringify([]),
      tags: faker.helpers.arrayElements([
        "indie", "commercial", "festival", "streaming", "international", "first-time-director"
      ], { min: 0, max: 3 }),
      archived: false,
      archivedAt: null,
      metadata: JSON.stringify({
        lastViewedAt: faker.date.recent(),
        searchKeywords: [],
      }),
      ...overrides,
    } as Omit<Pitch, "id" | "createdAt" | "updatedAt">;
  }

  private generatePitchTitle(genre: string): string {
    const titles = {
      Drama: ["The Last Hope", "Broken Dreams", "Second Chances", "The Weight of Truth"],
      Comedy: ["Chaos Theory", "The Misadventure", "Laugh Track", "Comedy of Errors"],
      Thriller: ["Dark Waters", "The Chase", "Final Hour", "Edge of Midnight"],
      "Sci-Fi": ["Beyond the Stars", "Quantum Leap", "The Awakening", "Future Past"],
      Horror: ["The Haunting", "Nightmare's End", "Dark Shadows", "The Descent"],
      Romance: ["Finding Love", "Heart's Desire", "The Perfect Match", "Love Actually"],
      Action: ["High Stakes", "The Mission", "Breaking Point", "Final Stand"],
    };
    
    const genreArray = titles[genre as keyof typeof titles] || titles.Drama;
    return faker.helpers.arrayElement(genreArray);
  }

  private generateLogline(title: string, genre: string): string {
    const templates = {
      Drama: "When [protagonist] faces [challenge], they must [action] or lose [stakes].",
      Comedy: "A [character type] gets into [situation] and must [resolve] before [consequence].",
      Thriller: "[Protagonist] discovers [secret/danger] and has [time limit] to [prevent disaster].",
      "Sci-Fi": "In [setting], [protagonist] must [mission] to save [what's at stake].",
      Horror: "[Victim/s] are trapped in [location] with [threat] and must [escape/survive].",
    };
    
    // Generate contextual loglines based on genre
    const template = templates[genre as keyof typeof templates] || templates.Drama;
    return faker.lorem.sentence(15);
  }

  private generateCharacters(): Array<{ name: string; description: string; role: string }> {
    const count = faker.number.int({ min: 2, max: 5 });
    const characters = [];
    
    for (let i = 0; i < count; i++) {
      characters.push({
        name: faker.person.fullName(),
        description: faker.lorem.sentences(2),
        role: faker.helpers.arrayElement(["Protagonist", "Antagonist", "Supporting", "Comic Relief"]),
      });
    }
    
    return characters;
  }

  // ==================== NDA FACTORIES ====================

  nda(pitchId: number, userId: number, overrides: Partial<NDA> = {}): Omit<NDA, "id" | "createdAt" | "updatedAt"> {
    return {
      pitchId,
      userId,
      signerId: userId,
      status: faker.helpers.arrayElement(["pending", "signed", "rejected", "expired"]),
      ndaType: faker.helpers.arrayElement(["basic", "standard", "custom"]),
      accessGranted: faker.datatype.boolean(0.8),
      signedAt: faker.date.past(),
      expiresAt: faker.date.future({ years: 1 }),
      documentUrl: faker.internet.url(),
      ...overrides,
    } as Omit<NDA, "id" | "createdAt" | "updatedAt">;
  }

  // ==================== INVESTMENT FACTORIES ====================

  investment(investorId: number, pitchId: number, overrides: Partial<Investment> = {}): Investment {
    const amount = faker.number.int({ min: 50000, max: 5000000 });
    const currentValue = amount * faker.number.float({ min: 0.8, max: 1.5 });
    
    return {
      id: faker.number.int({ min: 1, max: 999999 }),
      investorId,
      pitchId,
      amount: amount.toString(),
      status: faker.helpers.arrayElement(["pending", "approved", "active", "completed", "cancelled"]),
      terms: faker.lorem.sentences(3),
      currentValue: currentValue.toString(),
      documents: [],
      notes: faker.lorem.paragraph(),
      roiPercentage: ((currentValue - amount) / amount * 100).toFixed(2),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    } as Investment;
  }

  // ==================== MESSAGE FACTORIES ====================

  message(senderId: number, receiverId: number, overrides: Partial<Message> = {}): Omit<Message, "id" | "createdAt"> {
    return {
      conversationId: faker.number.int({ min: 1, max: 1000 }),
      senderId,
      receiverId,
      subject: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(2),
      messageType: "text",
      pitchId: faker.datatype.boolean(0.6) ? faker.number.int({ min: 1, max: 100 }) : null,
      read: faker.datatype.boolean(0.4),
      isRead: faker.datatype.boolean(0.4),
      metadata: JSON.stringify({}),
      offPlatformRequested: false,
      offPlatformApproved: false,
      sentAt: faker.date.past(),
      readAt: faker.datatype.boolean(0.4) ? faker.date.recent() : null,
      ...overrides,
    } as Omit<Message, "id" | "createdAt">;
  }

  // ==================== SCENARIO BUILDERS ====================

  async buildScenario(scenario: TestScenario): Promise<{
    users: User[];
    pitches: Pitch[];
    ndas: NDA[];
    messages: Message[];
    investments: Investment[];
  }> {
    this.resetSequences();
    
    switch (scenario) {
      case "empty_state":
        return { users: [], pitches: [], ndas: [], messages: [], investments: [] };
        
      case "basic_user_flow":
        return this.buildBasicUserFlow();
        
      case "creator_with_pitches":
        return this.buildCreatorWithPitches();
        
      case "investor_with_portfolio":
        return this.buildInvestorWithPortfolio();
        
      case "active_nda_workflow":
        return this.buildActiveNDAWorkflow();
        
      case "multi_user_collaboration":
        return this.buildMultiUserCollaboration();
        
      case "high_volume_data":
        return this.buildHighVolumeData();
        
      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }

  private async buildBasicUserFlow() {
    const users = [
      { id: 1, ...this.creator(), createdAt: new Date(), updatedAt: new Date() } as User,
      { id: 2, ...this.investor(), createdAt: new Date(), updatedAt: new Date() } as User,
    ];
    
    const pitches = [
      { id: 1, ...this.pitch(1), createdAt: new Date(), updatedAt: new Date() } as Pitch,
    ];
    
    return { users, pitches, ndas: [], messages: [], investments: [] };
  }

  private async buildCreatorWithPitches() {
    const users = [
      { id: 1, ...this.creator(), createdAt: new Date(), updatedAt: new Date() } as User,
    ];
    
    const pitches = Array.from({ length: 3 }, (_, i) => ({
      id: i + 1,
      ...this.pitch(1),
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as Pitch[];
    
    return { users, pitches, ndas: [], messages: [], investments: [] };
  }

  private async buildInvestorWithPortfolio() {
    const users = [
      { id: 1, ...this.creator(), createdAt: new Date(), updatedAt: new Date() } as User,
      { id: 2, ...this.investor(), createdAt: new Date(), updatedAt: new Date() } as User,
    ];
    
    const pitches = Array.from({ length: 2 }, (_, i) => ({
      id: i + 1,
      ...this.pitch(1),
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as Pitch[];
    
    const investments = [
      this.investment(2, 1),
      this.investment(2, 2),
    ];
    
    return { users, pitches, ndas: [], messages: [], investments };
  }

  private async buildActiveNDAWorkflow() {
    const users = [
      { id: 1, ...this.creator(), createdAt: new Date(), updatedAt: new Date() } as User,
      { id: 2, ...this.investor(), createdAt: new Date(), updatedAt: new Date() } as User,
      { id: 3, ...this.production(), createdAt: new Date(), updatedAt: new Date() } as User,
    ];
    
    const pitches = [
      { id: 1, ...this.pitch(1, { requireNda: true }), createdAt: new Date(), updatedAt: new Date() } as Pitch,
    ];
    
    const ndas = [
      { id: 1, ...this.nda(1, 2, { status: "signed" }), createdAt: new Date(), updatedAt: new Date() } as NDA,
      { id: 2, ...this.nda(1, 3, { status: "pending" }), createdAt: new Date(), updatedAt: new Date() } as NDA,
    ];
    
    return { users, pitches, ndas, messages: [], investments: [] };
  }

  private async buildMultiUserCollaboration() {
    const users = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      ...((i < 2) ? this.creator() : (i < 4) ? this.investor() : this.production()),
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as User[];
    
    const pitches = Array.from({ length: 3 }, (_, i) => ({
      id: i + 1,
      ...this.pitch(i + 1),
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as Pitch[];
    
    const messages = [
      { id: 1, ...this.message(3, 1), createdAt: new Date() } as Message,
      { id: 2, ...this.message(4, 2), createdAt: new Date() } as Message,
    ];
    
    return { users, pitches, ndas: [], messages, investments: [] };
  }

  private async buildHighVolumeData() {
    const users = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      ...((i % 3 === 0) ? this.creator() : (i % 3 === 1) ? this.investor() : this.production()),
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as User[];
    
    const pitches = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      ...this.pitch(Math.floor(Math.random() * 17) + 1), // Random creator (first 17 users are creators)
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as Pitch[];
    
    return { users, pitches, ndas: [], messages: [], investments: [] };
  }

  // ==================== DATABASE MANAGEMENT ====================

  static async snapshot(): Promise<DatabaseSnapshot> {
    // This would integrate with actual database to create snapshots
    return {
      id: faker.string.uuid(),
      timestamp: new Date(),
      tables: {},
      metadata: {
        userCount: 0,
        pitchCount: 0,
        ndaCount: 0,
      },
    };
  }

  static async restore(snapshot: DatabaseSnapshot): Promise<void> {
    // This would restore database from snapshot
    console.log(`Restoring database snapshot: ${snapshot.id}`);
  }

  // ==================== UTILITY METHODS ====================

  static seed(value: number): void {
    faker.seed(value);
  }

  static reset(): void {
    faker.seed(12345);
    EnhancedTestDataFactory.instance = undefined as any;
  }
}

// Convenience export
export const TestFactory = EnhancedTestDataFactory.getInstance();