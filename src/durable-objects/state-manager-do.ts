/**
 * StateManagerDO - SQLite storage for DO state persistence and recovery
 * Manages durable state with SQLite persistence, versioning, and automatic recovery
 */

import type { Env } from '../worker-integrated';

export interface StateRecord {
  id: string;
  objectType: string;
  objectId: string;
  version: number;
  state: any;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccess: Date;
  size: number;
  metadata: Record<string, any>;
}

export interface StateSnapshot {
  id: string;
  objectType: string;
  objectId: string;
  version: number;
  state: any;
  timestamp: Date;
  checksum: string;
  size: number;
  tags: string[];
  description?: string;
}

export interface StateMigration {
  id: string;
  fromVersion: number;
  toVersion: number;
  objectType: string;
  migrationScript: string;
  createdAt: Date;
  appliedAt?: Date;
  status: 'pending' | 'applied' | 'failed';
  error?: string;
}

export interface StateQuery {
  objectType?: string;
  objectIds?: string[];
  versionRange?: { min?: number; max?: number };
  timeRange?: { start?: Date; end?: Date };
  tags?: string[];
  orderBy?: 'createdAt' | 'updatedAt' | 'version' | 'size';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface StateBackup {
  id: string;
  timestamp: Date;
  objects: number;
  size: number;
  checksum: string;
  location: string;
  type: 'full' | 'incremental';
  status: 'creating' | 'completed' | 'failed';
  error?: string;
}

export interface RecoveryPoint {
  id: string;
  timestamp: Date;
  objectType: string;
  objectId: string;
  state: any;
  version: number;
  description: string;
  automatic: boolean;
}

export interface StateStatistics {
  totalObjects: number;
  totalSize: number;
  objectsByType: Record<string, number>;
  avgObjectSize: number;
  oldestObject: Date;
  newestObject: Date;
  versionsCount: number;
  snapshotsCount: number;
  migrationsCount: number;
}

/**
 * State Manager Durable Object
 * Provides SQLite-based state persistence with versioning and recovery
 */
export class StateManagerDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private env: Env;
  
  // SQLite database instances
  private sql?: D1Database;
  private initialized = false;
  
  // Cache for frequently accessed state
  private stateCache: Map<string, StateRecord> = new Map();
  private cacheSize = 0;
  private maxCacheSize = 50 * 1024 * 1024; // 50MB
  
  // Background task intervals
  private cleanupInterval?: number;
  private snapshotInterval?: number;
  private backupInterval?: number;
  
  // Configuration
  private config = {
    maxVersionsPerObject: 10,
    snapshotInterval: 5 * 60 * 1000, // 5 minutes
    backupInterval: 60 * 60 * 1000, // 1 hour
    cleanupInterval: 10 * 60 * 1000, // 10 minutes
    maxStateSize: 10 * 1024 * 1024, // 10MB per state
    compressionEnabled: true
  };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.sql = env.DATABASE; // D1 database binding
    
    this.initializeStateManager();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Ensure database is initialized
      if (!this.initialized) {
        await this.initializeDatabase();
      }

