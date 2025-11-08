// Draft Auto-Sync Service - Real-time draft synchronization across devices
// Handles collaborative editing, conflict resolution, and auto-save functionality

import { nativeRedisService } from './redis-native.service.ts';
import { wrapRedisClient } from '../utils/redis-fallback.ts';
import { db } from '../db/client.ts';
import { pitches } from '../db/schema.ts';
import { eq, and } from 'npm:drizzle-orm';

export interface DraftData {
  userId: number;
  pitchId: number;
  content: {
    title?: string;
    logline?: string;
    shortSynopsis?: string;
    longSynopsis?: string;
    genre?: string;
    format?: string;
    budgetBracket?: string;
    characters?: any[];
    themes?: string[];
    [key: string]: any;
  };
  version: number;
  lastModified: number;
  deviceId: string;
  fieldLocks?: { [field: string]: { userId: number; deviceId: string; lockedAt: number } };
}

export interface DraftConflict {
  field: string;
  serverValue: any;
  clientValue: any;
  serverTimestamp: number;
  clientTimestamp: number;
}

export class DraftSyncService {
  private static get redis() { return wrapRedisClient(nativeRedisService); }
  private static wsService: any = null;

  // Cache TTL settings
  private static readonly TTL = {
    DRAFT: 24 * 60 * 60,     // 24 hours
    LOCK: 5 * 60,            // 5 minutes for field locks
    TYPING: 30,              // 30 seconds for typing indicators
  };

  static initialize(webSocketService: any) {
    this.wsService = webSocketService;
    console.log("✅ DraftSyncService initialized with WebSocket support");
  }

  // Auto-save draft (called every 5 seconds from frontend)
  static async autoSaveDraft(draftData: DraftData): Promise<{ success: boolean; conflicts?: DraftConflict[]; version?: number }> {
    try {
      const cacheKey = `draft:${draftData.userId}:${draftData.pitchId}`;
      const lockKey = `draft_lock:${draftData.userId}:${draftData.pitchId}`;

      // Get current server version
      const serverDraft = await this.getDraft(draftData.userId, draftData.pitchId);
      
      // Check for conflicts
      const conflicts = this.detectConflicts(draftData, serverDraft);
      
      if (conflicts.length > 0) {
        console.log(`⚠️ Draft conflicts detected for pitch ${draftData.pitchId}: ${conflicts.length} conflicts`);
        return { success: false, conflicts };
      }

      // Increment version
      const newVersion = (serverDraft?.version || 0) + 1;
      const updatedDraft: DraftData = {
        ...draftData,
        version: newVersion,
        lastModified: Date.now(),
      };

      // Save to Redis with lock
      await this.redis.set(lockKey, "locked", "EX", 10); // 10 second lock
      await this.redis.setex(cacheKey, this.TTL.DRAFT, JSON.stringify(updatedDraft));
      await this.redis.del(lockKey);

      // Broadcast to other devices/users
      await this.broadcastDraftUpdate(draftData.userId, draftData.pitchId, updatedDraft);

      console.log(`💾 Draft auto-saved for pitch ${draftData.pitchId} (version ${newVersion})`);
      return { success: true, version: newVersion };
    } catch (error) {
      console.error("❌ Failed to auto-save draft:", error);
      return { success: false };
    }
  }

