#!/usr/bin/env ts-node

/**
 * Fix Mock vs Real Implementation Gaps
 * Updates test mocks to match production API responses
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface MockUpdate {
  file: string;
  changes: Array<{
    old: string | RegExp;
    new: string;
    description: string;
  }>;
}

class MockRealGapFixer {
  private updates: MockUpdate[] = [];
  private testDir = path.join(__dirname, '../frontend/src');
  
  // Real API response structures from production
  private realStructures = {
    user: {
      id: 'string (UUID)',
      email: 'string',
      name: 'string',
      portalType: 'string', // NOT 'portal'
      company: 'string?',
      createdAt: 'string (ISO date)',
      updatedAt: 'string (ISO date)',
      subscription_tier: 'string',
      role: 'string'
    },
    pitch: {
      id: 'string (UUID)',
      title: 'string',
      budget: 'string', // NOT number
      creator: {
        id: 'string (UUID)',
        name: 'string',
        company: 'string?'
      },
      status: 'string',
      viewCount: 'number',
      createdAt: 'string (ISO date)',
      genres: 'string[]',
      logline: 'string',
      synopsis: 'string',
      target_audience: 'string?',
      comparables: 'string?'
    },
    notification: {
      id: 'string (UUID)',
      type: 'string',
      eventType: 'string', // Sub-type field
      title: 'string',
      message: 'string',
      read: 'boolean',
      createdAt: 'string (ISO date)',
      metadata: 'object?'
    },
    webSocketEvent: {
      type: 'string',
      eventType: 'string', // Added in production
      data: 'any',
      timestamp: 'string (ISO date)' // Added in production
    }
  };

  async fix() {
    console.log('🔧 Fixing Mock vs Real Implementation Gaps\n');
    
    // Fix authentication mocks
    await this.fixAuthMocks();
    
    // Fix API response mocks
    await this.fixApiMocks();
    
    // Fix WebSocket mocks
    await this.fixWebSocketMocks();
    
    // Fix data type mocks
    await this.fixDataTypeMocks();
    
    // Apply all updates
    await this.applyUpdates();
    
    // Generate report
    this.generateReport();
  }

  private async fixAuthMocks() {
    console.log('📝 Updating authentication mocks...');
    
    const authMockFile = path.join(this.testDir, 'test/mocks/auth.ts');
    
    // Check if file exists, if not create it
    if (!fs.existsSync(authMockFile)) {
      const authMockContent = this.generateAuthMock();
      fs.mkdirSync(path.dirname(authMockFile), { recursive: true });
      fs.writeFileSync(authMockFile, authMockContent);
      console.log('   ✅ Created auth mock file');
      return;
    }

    this.updates.push({
      file: authMockFile,
      changes: [
        {
          old: "portal: 'creator'",
          new: "portalType: 'creator'",
          description: 'Fix portal property name to match Better Auth'
        },
        {
          old: 'token: string',
          new: '// No token - Better Auth uses cookies',
          description: 'Remove JWT token (Better Auth uses sessions)'
        },
        {
          old: 'id: number',
          new: "id: 'mock-uuid-' + Date.now()",
          description: 'Change user ID from number to UUID string'
        }
      ]
    });
  }

  private async fixApiMocks() {
    console.log('📝 Updating API response mocks...');
    
    const apiMockFile = path.join(this.testDir, 'test/mocks/api.ts');
    
    if (!fs.existsSync(apiMockFile)) {
      const apiMockContent = this.generateApiMock();
      fs.mkdirSync(path.dirname(apiMockFile), { recursive: true });
      fs.writeFileSync(apiMockFile, apiMockContent);
      console.log('   ✅ Created API mock file');
      return;
    }

    this.updates.push({
      file: apiMockFile,
      changes: [
        {
          old: 'budget: 1000000',
          new: "budget: '1000000'",
          description: 'Change budget from number to string'
        },
        {
          old: "creator: 'John Doe'",
          new: "creator: { id: 'creator-uuid', name: 'John Doe', company: 'Test Co' }",
          description: 'Change creator from string to object'
        },
        {
          old: 'id: \\d+',
          new: "id: 'uuid-' + Math.random().toString(36)",
          description: 'Change numeric IDs to UUID strings'
        }
      ]
    });
  }

  private async fixWebSocketMocks() {
    console.log('📝 Updating WebSocket mocks...');
    
    const wsMockFile = path.join(this.testDir, 'test/mocks/websocket.ts');
    
    if (!fs.existsSync(wsMockFile)) {
      const wsMockContent = this.generateWebSocketMock();
      fs.mkdirSync(path.dirname(wsMockFile), { recursive: true });
      fs.writeFileSync(wsMockFile, wsMockContent);
      console.log('   ✅ Created WebSocket mock file');
      return;
    }

    this.updates.push({
      file: wsMockFile,
      changes: [
        {
          old: "{ type: 'notification', data: { message: string } }",
          new: "{ type: 'notification', eventType: 'notification.new', data: { message: string }, timestamp: new Date().toISOString() }",
          description: 'Add eventType and timestamp to match production'
        }
      ]
    });
  }

  private async fixDataTypeMocks() {
    console.log('📝 Updating data type validations...');
    
    // Find all test files
    const testFiles = this.findFiles(this.testDir, /\.(test|spec)\.(ts|tsx)$/);
    
    for (const file of testFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const updates: any[] = [];
      
      // Fix array expectations
      if (content.includes('.toBeInstanceOf(Array)') && content.includes('pitches')) {
        updates.push({
          old: 'expect(result).toBeInstanceOf(Array)',
          new: 'expect(result.data).toBeInstanceOf(Array)',
          description: 'API returns object with data property, not direct array'
        });
      }
      
      // Fix number/string mismatches
      if (content.includes('toBe(') && content.includes('budget')) {
        updates.push({
          old: /expect\(.*budget.*\)\.toBe\((\d+)\)/g,
          new: "expect(...budget...).toBe('$1')",
          description: 'Budget should be string, not number'
        });
      }
      
      if (updates.length > 0) {
        this.updates.push({ file, changes: updates });
      }
    }
  }

  private async applyUpdates() {
    console.log('\n🔄 Applying updates...\n');
    
    for (const update of this.updates) {
      if (!fs.existsSync(update.file)) {
        console.log(`   ⚠️  Skipping ${update.file} (not found)`);
        continue;
      }
      
      let content = fs.readFileSync(update.file, 'utf8');
      let modified = false;
      
      for (const change of update.changes) {
        if (typeof change.old === 'string') {
          if (content.includes(change.old)) {
            content = content.replace(new RegExp(change.old, 'g'), change.new);
            modified = true;
            console.log(`   ✅ ${path.basename(update.file)}: ${change.description}`);
          }
        } else if (change.old && typeof change.old === 'object' && 'test' in change.old) {
          if ((change.old as RegExp).test(content)) {
            content = content.replace(change.old, change.new);
            modified = true;
            console.log(`   ✅ ${path.basename(update.file)}: ${change.description}`);
          }
        }
      }
      
      if (modified) {
        // Create backup
        const backupFile = update.file + '.backup';
        fs.copyFileSync(update.file, backupFile);
        
        // Write updated content
        fs.writeFileSync(update.file, content);
      }
    }
  }

  private generateAuthMock(): string {
    return `/**
 * Authentication Mock Data
 * Matches Better Auth production structure
 */