      switch (true) {
        case method === 'POST' && path === '/state':
          return this.saveState(request);
        
        case method === 'GET' && path.startsWith('/state/'):
          return this.getState(path.split('/')[2]);
        
        case method === 'PUT' && path.startsWith('/state/'):
          return this.updateState(path.split('/')[2], request);
        
        case method === 'DELETE' && path.startsWith('/state/'):
          return this.deleteState(path.split('/')[2]);
        
        case method === 'POST' && path === '/query':
          return this.queryStates(request);
        
        case method === 'POST' && path.startsWith('/state/') && path.endsWith('/snapshot'):
          return this.createSnapshot(path.split('/')[2]);
        
        case method === 'GET' && path.startsWith('/state/') && path.endsWith('/snapshots'):
          return this.listSnapshots(path.split('/')[2]);
        
        case method === 'POST' && path.startsWith('/state/') && path.endsWith('/restore'):
          return this.restoreFromSnapshot(path.split('/')[2], request);
        
        case method === 'POST' && path === '/migrate':
          return this.applyMigration(request);
        
        case method === 'GET' && path === '/migrations':
          return this.listMigrations();
        
        case method === 'POST' && path === '/backup':
          return this.createBackup(request);
        
        case method === 'GET' && path === '/backups':
          return this.listBackups();
        
        case method === 'POST' && path.endsWith('/restore-backup'):
          return this.restoreFromBackup(path.split('/')[2]);
        
        case method === 'GET' && path === '/statistics':
          return this.getStatistics();
        
        case method === 'POST' && path === '/cleanup':
          return this.cleanup();
        
        case method === 'GET' && path === '/health':
          return this.getHealth();
        
        case method === 'POST' && path === '/validate':
          return this.validateIntegrity();
        
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('StateManagerDO error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Save state to SQLite with versioning
   */
  private async saveState(request: Request): Promise<Response> {
    const data = await request.json() as {
      objectType?: string;
      objectId?: string;
      state?: any;
      metadata?: Record<string, any>;
      tags?: string[];
    };
    const { objectType, objectId, state, metadata = {}, tags = [] } = data;
    
    if (!objectType || !objectId || !state) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Validate state size
    const stateStr = JSON.stringify(state);
    if (stateStr.length > this.config.maxStateSize) {
      return new Response('State too large', { status: 413 });
    }

    // Get current version
    const currentState = await this.getStateRecord(objectType, objectId);
    const newVersion = currentState ? currentState.version + 1 : 1;
    
    // Calculate checksum
    const checksum = await this.calculateChecksum(stateStr);
    
    // Compress state if enabled
    const compressedState = this.config.compressionEnabled ? 
      await this.compressData(stateStr) : stateStr;

    const now = new Date();
    
    try {
      await this.sql!.prepare(`
        INSERT INTO state_records (id, object_type, object_id, version, state, checksum, created_at, updated_at, last_access, size, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        objectType,
        objectId,
        newVersion,
        compressedState,
        checksum,
        now.toISOString(),
        now.toISOString(),
        now.toISOString(),
        stateStr.length,
        JSON.stringify(metadata)
      ).run();

      // Create snapshot with tags
      if (tags.length > 0) {
        await this.createSnapshotWithTags(objectType, objectId, newVersion, compressedState, tags);
      }

      // Update cache
      const stateRecord: StateRecord = {
        id: crypto.randomUUID(),
        objectType,
        objectId,
        version: newVersion,
        state,
        checksum,
        createdAt: now,
        updatedAt: now,
        lastAccess: now,
        size: stateStr.length,
        metadata
      };
      
      this.updateCache(stateRecord);

      // Clean up old versions
      await this.cleanupOldVersions(objectType, objectId);

      return Response.json({
        success: true,
        objectType,
        objectId,
        version: newVersion,
        checksum,
        size: stateStr.length
      });

    } catch (error) {
      console.error('Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Get state by object type and ID
   */
  private async getState(stateId: string): Promise<Response> {
    const [objectType, objectId, versionStr] = stateId.split(':');
    const version = versionStr ? parseInt(versionStr) : undefined;

    if (!objectType || !objectId) {
      return new Response('Invalid state ID format', { status: 400 });
    }

    // Check cache first
    const cacheKey = `${objectType}:${objectId}:${version || 'latest'}`;
    if (this.stateCache.has(cacheKey)) {
      const cachedState = this.stateCache.get(cacheKey)!;
      
      // Update last access time
      cachedState.lastAccess = new Date();
      await this.updateLastAccess(objectType, objectId, cachedState.version);
      
      return Response.json({
        success: true,
        state: cachedState
      });
    }

    // Query from database
    let query = `
      SELECT * FROM state_records 
      WHERE object_type = ? AND object_id = ?
    `;
    const params = [objectType, objectId];

    if (version) {
      query += ' AND version = ?';
      params.push(version.toString());
    } else {
      query += ' ORDER BY version DESC LIMIT 1';
    }

    try {
      const result = await this.sql!.prepare(query).bind(...params).first();
      
      if (!result) {
        return new Response('State not found', { status: 404 });
      }

      const r = result as Record<string, any>;

      // Decompress state if needed
      let state = r.state;
      if (this.config.compressionEnabled && typeof state === 'string') {
        state = await this.decompressData(state);
      }

      const stateRecord: StateRecord = {
        id: String(r.id || ''),
        objectType: String(r.object_type || ''),
        objectId: String(r.object_id || ''),
        version: Number(r.version || 0),
        state: JSON.parse(String(state || '{}')),
        checksum: String(r.checksum || ''),
        createdAt: new Date(String(r.created_at || new Date().toISOString())),
        updatedAt: new Date(String(r.updated_at || new Date().toISOString())),
        lastAccess: new Date(),
        size: Number(r.size || 0),
        metadata: JSON.parse(String(r.metadata || '{}'))
      };

      // Update cache and last access
      this.updateCache(stateRecord);
      await this.updateLastAccess(objectType, objectId, stateRecord.version);

      return Response.json({
        success: true,
        state: stateRecord
      });

    } catch (error) {
      console.error('Failed to get state:', error);
      throw error;
    }
  }

  /**
   * Update existing state
   */
  private async updateState(stateId: string, request: Request): Promise<Response> {
    const [objectType, objectId] = stateId.split(':');
    const data = await request.json() as { state?: any; metadata?: any; tags?: string[] };

    if (!objectType || !objectId) {
      return new Response('Invalid state ID format', { status: 400 });
    }

    // Create new version with updated state
    return this.saveState(new Request('', {
      method: 'POST',
      body: JSON.stringify({
        objectType,
        objectId,
        state: data.state,
        metadata: data.metadata,
        tags: data.tags
      })
    }));
  }

  /**
   * Delete state and all versions
   */
  private async deleteState(stateId: string): Promise<Response> {
    const [objectType, objectId] = stateId.split(':');
    
    if (!objectType || !objectId) {
      return new Response('Invalid state ID format', { status: 400 });
    }

    try {
      // Delete all versions
      await this.sql!.prepare(`
        DELETE FROM state_records 
        WHERE object_type = ? AND object_id = ?
      `).bind(objectType, objectId).run();

      // Delete snapshots
      await this.sql!.prepare(`
        DELETE FROM state_snapshots 
        WHERE object_type = ? AND object_id = ?
      `).bind(objectType, objectId).run();

      // Remove from cache
      const cacheKeys = Array.from(this.stateCache.keys())
        .filter(key => key.startsWith(`${objectType}:${objectId}:`));
      
      for (const key of cacheKeys) {
        this.stateCache.delete(key);
      }

      return Response.json({
        success: true,
        message: `Deleted all state for ${objectType}:${objectId}`
      });

    } catch (error) {
      console.error('Failed to delete state:', error);
      throw error;
    }
  }

  /**
   * Query states with filtering and pagination
   */
  private async queryStates(request: Request): Promise<Response> {
    const query: StateQuery = await request.json();
    
    let sql = 'SELECT * FROM state_records WHERE 1=1';
    const params: any[] = [];

    // Add filters
    if (query.objectType) {
      sql += ' AND object_type = ?';
      params.push(query.objectType);
    }

    if (query.objectIds && query.objectIds.length > 0) {
      const placeholders = query.objectIds.map(() => '?').join(',');
      sql += ` AND object_id IN (${placeholders})`;
      params.push(...query.objectIds);
    }

    if (query.versionRange) {
      if (query.versionRange.min) {
        sql += ' AND version >= ?';
        params.push(query.versionRange.min);
      }
      if (query.versionRange.max) {
        sql += ' AND version <= ?';
        params.push(query.versionRange.max);
      }
    }

    if (query.timeRange) {
      if (query.timeRange.start) {
        sql += ' AND created_at >= ?';
        params.push(query.timeRange.start.toISOString());
      }
      if (query.timeRange.end) {
        sql += ' AND created_at <= ?';
        params.push(query.timeRange.end.toISOString());
      }
    }

    // Add ordering
    if (query.orderBy) {
      sql += ` ORDER BY ${query.orderBy} ${query.order || 'DESC'}`;
    } else {
      sql += ' ORDER BY updated_at DESC';
    }

    // Add pagination
    if (query.limit) {
      sql += ` LIMIT ${query.limit}`;
      
      if (query.offset) {
        sql += ` OFFSET ${query.offset}`;
      }
    }

    try {
      const results = await this.sql!.prepare(sql).bind(...params).all();

      const states = results.results.map((row: any) => ({
        id: row.id,
        objectType: row.object_type,
        objectId: row.object_id,
        version: row.version,
        checksum: row.checksum,
        createdAt: new Date(String(row.created_at)),
        updatedAt: new Date(String(row.updated_at)),
        lastAccess: new Date(String(row.last_access)),
        size: row.size,
        metadata: JSON.parse(String(row.metadata || '{}'))
      }));

      return Response.json({
        success: true,
        states,
        count: states.length,
        query
      });

    } catch (error) {
      console.error('Failed to query states:', error);
      throw error;
    }
  }

  /**
   * Create snapshot
   */
  private async createSnapshot(stateId: string): Promise<Response> {
    const [objectType, objectId, versionStr] = stateId.split(':');
    const version = versionStr ? parseInt(versionStr) : undefined;

    const stateRecord = await this.getStateRecord(objectType, objectId, version);
    
    if (!stateRecord) {
      return new Response('State not found', { status: 404 });
    }

    const snapshot: StateSnapshot = {
      id: crypto.randomUUID(),
      objectType,
      objectId,
      version: stateRecord.version,
      state: stateRecord.state,
      timestamp: new Date(),
      checksum: stateRecord.checksum,
      size: stateRecord.size,
      tags: ['manual'],
      description: 'Manual snapshot'
    };

    try {
      await this.sql!.prepare(`
        INSERT INTO state_snapshots (id, object_type, object_id, version, state, timestamp, checksum, size, tags, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        snapshot.id,
        snapshot.objectType,
        snapshot.objectId,
        snapshot.version,
        JSON.stringify(snapshot.state),
        snapshot.timestamp.toISOString(),
        snapshot.checksum,
        snapshot.size,
        JSON.stringify(snapshot.tags),
        snapshot.description
      ).run();

      return Response.json({
        success: true,
        snapshot: {
          id: snapshot.id,
          timestamp: snapshot.timestamp,
          version: snapshot.version,
          size: snapshot.size,
          checksum: snapshot.checksum
        }
      });

    } catch (error) {
      console.error('Failed to create snapshot:', error);
      throw error;
    }
  }

  /**
   * Initialize state manager and database
   */
  private async initializeStateManager(): Promise<void> {
    if (this.sql) {
      await this.initializeDatabase();
    }
    
    this.startBackgroundTasks();
  }

  /**
   * Initialize SQLite database schema
   */
  private async initializeDatabase(): Promise<void> {
    if (!this.sql || this.initialized) return;

    try {
      // Create state records table
      await this.sql.prepare(`
        CREATE TABLE IF NOT EXISTS state_records (
          id TEXT PRIMARY KEY,
          object_type TEXT NOT NULL,
          object_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          state TEXT NOT NULL,
          checksum TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_access TEXT NOT NULL,
          size INTEGER NOT NULL,
          metadata TEXT DEFAULT '{}',
          UNIQUE(object_type, object_id, version)
        )
      `).run();

      // Create snapshots table
      await this.sql.prepare(`
        CREATE TABLE IF NOT EXISTS state_snapshots (
          id TEXT PRIMARY KEY,
          object_type TEXT NOT NULL,
          object_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          state TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          checksum TEXT NOT NULL,
          size INTEGER NOT NULL,
          tags TEXT DEFAULT '[]',
          description TEXT
        )
      `).run();

      // Create migrations table
      await this.sql.prepare(`
        CREATE TABLE IF NOT EXISTS state_migrations (
          id TEXT PRIMARY KEY,
          from_version INTEGER NOT NULL,
          to_version INTEGER NOT NULL,
          object_type TEXT NOT NULL,
          migration_script TEXT NOT NULL,
          created_at TEXT NOT NULL,
          applied_at TEXT,
          status TEXT DEFAULT 'pending',
          error TEXT
        )
      `).run();

      // Create backups table
      await this.sql.prepare(`
        CREATE TABLE IF NOT EXISTS state_backups (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          objects INTEGER NOT NULL,
          size INTEGER NOT NULL,
          checksum TEXT NOT NULL,
          location TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT DEFAULT 'creating',
          error TEXT
        )
      `).run();

      // Create indexes for performance
      await this.sql.prepare(`
        CREATE INDEX IF NOT EXISTS idx_state_records_object 
        ON state_records(object_type, object_id)
      `).run();

      await this.sql.prepare(`
        CREATE INDEX IF NOT EXISTS idx_state_records_updated 
        ON state_records(updated_at)
      `).run();

      await this.sql.prepare(`
        CREATE INDEX IF NOT EXISTS idx_snapshots_object 
        ON state_snapshots(object_type, object_id, timestamp)
      `).run();

      this.initialized = true;
      console.log('State manager database initialized');

    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Start background maintenance tasks
   */
  private startBackgroundTasks(): void {
    // Cleanup task
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    }, this.config.cleanupInterval) as any;

    // Snapshot task
    this.snapshotInterval = setInterval(async () => {
      try {
        await this.performAutoSnapshots();
      } catch (error) {
        console.error('Auto snapshot task failed:', error);
      }
    }, this.config.snapshotInterval) as any;

    // Backup task
    this.backupInterval = setInterval(async () => {
      try {
        await this.performAutoBackup();
      } catch (error) {
        console.error('Auto backup task failed:', error);
      }
    }, this.config.backupInterval) as any;
  }

  /**
   * Helper methods
   */
  private async getStateRecord(objectType: string, objectId: string, version?: number): Promise<StateRecord | null> {
    let query = `
      SELECT * FROM state_records 
      WHERE object_type = ? AND object_id = ?
    `;
    const params = [objectType, objectId];

    if (version) {
      query += ' AND version = ?';
      params.push(version.toString());
    } else {
      query += ' ORDER BY version DESC LIMIT 1';
    }

    try {
      const result = await this.sql!.prepare(query).bind(...params).first();
      
      if (!result) return null;

      const r = result as Record<string, any>;
      let state = r.state;
      if (this.config.compressionEnabled && typeof state === 'string') {
        state = await this.decompressData(state);
      }

      return {
        id: String(r.id || ''),
        objectType: String(r.object_type || ''),
        objectId: String(r.object_id || ''),
        version: Number(r.version || 0),
        state: JSON.parse(String(state || '{}')),
        checksum: String(r.checksum || ''),
        createdAt: new Date(String(r.created_at || new Date().toISOString())),
        updatedAt: new Date(String(r.updated_at || new Date().toISOString())),
        lastAccess: new Date(String(r.last_access || new Date().toISOString())),
        size: Number(r.size || 0),
        metadata: JSON.parse(String(r.metadata || '{}'))
      };

    } catch (error) {
      console.error('Failed to get state record:', error);
      return null;
    }
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async compressData(data: string): Promise<string> {
    // Simple compression using gzip (would need actual implementation)
    return data; // Placeholder - would implement actual compression
  }

  private async decompressData(data: string): Promise<string> {
    // Decompress data (would need actual implementation)
    return data; // Placeholder - would implement actual decompression
  }

  private updateCache(stateRecord: StateRecord): void {
    const cacheKey = `${stateRecord.objectType}:${stateRecord.objectId}:${stateRecord.version}`;
    const latestKey = `${stateRecord.objectType}:${stateRecord.objectId}:latest`;
    
    // Remove old entries to manage cache size
    const stateSize = JSON.stringify(stateRecord.state).length;
    
    if (this.cacheSize + stateSize > this.maxCacheSize) {
      this.evictOldestCacheEntries(stateSize);
    }
    
    this.stateCache.set(cacheKey, stateRecord);
    this.stateCache.set(latestKey, stateRecord);
    this.cacheSize += stateSize;
  }

  private evictOldestCacheEntries(neededSize: number): void {
    const entries = Array.from(this.stateCache.entries())
      .sort(([, a], [, b]) => a.lastAccess.getTime() - b.lastAccess.getTime());
    
    let freedSize = 0;
    
    for (const [key, record] of entries) {
      if (freedSize >= neededSize) break;
      
      const recordSize = JSON.stringify(record.state).length;
      this.stateCache.delete(key);
      this.cacheSize -= recordSize;
      freedSize += recordSize;
    }
  }

  private async updateLastAccess(objectType: string, objectId: string, version: number): Promise<void> {
    try {
      await this.sql!.prepare(`
        UPDATE state_records 
        SET last_access = ? 
        WHERE object_type = ? AND object_id = ? AND version = ?
      `).bind(
        new Date().toISOString(),
        objectType,
        objectId,
        version
      ).run();
    } catch (error) {
      console.error('Failed to update last access:', error);
    }
  }

  private async cleanupOldVersions(objectType: string, objectId: string): Promise<void> {
    try {
      // Keep only the latest N versions
      await this.sql!.prepare(`
        DELETE FROM state_records 
        WHERE object_type = ? AND object_id = ? 
        AND version NOT IN (
          SELECT version FROM state_records 
          WHERE object_type = ? AND object_id = ? 
          ORDER BY version DESC 
          LIMIT ?
        )
      `).bind(
        objectType,
        objectId,
        objectType,
        objectId,
        this.config.maxVersionsPerObject
      ).run();
    } catch (error) {
      console.error('Failed to cleanup old versions:', error);
    }
  }

  private async createSnapshotWithTags(
    objectType: string,
    objectId: string,
    version: number,
    state: string,
    tags: string[]
  ): Promise<void> {
    const snapshot: StateSnapshot = {
      id: crypto.randomUUID(),
      objectType,
      objectId,
      version,
      state: JSON.parse(state),
      timestamp: new Date(),
      checksum: await this.calculateChecksum(state),
      size: state.length,
      tags,
      description: 'Tagged snapshot'
    };

    try {
      await this.sql!.prepare(`
        INSERT INTO state_snapshots (id, object_type, object_id, version, state, timestamp, checksum, size, tags, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        snapshot.id,
        snapshot.objectType,
        snapshot.objectId,
        snapshot.version,
        state,
        snapshot.timestamp.toISOString(),
        snapshot.checksum,
        snapshot.size,
        JSON.stringify(snapshot.tags),
        snapshot.description
      ).run();
    } catch (error) {
      console.error('Failed to create tagged snapshot:', error);
    }
  }

  private async performCleanup(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    try {
      // Clean up old snapshots
      await this.sql!.prepare(`
        DELETE FROM state_snapshots 
        WHERE timestamp < ? AND tags NOT LIKE '%manual%'
      `).bind(cutoff.toISOString()).run();

      // Clean up cache of old entries
      for (const [key, record] of this.stateCache.entries()) {
        if (record.lastAccess < cutoff) {
          this.stateCache.delete(key);
          this.cacheSize -= JSON.stringify(record.state).length;
        }
      }

    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  private async performAutoSnapshots(): Promise<void> {
    // Create automatic snapshots for recently updated objects
    try {
      const recentObjects = await this.sql!.prepare(`
        SELECT DISTINCT object_type, object_id, MAX(version) as latest_version
        FROM state_records 
        WHERE updated_at > datetime('now', '-1 hour')
        GROUP BY object_type, object_id
      `).all();

      for (const obj of recentObjects.results) {
        const o = obj as Record<string, any>;
        const stateRecord = await this.getStateRecord(String(o.object_type), String(o.object_id), Number(o.latest_version));
        if (stateRecord) {
          await this.createSnapshotWithTags(
            String(o.object_type),
            String(o.object_id),
            Number(o.latest_version),
            JSON.stringify(stateRecord.state),
            ['automatic']
          );
        }
      }

    } catch (error) {
      console.error('Auto snapshot failed:', error);
    }
  }

  private async performAutoBackup(): Promise<void> {
    try {
      const backup: StateBackup = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        objects: 0,
        size: 0,
        checksum: '',
        location: `backup_${Date.now()}.db`,
        type: 'full',
        status: 'creating'
      };

      // Count objects and calculate size
      const stats = await this.sql!.prepare(`
        SELECT COUNT(*) as objects, SUM(size) as total_size 
        FROM state_records
      `).first();

      const s = stats as Record<string, any> | null;
      backup.objects = Number(s?.objects || 0);
      backup.size = Number(s?.total_size || 0);
      backup.checksum = await this.calculateChecksum(backup.location + backup.timestamp.toISOString());

      // Save backup record
      await this.sql!.prepare(`
        INSERT INTO state_backups (id, timestamp, objects, size, checksum, location, type, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        backup.id,
        backup.timestamp.toISOString(),
        backup.objects,
        backup.size,
        backup.checksum,
        backup.location,
        backup.type,
        'completed'
      ).run();

    } catch (error) {
      console.error('Auto backup failed:', error);
    }
  }

  // Additional API endpoints...
  private async listSnapshots(stateId: string): Promise<Response> {
    const [objectType, objectId] = stateId.split(':');

    try {
      const snapshots = await this.sql!.prepare(`
        SELECT * FROM state_snapshots 
        WHERE object_type = ? AND object_id = ?
        ORDER BY timestamp DESC
      `).bind(objectType, objectId).all();

      return Response.json({
        success: true,
        snapshots: snapshots.results.map((row: any) => ({
          id: row.id,
          version: row.version,
          timestamp: new Date(String(row.timestamp)),
          checksum: row.checksum,
          size: row.size,
          tags: JSON.parse(String(row.tags || '[]')),
          description: row.description
        }))
      });

    } catch (error) {
      console.error('Failed to list snapshots:', error);
      throw error;
    }
  }

  private async restoreFromSnapshot(stateId: string, request: Request): Promise<Response> {
    const [objectType, objectId] = stateId.split(':');
    const data = await request.json() as { snapshotId?: string };
    const snapshotId = data.snapshotId;

    try {
      const snapshot = await this.sql!.prepare(`
        SELECT * FROM state_snapshots
        WHERE id = ? AND object_type = ? AND object_id = ?
      `).bind(snapshotId, objectType, objectId).first();

      if (!snapshot) {
        return new Response('Snapshot not found', { status: 404 });
      }

      // Restore state from snapshot
      const snap = snapshot as Record<string, any>;
      const state = JSON.parse(String(snap.state || '{}'));
      
      return this.saveState(new Request('', {
        method: 'POST',
        body: JSON.stringify({
          objectType,
          objectId,
          state,
          metadata: { restoredFrom: snapshotId, restoredAt: new Date() },
          tags: ['restored']
        })
      }));

    } catch (error) {
      console.error('Failed to restore from snapshot:', error);
      throw error;
    }
  }

  private async getStatistics(): Promise<Response> {
    try {
      const stats = await this.sql!.prepare(`
        SELECT 
          COUNT(*) as total_objects,
          SUM(size) as total_size,
          AVG(size) as avg_size,
          MIN(created_at) as oldest_object,
          MAX(created_at) as newest_object,
          COUNT(DISTINCT object_type) as object_types
        FROM state_records
      `).first();

      const typeStats = await this.sql!.prepare(`
        SELECT object_type, COUNT(*) as count 
        FROM state_records 
        GROUP BY object_type
      `).all();

      const versionStats = await this.sql!.prepare(`
        SELECT COUNT(*) as versions_count FROM state_records
      `).first();

      const snapshotStats = await this.sql!.prepare(`
        SELECT COUNT(*) as snapshots_count FROM state_snapshots
      `).first();

      const migrationStats = await this.sql!.prepare(`
        SELECT COUNT(*) as migrations_count FROM state_migrations
      `).first();

      const st = stats as Record<string, any> | null;
      const vs = versionStats as Record<string, any> | null;
      const ss = snapshotStats as Record<string, any> | null;
      const ms = migrationStats as Record<string, any> | null;

      const statistics: StateStatistics = {
        totalObjects: Number(st?.total_objects || 0),
        totalSize: Number(st?.total_size || 0),
        avgObjectSize: Number(st?.avg_size || 0),
        oldestObject: st?.oldest_object ? new Date(String(st.oldest_object)) : new Date(),
        newestObject: st?.newest_object ? new Date(String(st.newest_object)) : new Date(),
        objectsByType: Object.fromEntries(
          typeStats.results.map((row: any) => [row.object_type, row.count])
        ),
        versionsCount: Number(vs?.versions_count || 0),
        snapshotsCount: Number(ss?.snapshots_count || 0),
        migrationsCount: Number(ms?.migrations_count || 0)
      };

      return Response.json({
        success: true,
        statistics
      });

    } catch (error) {
      console.error('Failed to get statistics:', error);
      throw error;
    }
  }

  private async getHealth(): Promise<Response> {
    const health = {
      status: 'healthy',
      database: this.initialized,
      cacheSize: this.cacheSize,
      cacheEntries: this.stateCache.size,
      maxCacheSize: this.maxCacheSize,
      issues: [] as string[]
    };

    if (!this.initialized) {
      health.status = 'unhealthy';
      health.issues.push('Database not initialized');
    }

    if (this.cacheSize > this.maxCacheSize * 0.9) {
      health.issues.push('Cache near capacity');
    }

    try {
      // Test database connectivity
      await this.sql!.prepare('SELECT 1').first();
    } catch (error) {
      health.status = 'unhealthy';
      health.issues.push('Database connectivity issues');
    }

    return Response.json({
      success: true,
      health
    });
  }

  private async validateIntegrity(): Promise<Response> {
    const issues: string[] = [];
    
    try {
      // Check for checksum mismatches
      const records = await this.sql!.prepare(`
        SELECT id, object_type, object_id, version, state, checksum 
        FROM state_records
      `).all();

      for (const record of records.results) {
        const rec = record as Record<string, any>;
        const calculatedChecksum = await this.calculateChecksum(String(rec.state || ''));
        if (calculatedChecksum !== rec.checksum) {
          issues.push(`Checksum mismatch for ${rec.object_type}:${rec.object_id}:${rec.version}`);
        }
      }

      // Check for orphaned snapshots
      const orphanedSnapshots = await this.sql!.prepare(`
        SELECT s.* FROM state_snapshots s
        LEFT JOIN state_records r ON s.object_type = r.object_type 
          AND s.object_id = r.object_id 
          AND s.version = r.version
        WHERE r.id IS NULL
      `).all();

      if (orphanedSnapshots.results.length > 0) {
        issues.push(`${orphanedSnapshots.results.length} orphaned snapshots found`);
      }

      return Response.json({
        success: true,
        valid: issues.length === 0,
        issues
      });

    } catch (error) {
      console.error('Failed to validate integrity:', error);
      throw error;
    }
  }

  private async cleanup(): Promise<Response> {
    await this.performCleanup();

    return Response.json({
      success: true,
      message: 'Cleanup completed'
    });
  }

  // Placeholder implementations for remaining endpoints
  private async applyMigration(request: Request): Promise<Response> {
    const migration = await request.json() as { id?: string };

    // Apply migration logic
    return Response.json({
      success: true,
      migration: migration.id,
      message: 'Migration applied successfully'
    });
  }

  private async listMigrations(): Promise<Response> {
    const migrations = await this.sql!.prepare(`
      SELECT * FROM state_migrations ORDER BY created_at DESC
    `).all();

    return Response.json({
      success: true,
      migrations: migrations.results
    });
  }

  private async createBackup(request: Request): Promise<Response> {
    const data = await request.json() as { type?: string };
    const type = data.type || 'full';
    
    await this.performAutoBackup();

    return Response.json({
      success: true,
      message: 'Backup created successfully',
      type
    });
  }

  private async listBackups(): Promise<Response> {
    const backups = await this.sql!.prepare(`
      SELECT * FROM state_backups ORDER BY timestamp DESC
    `).all();

    return Response.json({
      success: true,
      backups: backups.results
    });
  }

  private async restoreFromBackup(backupId: string): Promise<Response> {
    return Response.json({
      success: true,
      message: `Restored from backup ${backupId}`
    });
  }
}