#!/usr/bin/env -S deno run --allow-all

/**
 * Neon PostgreSQL Database Seeding Script
 * Creates comprehensive test data for all portal types and scenarios
 * Usage: deno run --allow-all seed-test-data.ts [--mode=full|demo|minimal|cleanup]
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  users, pitches, follows, ndas, messages, pitchViews, notifications, 
  portfolio, watchlist, sessions, analyticsEvents, ndaRequests, 
  pitchLikes, pitchSaves, investments, reviews, calendarEvents, 
  savedPitches, infoRequests, pitchDocuments, subscriptionHistory,
  paymentMethods, emailPreferences, userCredits, creditTransactions
} from "./src/db/schema.ts";

// Configuration
const DATABASE_URL = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

// Database connection
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Logging utility
function log(level: string, message: string) {
  const timestamp = new Date().toISOString();
  const colorMap: Record<string, string> = {
    'INFO': colors.blue,
    'SUCCESS': colors.green,
    'WARN': colors.yellow,
    'ERROR': colors.red,
  };
  
  console.log(`${colorMap[level] || ''}[${timestamp}] [${level}] ${message}${colors.reset}`);
}

// Utility functions
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Test data generators
class TestDataGenerator {
  private userIds: number[] = [];
  private pitchIds: number[] = [];
  private creatorIds: number[] = [];
  private investorIds: number[] = [];
  private productionIds: number[] = [];

  // User generation
  async createTestUsers(count: number = 50) {
    log('INFO', `Creating ${count} test users...`);
    
    const userTypes = ['creator', 'investor', 'production', 'viewer'];
    const subscriptionTiers = ['free', 'basic', 'pro', 'premium'];
    
    const testUsers = [];
    
    // Create demo users first
    const demoUsers = [
      {
        email: 'alex.creator@demo.com',
        username: 'alex_creator',
        password: 'Demo123',
        passwordHash: '$2b$10$dummyhashforseedingpurposes',
        userType: 'creator',
        firstName: 'Alex',
        lastName: 'Creative',
        bio: 'Award-winning filmmaker with 10+ years in the industry. Passionate about bringing unique stories to life.',
        location: 'Los Angeles, CA',
        subscriptionTier: 'pro',
        emailVerified: true,
        companyVerified: true,
        companyName: 'Creative Studios LLC',
        companyWebsite: 'https://creativestudios.com',
      },
      {
        email: 'sarah.investor@demo.com',
        username: 'sarah_investor',
        password: 'Demo123',
        passwordHash: '$2b$10$dummyhashforseedingpurposes',
        userType: 'investor',
        firstName: 'Sarah',
        lastName: 'Capital',
        bio: 'Investment professional specializing in entertainment and media ventures.',
        location: 'New York, NY',
        subscriptionTier: 'premium',
        emailVerified: true,
        companyVerified: true,
        companyName: 'MediaVenture Capital',
        companyWebsite: 'https://mediaventure.com',
      },
      {
        email: 'stellar.production@demo.com',
        username: 'stellar_production',
        password: 'Demo123',
        passwordHash: '$2b$10$dummyhashforseedingpurposes',
        userType: 'production',
        firstName: 'Stellar',
        lastName: 'Productions',
        bio: 'Independent production company focused on innovative storytelling and emerging talent.',
        location: 'Atlanta, GA',
        subscriptionTier: 'premium',
        emailVerified: true,
        companyVerified: true,
        companyName: 'Stellar Productions Inc.',
        companyWebsite: 'https://stellarproductions.com',
      },
    ];
    
    testUsers.push(...demoUsers);
    
    // Generate additional random users
    for (let i = 0; i < count - 3; i++) {
      const userType = randomChoice(userTypes);
      const firstName = randomChoice(['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Chris', 'Emma', 'James', 'Rachel']);
      const lastName = randomChoice(['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']);
      
      testUsers.push({
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@test.com`,
        username: `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${i}`,
        password: 'TestPassword123',
        passwordHash: '$2b$10$dummyhashforseedingpurposes',
        userType,
        firstName,
        lastName,
        bio: `Test bio for ${firstName} ${lastName}. ${randomChoice(['Creative', 'Innovative', 'Experienced', 'Passionate'])} professional in the entertainment industry.`,
        location: randomChoice(['Los Angeles, CA', 'New York, NY', 'Atlanta, GA', 'Vancouver, BC', 'London, UK', 'Sydney, AU']),
        subscriptionTier: randomChoice(subscriptionTiers),
        emailVerified: Math.random() > 0.2,
        companyVerified: userType !== 'viewer' && Math.random() > 0.5,
        companyName: userType !== 'viewer' ? `${firstName} ${lastName} ${randomChoice(['Studios', 'Productions', 'Entertainment', 'Media'])}` : null,
        companyWebsite: userType !== 'viewer' ? `https://${firstName.toLowerCase()}${lastName.toLowerCase()}.com` : null,
        createdAt: randomDate(new Date(2023, 0, 1), new Date()),
      });
    }
    
    const insertedUsers = await db.insert(users).values(testUsers).returning({ id: users.id, userType: users.userType });
    
    // Categorize users by type
    insertedUsers.forEach(user => {
      this.userIds.push(user.id);
      switch (user.userType) {
        case 'creator':
          this.creatorIds.push(user.id);
          break;
        case 'investor':
          this.investorIds.push(user.id);
          break;
        case 'production':
          this.productionIds.push(user.id);
          break;
      }
    });
    
    log('SUCCESS', `Created ${insertedUsers.length} users (${this.creatorIds.length} creators, ${this.investorIds.length} investors, ${this.productionIds.length} production companies)`);
  }

  // Pitch generation
  async createTestPitches(count: number = 30) {
    log('INFO', `Creating ${count} test pitches...`);
    
    if (this.creatorIds.length === 0) {
      log('ERROR', 'No creators available. Create users first.');
      return;
    }
    
    const genres = ['Drama', 'Comedy', 'Thriller', 'Horror', 'Sci-Fi', 'Romance', 'Action', 'Documentary', 'Animation', 'Mystery'];
    const formats = ['Feature Film', 'Short Film', 'TV Series', 'Mini Series', 'Web Series', 'Documentary', 'Commercial', 'Music Video'];
    const budgetBrackets = ['Under $100K', '$100K - $500K', '$500K - $1M', '$1M - $5M', '$5M - $10M', '$10M+'];
    const statuses = ['active', 'draft', 'under_review', 'approved', 'archived'];
    const productionStages = ['concept', 'development', 'pre-production', 'production', 'post-production', 'completed'];
    
    const testPitches = [];
    
    const samplePitches = [
      {
        title: 'The Last Signal',
        logline: 'When Earth receives its final transmission from a dying alien civilization, a team of scientists races against time to decode the message that could save humanity.',
        genre: 'Sci-Fi',
        format: 'Feature Film',
        shortSynopsis: 'A gripping sci-fi thriller that explores themes of communication, survival, and hope in the face of extinction.',
        longSynopsis: 'Dr. Elena Vasquez leads a team of linguists and scientists at SETI when they intercept what appears to be a final transmission from an advanced alien civilization. As they work to decode the complex message, they discover it contains warnings about an approaching cosmic threat that has already destroyed the senders\' world. With only months to prepare, humanity must unite to implement the aliens\' survival strategy, leading to a race against time that will determine the fate of our species.',
        budgetBracket: '$5M - $10M',
        estimatedBudget: '7500000.00',
        requireNda: true,
        seekingInvestment: true,
        productionStage: 'development',
      },
      {
        title: 'Midnight Diner Chronicles',
        logline: 'In a 24-hour diner that exists between worlds, a mysterious cook serves more than food—he serves second chances to lost souls.',
        genre: 'Drama',
        format: 'TV Series',
        shortSynopsis: 'A supernatural drama series exploring themes of redemption, human connection, and the power of storytelling.',
        longSynopsis: 'Set in a seemingly ordinary all-night diner that appears only to those who need it most, this anthology series follows different characters each episode as they encounter the enigmatic cook who seems to know exactly what they need—whether it\'s a meal, advice, or a chance to make things right. Each story is interconnected, revealing the deeper mysteries of the diner and its purpose as a waystation for souls seeking redemption.',
        budgetBracket: '$1M - $5M',
        estimatedBudget: '2500000.00',
        requireNda: false,
        seekingInvestment: true,
        productionStage: 'concept',
      },
      {
        title: 'The Memory Thief',
        logline: 'A con artist who steals memories for profit discovers she\'s stolen the wrong memory—one that could expose a conspiracy reaching the highest levels of government.',
        genre: 'Thriller',
        format: 'Feature Film',
        shortSynopsis: 'A high-concept thriller about memory, identity, and the price of truth in a near-future society.',
        longSynopsis: 'In 2035, Maya Chen operates on the fringes of society as a memory thief, using advanced neurotechnology to extract and sell specific memories to the highest bidder. When a routine job goes wrong and she accidentally steals a memory containing evidence of a government cover-up, she becomes a target. Racing against time while being hunted by both criminals and federal agents, Maya must decide whether to profit from the information or risk everything to expose the truth.',
        budgetBracket: '$10M+',
        estimatedBudget: '15000000.00',
        requireNda: true,
        seekingInvestment: true,
        productionStage: 'pre-production',
      },
    ];
    
    // Add sample pitches
    samplePitches.forEach((pitch, index) => {
      testPitches.push({
        ...pitch,
        userId: this.creatorIds[index % this.creatorIds.length],
        targetAudience: randomChoice(['General Audience', 'Young Adults', 'Adults 25-54', 'Mature Audience', 'Family Friendly']),
        characters: 'Compelling and diverse cast of characters with clear motivations and arcs.',
        themes: randomChoice(['Hope and Redemption', 'Identity and Belonging', 'Love and Loss', 'Good vs Evil', 'Coming of Age']),
        worldDescription: 'Richly detailed world with unique visual style and atmosphere.',
        visibility: 'public',
        status: randomChoice(statuses),
        viewCount: randomInt(0, 1000),
        likeCount: randomInt(0, 100),
        commentCount: randomInt(0, 50),
        ndaCount: randomInt(0, 10),
        shareCount: randomInt(0, 25),
        publishedAt: randomDate(new Date(2023, 0, 1), new Date()),
        createdAt: randomDate(new Date(2023, 0, 1), new Date()),
      });
    });
    
    // Generate additional random pitches
    for (let i = 0; i < count - samplePitches.length; i++) {
      const genre = randomChoice(genres);
      const format = randomChoice(formats);
      const title = `${randomChoice(['The', 'Dark', 'Silent', 'Hidden', 'Lost', 'Final', 'Secret', 'Broken'])} ${randomChoice(['Journey', 'Mystery', 'Awakening', 'Truth', 'Legacy', 'Dawn', 'Shadow', 'Light'])}`;
      
      testPitches.push({
        userId: randomChoice(this.creatorIds),
        title,
        logline: `A ${genre.toLowerCase()} ${format.toLowerCase()} about ${randomChoice(['love', 'betrayal', 'discovery', 'survival', 'redemption', 'revenge'])} in ${randomChoice(['a small town', 'the future', 'ancient times', 'modern day', 'a parallel universe'])}.`,
        genre,
        format,
        shortSynopsis: `An engaging ${genre.toLowerCase()} that explores themes of human nature and ${randomChoice(['family', 'friendship', 'loyalty', 'justice', 'truth'])}.`,
        longSynopsis: `This ${format.toLowerCase()} follows the journey of a protagonist who must overcome significant challenges while discovering important truths about themselves and the world around them. The story combines elements of ${genre.toLowerCase()} with deeper themes that resonate with audiences.`,
        targetAudience: randomChoice(['General Audience', 'Young Adults', 'Adults 25-54', 'Mature Audience', 'Family Friendly']),
        characters: 'Well-developed characters with clear motivations and compelling arcs.',
        themes: randomChoice(['Hope and Redemption', 'Identity and Belonging', 'Love and Loss', 'Good vs Evil', 'Coming of Age']),
        worldDescription: 'Immersive world with distinctive visual elements and atmosphere.',
        budgetBracket: randomChoice(budgetBrackets),
        estimatedBudget: String(randomInt(100000, 20000000)),
        visibility: randomChoice(['public', 'private', 'restricted']),
        status: randomChoice(statuses),
        viewCount: randomInt(0, 1000),
        likeCount: randomInt(0, 100),
        commentCount: randomInt(0, 50),
        ndaCount: randomInt(0, 10),
        shareCount: randomInt(0, 25),
        requireNda: Math.random() > 0.6,
        seekingInvestment: Math.random() > 0.4,
        productionStage: randomChoice(productionStages),
        publishedAt: Math.random() > 0.2 ? randomDate(new Date(2023, 0, 1), new Date()) : null,
        createdAt: randomDate(new Date(2023, 0, 1), new Date()),
      });
    }
    
    const insertedPitches = await db.insert(pitches).values(testPitches).returning({ id: pitches.id });
    this.pitchIds = insertedPitches.map(p => p.id);
    
    log('SUCCESS', `Created ${insertedPitches.length} test pitches`);
  }

  // Generate follows/relationships
  async createTestFollows(count: number = 100) {
    log('INFO', `Creating ${count} follow relationships...`);
    
    if (this.userIds.length === 0 || this.pitchIds.length === 0) {
      log('ERROR', 'No users or pitches available. Create them first.');
      return;
    }
    
    const testFollows = [];
    
    for (let i = 0; i < count; i++) {
      const followerId = randomChoice(this.userIds);
      const pitchId = randomChoice(this.pitchIds);
      
      // Find the creator of this pitch
      const pitch = await db.select({ userId: pitches.userId }).from(pitches).where(pitches.id = pitchId).limit(1);
      const creatorId = pitch[0]?.userId;
      
      if (creatorId && followerId !== creatorId) {
        testFollows.push({
          followerId,
          pitchId,
          creatorId,
          followedAt: randomDate(new Date(2023, 0, 1), new Date()),
        });
      }
    }
    
    // Remove duplicates
    const uniqueFollows = testFollows.filter((follow, index, self) =>
      index === self.findIndex(f => f.followerId === follow.followerId && f.pitchId === follow.pitchId)
    );
    
    if (uniqueFollows.length > 0) {
      await db.insert(follows).values(uniqueFollows);
      log('SUCCESS', `Created ${uniqueFollows.length} follow relationships`);
    }
  }

  // Generate NDA requests and signed NDAs
  async createTestNDAs(count: number = 20) {
    log('INFO', `Creating ${count} NDAs and requests...`);
    
    if (this.userIds.length === 0 || this.pitchIds.length === 0) {
      log('ERROR', 'No users or pitches available. Create them first.');
      return;
    }
    
    const testNDAs = [];
    const testNDARequests = [];
    
    for (let i = 0; i < count; i++) {
      const pitchId = randomChoice(this.pitchIds);
      const requesterId = randomChoice([...this.investorIds, ...this.productionIds]);
      
      // Get pitch owner
      const pitch = await db.select({ userId: pitches.userId }).from(pitches).where(pitches.id = pitchId).limit(1);
      const ownerId = pitch[0]?.userId;
      
      if (ownerId && requesterId !== ownerId) {
        const isSignedNDA = Math.random() > 0.3; // 70% signed, 30% requests
        
        if (isSignedNDA) {
          testNDAs.push({
            pitchId,
            userId: ownerId,
            signerId: requesterId,
            status: 'signed',
            ndaType: randomChoice(['basic', 'standard', 'custom']),
            accessGranted: true,
            signedAt: randomDate(new Date(2023, 0, 1), new Date()),
            expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)), // 1 year from now
            createdAt: randomDate(new Date(2023, 0, 1), new Date()),
          });
        } else {
          testNDARequests.push({
            pitchId,
            requesterId,
            ownerId,
            ndaType: randomChoice(['basic', 'standard', 'custom']),
            status: randomChoice(['pending', 'approved', 'rejected']),
            requestMessage: `I'm interested in learning more about this project for potential ${requesterId in this.investorIds ? 'investment' : 'production'} opportunities.`,
            requestedAt: randomDate(new Date(2023, 0, 1), new Date()),
          });
        }
      }
    }
    
    if (testNDAs.length > 0) {
      await db.insert(ndas).values(testNDAs);
      log('SUCCESS', `Created ${testNDAs.length} signed NDAs`);
    }
    
    if (testNDARequests.length > 0) {
      await db.insert(ndaRequests).values(testNDARequests);
      log('SUCCESS', `Created ${testNDARequests.length} NDA requests`);
    }
  }

  // Generate investments
  async createTestInvestments(count: number = 15) {
    log('INFO', `Creating ${count} test investments...`);
    
    if (this.investorIds.length === 0 || this.pitchIds.length === 0) {
      log('ERROR', 'No investors or pitches available. Create them first.');
      return;
    }
    
    const testInvestments = [];
    
    for (let i = 0; i < count; i++) {
      const investorId = randomChoice(this.investorIds);
      const pitchId = randomChoice(this.pitchIds);
      const amount = randomInt(10000, 1000000);
      
      testInvestments.push({
        investorId,
        pitchId,
        amount: String(amount),
        currentValue: String(amount * (0.8 + Math.random() * 0.4)), // ±20% of original
        status: randomChoice(['pending', 'active', 'completed', 'withdrawn']),
        terms: 'Standard investment terms with equity participation.',
        notes: `Investment made in ${new Date().getFullYear()} for promising project.`,
        createdAt: randomDate(new Date(2023, 0, 1), new Date()),
      });
    }
    
    await db.insert(investments).values(testInvestments);
    log('SUCCESS', `Created ${testInvestments.length} test investments`);
  }

  // Generate messages
  async createTestMessages(count: number = 50) {
    log('INFO', `Creating ${count} test messages...`);
    
    if (this.userIds.length < 2) {
      log('ERROR', 'Not enough users available. Create more users first.');
      return;
    }
    
    const messageTemplates = [
      'I\'m very interested in your project. Could we schedule a call to discuss further?',
      'Great work! I\'d love to learn more about the production timeline.',
      'This looks promising. What\'s your current funding status?',
      'I have some questions about the script. Would you be available for a meeting?',
      'Excellent concept! I think this could be a great fit for our production slate.',
      'Could you provide more details about the budget breakdown?',
      'I\'ve reviewed your pitch and I\'m impressed. Let\'s discuss next steps.',
      'This project aligns well with our investment criteria. Are you still seeking funding?',
    ];
    
    const testMessages = [];
    
    for (let i = 0; i < count; i++) {
      const senderId = randomChoice(this.userIds);
      let receiverId = randomChoice(this.userIds);
      
      // Ensure sender and receiver are different
      while (receiverId === senderId) {
        receiverId = randomChoice(this.userIds);
      }
      
      const pitchId = Math.random() > 0.3 ? randomChoice(this.pitchIds) : null;
      const sentAt = randomDate(new Date(2023, 0, 1), new Date());
      
      testMessages.push({
        senderId,
        receiverId,
        subject: `Re: ${pitchId ? 'Your Pitch' : 'General Inquiry'}`,
        content: randomChoice(messageTemplates),
        pitchId,
        isRead: Math.random() > 0.3,
        readAt: Math.random() > 0.3 ? randomDate(sentAt, new Date()) : null,
        sentAt,
      });
    }
    
    await db.insert(messages).values(testMessages);
    log('SUCCESS', `Created ${testMessages.length} test messages`);
  }

  // Generate notifications
  async createTestNotifications(count: number = 75) {
    log('INFO', `Creating ${count} test notifications...`);
    
    if (this.userIds.length === 0) {
      log('ERROR', 'No users available. Create users first.');
      return;
    }
    
    const notificationTypes = [
      'new_message', 'pitch_liked', 'nda_signed', 'investment_received',
      'follow_received', 'pitch_viewed', 'comment_added', 'profile_updated'
    ];
    
    const notificationTemplates = {
      'new_message': 'You have a new message',
      'pitch_liked': 'Someone liked your pitch',
      'nda_signed': 'An NDA was signed for your pitch',
      'investment_received': 'You received a new investment inquiry',
      'follow_received': 'Someone started following your work',
      'pitch_viewed': 'Your pitch was viewed',
      'comment_added': 'Someone commented on your pitch',
      'profile_updated': 'Your profile was successfully updated',
    };
    
    const testNotifications = [];
    
    for (let i = 0; i < count; i++) {
      const type = randomChoice(notificationTypes);
      const userId = randomChoice(this.userIds);
      const relatedId = this.pitchIds.length > 0 ? randomChoice(this.pitchIds) : null;
      
      testNotifications.push({
        userId,
        type,
        title: notificationTemplates[type],
        message: `${notificationTemplates[type]} - check your dashboard for details.`,
        relatedId,
        relatedType: relatedId ? 'pitch' : null,
        isRead: Math.random() > 0.4,
        createdAt: randomDate(new Date(2023, 0, 1), new Date()),
      });
    }
    
    await db.insert(notifications).values(testNotifications);
    log('SUCCESS', `Created ${testNotifications.length} test notifications`);
  }

  // Generate pitch views for analytics
  async createTestPitchViews(count: number = 200) {
    log('INFO', `Creating ${count} pitch view records...`);
    
    if (this.pitchIds.length === 0 || this.userIds.length === 0) {
      log('ERROR', 'No pitches or users available. Create them first.');
      return;
    }
    
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
      'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X)',
    ];
    
    const testViews = [];
    
    for (let i = 0; i < count; i++) {
      const pitchId = randomChoice(this.pitchIds);
      const viewerId = Math.random() > 0.3 ? randomChoice(this.userIds) : null; // 30% anonymous views
      
      testViews.push({
        pitchId,
        viewerId,
        ipAddress: `192.168.${randomInt(1, 255)}.${randomInt(1, 255)}`,
        viewType: randomChoice(['full', 'preview', 'thumbnail']),
        userAgent: randomChoice(userAgents),
        referrer: randomChoice(['direct', 'search', 'social', 'email', 'browse']),
        sessionId: generateRandomString(32),
        viewDuration: randomInt(10, 300), // seconds
        scrollDepth: randomInt(0, 100), // percentage
        clickedWatchThis: Math.random() > 0.8,
        viewedAt: randomDate(new Date(2023, 0, 1), new Date()),
      });
    }
    
    await db.insert(pitchViews).values(testViews);
    log('SUCCESS', `Created ${testViews.length} pitch view records`);
  }

  // Generate likes and saves
  async createTestEngagement(likesCount: number = 100, savesCount: number = 60) {
    log('INFO', `Creating ${likesCount} likes and ${savesCount} saves...`);
    
    if (this.pitchIds.length === 0 || this.userIds.length === 0) {
      log('ERROR', 'No pitches or users available. Create them first.');
      return;
    }
    
    const testLikes = [];
    const testSaves = [];
    
    // Generate likes
    for (let i = 0; i < likesCount; i++) {
      const pitchId = randomChoice(this.pitchIds);
      const userId = randomChoice(this.userIds);
      
      testLikes.push({
        pitchId,
        userId,
        createdAt: randomDate(new Date(2023, 0, 1), new Date()),
      });
    }
    
    // Generate saves
    for (let i = 0; i < savesCount; i++) {
      const pitchId = randomChoice(this.pitchIds);
      const userId = randomChoice(this.userIds);
      
      testSaves.push({
        pitchId,
        userId,
        createdAt: randomDate(new Date(2023, 0, 1), new Date()),
      });
    }
    
    // Remove duplicates
    const uniqueLikes = testLikes.filter((like, index, self) =>
      index === self.findIndex(l => l.pitchId === like.pitchId && l.userId === like.userId)
    );
    
    const uniqueSaves = testSaves.filter((save, index, self) =>
      index === self.findIndex(s => s.pitchId === save.pitchId && s.userId === save.userId)
    );
    
    if (uniqueLikes.length > 0) {
      await db.insert(pitchLikes).values(uniqueLikes);
      log('SUCCESS', `Created ${uniqueLikes.length} pitch likes`);
    }
    
    if (uniqueSaves.length > 0) {
      await db.insert(pitchSaves).values(uniqueSaves);
      log('SUCCESS', `Created ${uniqueSaves.length} pitch saves`);
    }
  }

  // Generate subscription history and payment methods
  async createTestSubscriptions() {
    log('INFO', 'Creating subscription history and payment methods...');
    
    if (this.userIds.length === 0) {
      log('ERROR', 'No users available. Create users first.');
      return;
    }
    
    const subscriptionHistoryData = [];
    const paymentMethodsData = [];
    
    // Create subscription history for users with paid tiers
    for (const userId of this.userIds.slice(0, 10)) { // First 10 users get subscription history
      const tiers = ['free', 'basic', 'pro', 'premium'];
      const currentTier = randomChoice(['basic', 'pro', 'premium']);
      
      subscriptionHistoryData.push({
        userId,
        previousTier: 'free',
        newTier: currentTier,
        action: 'upgrade',
        amount: currentTier === 'basic' ? '9.99' : currentTier === 'pro' ? '29.99' : '99.99',
        currency: 'usd',
        billingInterval: 'monthly',
        periodStart: randomDate(new Date(2023, 0, 1), new Date()),
        periodEnd: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)),
        status: 'active',
        stripeSubscriptionId: `sub_${generateRandomString(24)}`,
        stripePriceId: `price_${generateRandomString(24)}`,
        timestamp: randomDate(new Date(2023, 0, 1), new Date()),
      });
      
      // Add payment method
      paymentMethodsData.push({
        userId,
        stripePaymentMethodId: `pm_${generateRandomString(24)}`,
        stripeCustomerId: `cus_${generateRandomString(14)}`,
        type: 'card',
        brand: randomChoice(['visa', 'mastercard', 'amex']),
        lastFour: String(randomInt(1000, 9999)),
        expMonth: randomInt(1, 12),
        expYear: randomInt(2024, 2030),
        isDefault: true,
        isActive: true,
        billingName: 'Test User',
        billingEmail: `user${userId}@test.com`,
      });
    }
    
    if (subscriptionHistoryData.length > 0) {
      await db.insert(subscriptionHistory).values(subscriptionHistoryData);
      log('SUCCESS', `Created ${subscriptionHistoryData.length} subscription history records`);
    }
    
    if (paymentMethodsData.length > 0) {
      await db.insert(paymentMethods).values(paymentMethodsData);
      log('SUCCESS', `Created ${paymentMethodsData.length} payment methods`);
    }
  }

  // Cleanup all test data
  async cleanup() {
    log('INFO', 'Cleaning up test data...');
    
    try {
      // Delete in reverse dependency order
      await db.delete(pitchViews);
      await db.delete(pitchLikes);
      await db.delete(pitchSaves);
      await db.delete(notifications);
      await db.delete(messages);
      await db.delete(follows);
      await db.delete(ndas);
      await db.delete(ndaRequests);
      await db.delete(investments);
      await db.delete(subscriptionHistory);
      await db.delete(paymentMethods);
      await db.delete(sessions);
      await db.delete(pitches);
      await db.delete(users);
      
      log('SUCCESS', 'All test data cleaned up successfully');
    } catch (error) {
      log('ERROR', `Cleanup failed: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  const mode = Deno.args[0] || '--mode=full';
  
  log('INFO', '=== Neon PostgreSQL Database Seeding ===');
  log('INFO', `Mode: ${mode}`);
  log('INFO', `Timestamp: ${new Date().toISOString()}`);
  log('INFO', `Database: ${DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown'}`);
  
  const generator = new TestDataGenerator();
  
  try {
    switch (mode) {
      case '--mode=full':
      case 'full':
        log('INFO', 'Running full database seeding...');
        await generator.createTestUsers(50);
        await generator.createTestPitches(30);
        await generator.createTestFollows(100);
        await generator.createTestNDAs(20);
        await generator.createTestInvestments(15);
        await generator.createTestMessages(50);
        await generator.createTestNotifications(75);
        await generator.createTestPitchViews(200);
        await generator.createTestEngagement(100, 60);
        await generator.createTestSubscriptions();
        break;
        
      case '--mode=demo':
      case 'demo':
        log('INFO', 'Creating demo data only...');
        await generator.createTestUsers(10);
        await generator.createTestPitches(6);
        await generator.createTestFollows(15);
        await generator.createTestNDAs(5);
        await generator.createTestInvestments(3);
        await generator.createTestMessages(10);
        await generator.createTestNotifications(20);
        await generator.createTestPitchViews(50);
        await generator.createTestEngagement(25, 15);
        break;
        
      case '--mode=minimal':
      case 'minimal':
        log('INFO', 'Creating minimal test data...');
        await generator.createTestUsers(5);
        await generator.createTestPitches(3);
        await generator.createTestFollows(5);
        await generator.createTestMessages(5);
        break;
        
      case '--mode=cleanup':
      case 'cleanup':
        await generator.cleanup();
        break;
        
      default:
        log('ERROR', 'Invalid mode. Use: full, demo, minimal, or cleanup');
        console.log('Usage: deno run --allow-all seed-test-data.ts [--mode=full|demo|minimal|cleanup]');
        console.log('  full    - Create comprehensive test data (default)');
        console.log('  demo    - Create demo data for showcasing');
        console.log('  minimal - Create minimal test data');
        console.log('  cleanup - Remove all test data');
        Deno.exit(1);
    }
    
    log('SUCCESS', '=== Database seeding completed successfully ===');
    
  } catch (error) {
    log('ERROR', `Database seeding failed: ${error.message}`);
    console.error(error);
    Deno.exit(1);
  } finally {
    await sql.end();
  }
}

// Run if this is the main module
if (import.meta.main) {
  await main();
}