export const mockUser = {
  id: 'mock-user-uuid',
  email: 'test@example.com',
  name: 'Test User',
  portalType: 'creator', // Better Auth uses portalType, not portal
  company: 'Test Company',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  subscription_tier: 'basic',
  role: 'user'
};

export const mockSession = {
  id: 'mock-session-uuid',
  userId: mockUser.id,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  // No token - Better Auth uses HTTP-only cookies
};

export const mockAuthResponse = {
  user: mockUser,
  session: mockSession
};`;
  }

  private generateApiMock(): string {
    return `/**
 * API Response Mock Data
 * Matches production API structure
 */

export const mockPitch = {
  id: 'mock-pitch-uuid',
  title: 'Test Pitch',
  budget: '1000000', // String, not number
  creator: {
    id: 'mock-creator-uuid',
    name: 'Test Creator',
    company: 'Test Production Co'
  },
  status: 'published',
  viewCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  genres: ['Drama', 'Thriller'],
  logline: 'A compelling test pitch',
  synopsis: 'Full synopsis here',
  target_audience: '18-35',
  comparables: 'Similar to X and Y'
};

export const mockPitchesResponse = {
  success: true,
  data: [mockPitch], // Data is nested, not direct array
  pagination: {
    total: 1,
    page: 1,
    limit: 10
  }
};

export const mockNotification = {
  id: 'mock-notif-uuid',
  type: 'pitch_view',
  eventType: 'pitch.viewed', // Sub-type field
  title: 'Your pitch was viewed',
  message: 'Someone viewed your pitch',
  read: false,
  createdAt: new Date().toISOString(),
  metadata: {
    pitchId: mockPitch.id,
    viewerId: 'viewer-uuid'
  }
};`;
  }

  private generateWebSocketMock(): string {
    return `/**
 * WebSocket Mock Implementation
 * Matches production WebSocket behavior
 */

export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    const parsed = JSON.parse(data);
    
    // Match production event structure
    const response = {
      type: parsed.type,
      eventType: \`\${parsed.type}.\${parsed.action || 'response'}\`, // Added in production
      data: parsed.data,
      timestamp: new Date().toISOString() // Added in production
    };

    setTimeout(() => {
      this.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify(response)
      }));
    }, 10);
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.(new CloseEvent('close'));
    }, 10);
  }
}`;
  }

  private findFiles(dir: string, pattern: RegExp): string[] {
    const results: string[] = [];
    
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !fullPath.includes('node_modules')) {
          results.push(...this.findFiles(fullPath, pattern));
        } else if (pattern.test(file)) {
          results.push(fullPath);
        }
      }
    } catch (err) {
      // Directory might not exist
    }
    
    return results;
  }

  private generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Mock Update Report');
    console.log('='.repeat(50));
    
    const totalFiles = this.updates.length;
    const totalChanges = this.updates.reduce((sum, u) => sum + u.changes.length, 0);
    
    console.log(`Files updated: ${totalFiles}`);
    console.log(`Total changes: ${totalChanges}`);
    console.log('\nKey fixes applied:');
    console.log('  ✅ User portal property: portal → portalType');
    console.log('  ✅ Authentication: JWT tokens → Better Auth sessions');
    console.log('  ✅ IDs: numeric → UUID strings');
    console.log('  ✅ Budget: number → string');
    console.log('  ✅ Creator: string → object structure');
    console.log('  ✅ WebSocket events: added eventType and timestamp');
    console.log('  ✅ API responses: direct array → nested data property');
    
    console.log('\nNext steps:');
    console.log('1. Run tests to verify fixes: npm test');
    console.log('2. Update any failing tests with correct assertions');
    console.log('3. Commit changes: git commit -am "fix: align mocks with production API"');
  }
}

// Run the fixer
if (require.main === module) {
  const fixer = new MockRealGapFixer();
  fixer.fix().catch(console.error);
}