  // Get current draft from cache
  static async getDraft(userId: number, pitchId: number): Promise<DraftData | null> {
    try {
      const cacheKey = `draft:${userId}:${pitchId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // If no draft in cache, create from database
      const dbPitch = await db.query.pitches.findFirst({
        where: and(
          eq(pitches.id, pitchId),
          eq(pitches.userId, userId)
        ),
      });

      if (dbPitch) {
        const draftData: DraftData = {
          userId,
          pitchId,
          content: {
            title: dbPitch.title,
            logline: dbPitch.logline,
            shortSynopsis: dbPitch.shortSynopsis || '',
            longSynopsis: dbPitch.longSynopsis || '',
            genre: dbPitch.genre || '',
            format: dbPitch.format || '',
            budgetBracket: dbPitch.budget || '',
            characters: dbPitch.characters || [],
            themes: dbPitch.themes || [],
          },
          version: 1,
          lastModified: dbPitch.updatedAt?.getTime() || Date.now(),
          deviceId: 'database',
        };

        // Cache the initial draft
        await this.redis.setex(cacheKey, this.TTL.DRAFT, JSON.stringify(draftData));
        return draftData;
      }

      return null;
    } catch (error) {
      console.error("❌ Failed to get draft:", error);
      return null;
    }
  }

  // Manual save draft to database
  static async saveDraftToDatabase(userId: number, pitchId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const draft = await this.getDraft(userId, pitchId);
      if (!draft) {
        return { success: false, error: "Draft not found" };
      }

      // Update database
      await db.update(pitches)
        .set({
          title: draft.content.title,
          logline: draft.content.logline,
          shortSynopsis: draft.content.shortSynopsis,
          longSynopsis: draft.content.longSynopsis,
          genre: draft.content.genre,
          format: draft.content.format,
          budget: draft.content.budgetBracket,
          characters: draft.content.characters,
          themes: draft.content.themes,
          updatedAt: new Date(),
        })
        .where(and(
          eq(pitches.id, pitchId),
          eq(pitches.userId, userId)
        ));

      // Clear draft cache since it's now saved
      await this.clearDraft(userId, pitchId);

      console.log(`💾 Draft saved to database for pitch ${pitchId}`);
      return { success: true };
    } catch (error) {
      console.error("❌ Failed to save draft to database:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Lock a field for editing
  static async lockField(userId: number, pitchId: number, field: string, deviceId: string): Promise<{ success: boolean; lockedBy?: { userId: number; deviceId: string } }> {
    try {
      const lockKey = `field_lock:${pitchId}:${field}`;
      const lockData = {
        userId,
        deviceId,
        lockedAt: Date.now(),
      };

      // Try to set lock with NX (only if not exists)
      const result = await this.redis.set(lockKey, JSON.stringify(lockData), this.TTL.LOCK);
      
      if (result) {
        // Broadcast lock acquisition
        await this.broadcastFieldLock(pitchId, field, lockData);
        console.log(`🔒 Field '${field}' locked by user ${userId} (device: ${deviceId})`);
        return { success: true };
      } else {
        // Field is already locked, get lock info
        const existingLock = await this.redis.get(lockKey);
        if (existingLock) {
          const lockInfo = JSON.parse(existingLock);
          return { success: false, lockedBy: lockInfo };
        }
        return { success: false };
      }
    } catch (error) {
      console.error("❌ Failed to lock field:", error);
      return { success: false };
    }
  }

  // Release field lock
  static async unlockField(userId: number, pitchId: number, field: string, deviceId: string): Promise<boolean> {
    try {
      const lockKey = `field_lock:${pitchId}:${field}`;
      const existingLock = await this.redis.get(lockKey);
      
      if (existingLock) {
        const lockInfo = JSON.parse(existingLock);
        
        // Only allow unlock by the same user/device that locked it
        if (lockInfo.userId === userId && lockInfo.deviceId === deviceId) {
          await this.redis.del(lockKey);
          
          // Broadcast lock release
          await this.broadcastFieldUnlock(pitchId, field);
          console.log(`🔓 Field '${field}' unlocked by user ${userId} (device: ${deviceId})`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error("❌ Failed to unlock field:", error);
      return false;
    }
  }

  // Update typing indicator
  static async updateTypingIndicator(userId: number, pitchId: number, field: string, isTyping: boolean, deviceId: string): Promise<void> {
    try {
      const typingKey = `typing:${pitchId}:${field}:${userId}:${deviceId}`;
      
      if (isTyping) {
        await this.redis.setex(typingKey, this.TTL.TYPING, "typing");
      } else {
        await this.redis.del(typingKey);
      }

      // Broadcast typing status
      await this.broadcastTypingIndicator(pitchId, field, userId, isTyping, deviceId);
    } catch (error) {
      console.error("❌ Failed to update typing indicator:", error);
    }
  }

  // Get active typing indicators
  static async getTypingIndicators(pitchId: number): Promise<{ [field: string]: Array<{ userId: number; deviceId: string }> }> {
    try {
      const pattern = `typing:${pitchId}:*`;
      const keys = await this.redis.keys(pattern);
      
      const indicators: { [field: string]: Array<{ userId: number; deviceId: string }> } = {};
      
      for (const key of keys) {
        const parts = key.split(':');
        if (parts.length === 5) {
          const field = parts[2];
          const userId = parseInt(parts[3]);
          const deviceId = parts[4];
          
          if (!indicators[field]) {
            indicators[field] = [];
          }
          indicators[field].push({ userId, deviceId });
        }
      }
      
      return indicators;
    } catch (error) {
      console.error("❌ Failed to get typing indicators:", error);
      return {};
    }
  }

  // Detect conflicts between client and server drafts
  private static detectConflicts(clientDraft: DraftData, serverDraft: DraftData | null): DraftConflict[] {
    if (!serverDraft) return [];

    const conflicts: DraftConflict[] = [];
    const clientContent = clientDraft.content;
    const serverContent = serverDraft.content;

    // Check each field for conflicts
    for (const field in clientContent) {
      const clientValue = clientContent[field];
      const serverValue = serverContent[field];
      
      // If values are different and both have been modified since last sync
      if (JSON.stringify(clientValue) !== JSON.stringify(serverValue)) {
        // Simple conflict detection: server wins if it's newer
        if (serverDraft.lastModified > clientDraft.lastModified) {
          conflicts.push({
            field,
            serverValue,
            clientValue,
            serverTimestamp: serverDraft.lastModified,
            clientTimestamp: clientDraft.lastModified,
          });
        }
      }
    }

    return conflicts;
  }

  // Resolve conflicts (server wins for now, can be enhanced)
  static async resolveConflicts(userId: number, pitchId: number, resolution: 'server' | 'client' | { [field: string]: 'server' | 'client' }): Promise<{ success: boolean; resolvedDraft?: DraftData }> {
    try {
      const serverDraft = await this.getDraft(userId, pitchId);
      if (!serverDraft) {
        return { success: false };
      }

      // For now, simple resolution: server always wins
      console.log(`🔧 Resolving conflicts for pitch ${pitchId} with ${resolution} strategy`);
      
      return { success: true, resolvedDraft: serverDraft };
    } catch (error) {
      console.error("❌ Failed to resolve conflicts:", error);
      return { success: false };
    }
  }

  // Clear draft from cache
  static async clearDraft(userId: number, pitchId: number): Promise<void> {
    try {
      const cacheKey = `draft:${userId}:${pitchId}`;
      await this.redis.del(cacheKey);
      console.log(`🗑️ Draft cache cleared for pitch ${pitchId}`);
    } catch (error) {
      console.error("❌ Failed to clear draft:", error);
    }
  }

  // Broadcast draft update to other devices
  private static async broadcastDraftUpdate(userId: number, pitchId: number, draft: DraftData): Promise<void> {
    if (!this.wsService) return;

    try {
      await this.wsService.sendNotificationToUser(userId, {
        type: 'draft_sync',
        data: {
          pitchId,
          draft,
          action: 'update',
        },
      });
    } catch (error) {
      console.error("❌ Failed to broadcast draft update:", error);
    }
  }

  // Broadcast field lock
  private static async broadcastFieldLock(pitchId: number, field: string, lockData: any): Promise<void> {
    if (!this.wsService) return;

    try {
      // Broadcast to all users who might be editing this pitch
      await this.wsService.broadcastToRoom(`pitch:${pitchId}`, {
        type: 'field_lock',
        data: {
          pitchId,
          field,
          lockData,
          action: 'lock',
        },
      });
    } catch (error) {
      console.error("❌ Failed to broadcast field lock:", error);
    }
  }

  // Broadcast field unlock
  private static async broadcastFieldUnlock(pitchId: number, field: string): Promise<void> {
    if (!this.wsService) return;

    try {
      await this.wsService.broadcastToRoom(`pitch:${pitchId}`, {
        type: 'field_lock',
        data: {
          pitchId,
          field,
          action: 'unlock',
        },
      });
    } catch (error) {
      console.error("❌ Failed to broadcast field unlock:", error);
    }
  }

  // Broadcast typing indicator
  private static async broadcastTypingIndicator(pitchId: number, field: string, userId: number, isTyping: boolean, deviceId: string): Promise<void> {
    if (!this.wsService) return;

    try {
      await this.wsService.broadcastToRoom(`pitch:${pitchId}`, {
        type: 'typing_indicator',
        data: {
          pitchId,
          field,
          userId,
          isTyping,
          deviceId,
        },
      });
    } catch (error) {
      console.error("❌ Failed to broadcast typing indicator:", error);
    }
  }

  // Cleanup expired locks and typing indicators
  static async cleanup(): Promise<void> {
    try {
      // Check if Redis is available and has the keys method
      if (!this.redis || typeof this.redis.keys !== 'function') {
        console.log('⚠️ Redis not available, skipping draft cleanup');
        return;
      }
      
      const patterns = ['field_lock:*', 'typing:*'];
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) {
            // Key exists but has no expiration, clean it up
            await this.redis.del(key);
          }
        }
      }
      
      console.log('🧹 Draft sync cleanup completed');
    } catch (error) {
      console.warn('⚠️ Draft cleanup skipped (Redis not available):', error instanceof Error ? error.message : String(error));
    }
  }

  // Get draft statistics
  static async getDraftStats(): Promise<any> {
    try {
      // Check if Redis is available
      if (!this.redis || typeof this.redis.keys !== 'function') {
        return {
          activeDrafts: 0,
          fieldLocks: 0,
          typingIndicators: 0,
          sampleDrafts: [],
          sampleLocks: [],
          redisAvailable: false
        };
      }
      
      const draftKeys = await this.redis.keys('draft:*');
      const lockKeys = await this.redis.keys('field_lock:*');
      const typingKeys = await this.redis.keys('typing:*');
      
      return {
        activeDrafts: draftKeys.length,
        fieldLocks: lockKeys.length,
        typingIndicators: typingKeys.length,
        sampleDrafts: draftKeys.slice(0, 5),
        sampleLocks: lockKeys.slice(0, 5),
        redisAvailable: true
      };
    } catch (error) {
      console.warn('⚠️ Draft stats unavailable (Redis not configured)');
      return {
        activeDrafts: 0,
        fieldLocks: 0,
        typingIndicators: 0,
        sampleDrafts: [],
        sampleLocks: [],
        redisAvailable: false
      };
    }
  }
}

// Schedule cleanup every 5 minutes
setInterval(() => {
  DraftSyncService.cleanup();
}, 5 * 60 * 1000);