# Automated Backup Strategy Guide

## Overview
Comprehensive backup strategy for Pitchey platform covering database, files, configuration, and code.

## Backup Components

### 1. Database Backups (Neon PostgreSQL)

#### 1.1 Neon Built-in Backups
```yaml
Automatic Features:
- Point-in-time recovery: 7 days (free) / 30 days (pro)
- Continuous replication
- Branching from any point
- Zero-downtime restoration
```

#### 1.2 Custom Backup Worker
```typescript
// src/workers/backup-worker.ts
export class BackupWorker {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async performDatabaseBackup() {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupName = `pitchey-db-${timestamp}.sql`;

    // Use Neon branching API for backup
    const response = await fetch('https://console.neon.tech/api/v2/projects/YOUR_PROJECT_ID/branches', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.NEON_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: {
          name: `backup-${timestamp}`,
          parent_id: 'main'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Backup failed: ${response.statusText}`);
    }

    // Store backup metadata
    await this.env.KV.put(`backup:db:${timestamp}`, JSON.stringify({
      name: backupName,
      timestamp,
      type: 'database',
      size: 'branch',
      location: 'neon',
      branch_name: `backup-${timestamp}`
    }), {
      expirationTtl: 90 * 24 * 60 * 60 // Keep metadata for 90 days
    });

    return { success: true, backupName };
  }
}
```

### 2. File Storage Backups (R2)

#### 2.1 R2 Replication Worker
```typescript
// src/workers/r2-backup-worker.ts
export class R2BackupWorker {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async backupR2Bucket() {
    const sourceBucket = this.env.R2_BUCKET;
    const backupBucket = this.env.R2_BACKUP_BUCKET;
    const timestamp = new Date().toISOString();

    // List all objects in source bucket
    const objects = await sourceBucket.list();

    // Copy each object to backup bucket with timestamp prefix
    const backupPromises = objects.objects.map(async (object) => {
      const data = await sourceBucket.get(object.key);
      if (data) {
        const backupKey = `backup-${timestamp}/${object.key}`;
        await backupBucket.put(backupKey, data.body, {
          httpMetadata: data.httpMetadata,
          customMetadata: {
            ...data.customMetadata,
            backup_timestamp: timestamp,
            original_key: object.key
          }
        });
      }
    });

    await Promise.all(backupPromises);

    // Store backup manifest
    const manifest = {
      timestamp,
      object_count: objects.objects.length,
      total_size: objects.objects.reduce((sum, obj) => sum + (obj.size || 0), 0)
    };

    await backupBucket.put(
      `backup-${timestamp}/manifest.json`,
      JSON.stringify(manifest)
    );

    return manifest;
  }

  async cleanOldBackups(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const list = await this.env.R2_BACKUP_BUCKET.list();
    
    for (const object of list.objects) {
      if (object.uploaded < cutoffDate) {
        await this.env.R2_BACKUP_BUCKET.delete(object.key);
      }
    }
  }
}
```

### 3. Configuration Backups

#### 3.1 KV Namespace Backup
```typescript
// src/workers/kv-backup-worker.ts
export class KVBackupWorker {
  async backupKVNamespace(env: Env) {
    const timestamp = new Date().toISOString();
    const backup: Record<string, any> = {};

    // List all KV keys
    let cursor: string | undefined;
    do {
      const list = await env.KV.list({ cursor });
      
      for (const key of list.keys) {
        const value = await env.KV.get(key.name);
        const metadata = await env.KV.getWithMetadata(key.name);
        
        backup[key.name] = {
          value,
          metadata: metadata.metadata,
          expiration: key.expiration
        };
      }
      
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    // Store backup in R2
    const backupData = JSON.stringify(backup, null, 2);
    await env.R2_BACKUP_BUCKET.put(
      `kv-backup-${timestamp}.json`,
      backupData,
      {
        customMetadata: {
          type: 'kv_backup',
          timestamp,
          key_count: Object.keys(backup).length.toString()
        }
      }
    );

    return {
      timestamp,
      keys: Object.keys(backup).length,
      size: new Blob([backupData]).size
    };
  }

  async restoreKVNamespace(env: Env, backupTimestamp: string) {
    // Retrieve backup from R2
    const backupObject = await env.R2_BACKUP_BUCKET.get(`kv-backup-${backupTimestamp}.json`);
    if (!backupObject) {
      throw new Error(`Backup not found: ${backupTimestamp}`);
    }

    const backup = await backupObject.json() as Record<string, any>;

    // Restore each key
    for (const [key, data] of Object.entries(backup)) {
      const options: KVNamespacePutOptions = {};
      
      if (data.metadata) {
        options.metadata = data.metadata;
      }
      
      if (data.expiration) {
        options.expiration = data.expiration;
      }

      await env.KV.put(key, data.value, options);
    }

    return { restored: Object.keys(backup).length };
  }
}
```

### 4. Code Repository Backup

#### 4.1 GitHub Integration
```typescript
// src/workers/github-backup-worker.ts
export class GitHubBackupWorker {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async createRepositoryBackup() {
    const timestamp = new Date().toISOString();
    
    // Create GitHub release as backup point
    const response = await fetch('https://api.github.com/repos/YOUR_ORG/pitchey/releases', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        tag_name: `backup-${timestamp}`,
        name: `Automated Backup ${timestamp}`,
        body: `Automated backup created on ${timestamp}`,
        draft: false,
        prerelease: true
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub backup failed: ${response.statusText}`);
    }

    const release = await response.json();

    // Export repository as archive
    const archiveResponse = await fetch(
      `https://api.github.com/repos/YOUR_ORG/pitchey/zipball/main`,
      {
        headers: {
          'Authorization': `Bearer ${this.env.GITHUB_TOKEN}`
        }
      }
    );

    const archive = await archiveResponse.arrayBuffer();

    // Store archive in R2
    await this.env.R2_BACKUP_BUCKET.put(
      `code-backup-${timestamp}.zip`,
      archive,
      {
        customMetadata: {
          type: 'code_backup',
          timestamp,
          release_id: release.id.toString(),
          size: archive.byteLength.toString()
        }
      }
    );

    return {
      release_id: release.id,
      tag: release.tag_name,
      size: archive.byteLength
    };
  }
}
```

## Scheduled Backup Implementation

### 5.1 Backup Scheduler Worker
```typescript
// src/workers/backup-scheduler.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const backupManager = new BackupManager(env);
    
    switch (event.cron) {
      case '0 2 * * *': // Daily at 2 AM UTC
        await ctx.waitUntil(backupManager.performDailyBackup());
        break;
        
      case '0 3 * * 0': // Weekly on Sunday at 3 AM UTC
        await ctx.waitUntil(backupManager.performWeeklyBackup());
        break;
        
      case '0 4 1 * *': // Monthly on 1st at 4 AM UTC
        await ctx.waitUntil(backupManager.performMonthlyBackup());
        break;
    }
  }
};

class BackupManager {
  private env: Env;
  private dbBackup: BackupWorker;
  private r2Backup: R2BackupWorker;
  private kvBackup: KVBackupWorker;
  private githubBackup: GitHubBackupWorker;

  constructor(env: Env) {
    this.env = env;
    this.dbBackup = new BackupWorker(env);
    this.r2Backup = new R2BackupWorker(env);
    this.kvBackup = new KVBackupWorker(env);
    this.githubBackup = new GitHubBackupWorker(env);
  }

  async performDailyBackup() {
    const results = {
      database: false,
      kv: false,
      timestamp: new Date().toISOString()
    };

    try {
      // Database backup (via Neon branching)
      await this.dbBackup.performDatabaseBackup();
      results.database = true;
    } catch (error) {
      console.error('Database backup failed:', error);
      await this.notifyBackupFailure('database', error);
    }

    try {
      // KV namespace backup
      await this.kvBackup.backupKVNamespace(this.env);
      results.kv = true;
    } catch (error) {
      console.error('KV backup failed:', error);
      await this.notifyBackupFailure('kv', error);
    }

    // Log backup results
    await this.logBackupResults('daily', results);
  }

  async performWeeklyBackup() {
    const results = {
      r2: false,
      code: false,
      timestamp: new Date().toISOString()
    };

    try {
      // R2 bucket backup
      await this.r2Backup.backupR2Bucket();
      results.r2 = true;
      
      // Clean old R2 backups (keep 30 days)
      await this.r2Backup.cleanOldBackups(30);
    } catch (error) {
      console.error('R2 backup failed:', error);
      await this.notifyBackupFailure('r2', error);
    }

    try {
      // Code repository backup
      await this.githubBackup.createRepositoryBackup();
      results.code = true;
    } catch (error) {
      console.error('Code backup failed:', error);
      await this.notifyBackupFailure('code', error);
    }

    await this.logBackupResults('weekly', results);
  }

  async performMonthlyBackup() {
    // Perform full system backup
    const results = {
      full_backup: false,
      timestamp: new Date().toISOString()
    };

    try {
      // Create comprehensive backup
      await Promise.all([
        this.dbBackup.performDatabaseBackup(),
        this.r2Backup.backupR2Bucket(),
        this.kvBackup.backupKVNamespace(this.env),
        this.githubBackup.createRepositoryBackup()
      ]);
      
      results.full_backup = true;
      
      // Generate backup report
      await this.generateBackupReport();
    } catch (error) {
      console.error('Monthly backup failed:', error);
      await this.notifyBackupFailure('monthly', error);
    }

    await this.logBackupResults('monthly', results);
  }

  async notifyBackupFailure(type: string, error: any) {
    // Send email notification
    const emailService = new EmailService(this.env);
    await emailService.sendEmail(
      this.env.ADMIN_EMAIL,
      `Backup Failure: ${type}`,
      `<p>The ${type} backup failed with error:</p><pre>${error.message}</pre>`
    );

    // Log to monitoring service
    await this.env.KV.put(
      `backup:failure:${Date.now()}`,
      JSON.stringify({ type, error: error.message, timestamp: new Date().toISOString() })
    );
  }

  async logBackupResults(schedule: string, results: any) {
    await this.env.KV.put(
      `backup:log:${schedule}:${Date.now()}`,
      JSON.stringify(results),
      { expirationTtl: 90 * 24 * 60 * 60 } // Keep logs for 90 days
    );
  }

  async generateBackupReport() {
    const report = {
      generated: new Date().toISOString(),
      backups: {
        database: [],
        r2: [],
        kv: [],
        code: []
      },
      storage_usage: {
        r2_backup_bucket: 0,
        total_backups: 0
      }
    };

    // Collect backup information
    const list = await this.env.KV.list({ prefix: 'backup:' });
    for (const key of list.keys) {
      const backup = await this.env.KV.get(key.name, 'json');
      if (backup && backup.type) {
        report.backups[backup.type].push(backup);
      }
    }

    // Calculate storage usage
    const r2List = await this.env.R2_BACKUP_BUCKET.list();
    report.storage_usage.r2_backup_bucket = r2List.objects.reduce(
      (sum, obj) => sum + (obj.size || 0), 0
    );
    report.storage_usage.total_backups = r2List.objects.length;

    // Store report
    await this.env.KV.put(
      `backup:report:${Date.now()}`,
      JSON.stringify(report)
    );

    return report;
  }
}
```

### 5.2 Wrangler Configuration for Scheduled Backups
```toml
# wrangler-backup.toml
name = "pitchey-backup-scheduler"
main = "src/workers/backup-scheduler.ts"
compatibility_date = "2024-11-01"

# Environment variables
[vars]
ENVIRONMENT = "production"
ADMIN_EMAIL = "admin@pitchey.com"

# Bindings
[[kv_namespaces]]
binding = "KV"
id = "98c88a185eb448e4868fcc87e458b3ac"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "pitchey-uploads"

[[r2_buckets]]
binding = "R2_BACKUP_BUCKET"
bucket_name = "pitchey-backups"

# Cron triggers
[[triggers.crons]]
cron = "0 2 * * *"  # Daily at 2 AM UTC

[[triggers.crons]]
cron = "0 3 * * 0"  # Weekly on Sunday at 3 AM UTC

[[triggers.crons]]
cron = "0 4 1 * *"  # Monthly on 1st at 4 AM UTC
```

## Disaster Recovery

### 6.1 Recovery Procedures
```typescript
// src/workers/disaster-recovery.ts
export class DisasterRecovery {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async recoverDatabase(backupBranch: string) {
    // Use Neon API to restore from branch
    const response = await fetch(
      `https://console.neon.tech/api/v2/projects/${this.env.NEON_PROJECT_ID}/branches/${backupBranch}/restore`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.NEON_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Database recovery failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async recoverR2Bucket(backupTimestamp: string) {
    const backupBucket = this.env.R2_BACKUP_BUCKET;
    const targetBucket = this.env.R2_BUCKET;

    // List backup objects
    const list = await backupBucket.list({ prefix: `backup-${backupTimestamp}/` });

    // Restore each object
    for (const object of list.objects) {
      const data = await backupBucket.get(object.key);
      if (data) {
        // Remove backup prefix from key
        const originalKey = object.key.replace(`backup-${backupTimestamp}/`, '');
        await targetBucket.put(originalKey, data.body, {
          httpMetadata: data.httpMetadata,
          customMetadata: data.customMetadata
        });
      }
    }

    return { restored: list.objects.length };
  }

  async recoverKV(backupTimestamp: string) {
    const kvBackup = new KVBackupWorker();
    return await kvBackup.restoreKVNamespace(this.env, backupTimestamp);
  }

  async performFullRecovery(backupTimestamp: string) {
    const results = {
      database: false,
      r2: false,
      kv: false,
      timestamp: new Date().toISOString()
    };

    // Step 1: Recover database
    try {
      await this.recoverDatabase(`backup-${backupTimestamp}`);
      results.database = true;
    } catch (error) {
      console.error('Database recovery failed:', error);
    }

    // Step 2: Recover R2 storage
    try {
      await this.recoverR2Bucket(backupTimestamp);
      results.r2 = true;
    } catch (error) {
      console.error('R2 recovery failed:', error);
    }

    // Step 3: Recover KV namespace
    try {
      await this.recoverKV(backupTimestamp);
      results.kv = true;
    } catch (error) {
      console.error('KV recovery failed:', error);
    }

    return results;
  }
}
```

## Monitoring & Alerts

### 7.1 Backup Monitoring Dashboard
```typescript
// src/api/backup-status.ts
export async function getBackupStatus(env: Env) {
  const status = {
    last_backups: {
      daily: null,
      weekly: null,
      monthly: null
    },
    upcoming_backups: {
      daily: getNextCronRun('0 2 * * *'),
      weekly: getNextCronRun('0 3 * * 0'),
      monthly: getNextCronRun('0 4 1 * *')
    },
    storage_usage: {
      backups_count: 0,
      total_size: 0
    },
    health: 'healthy'
  };

  // Get last backup times
  const dailyList = await env.KV.list({ prefix: 'backup:log:daily:', limit: 1 });
  if (dailyList.keys.length > 0) {
    status.last_backups.daily = await env.KV.get(dailyList.keys[0].name, 'json');
  }

  // Check backup health
  const lastDaily = status.last_backups.daily;
  if (lastDaily) {
    const hoursSinceBackup = 
      (Date.now() - new Date(lastDaily.timestamp).getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceBackup > 48) {
      status.health = 'warning';
    }
    if (hoursSinceBackup > 72) {
      status.health = 'critical';
    }
  }

  return status;
}

function getNextCronRun(cron: string): string {
  // Calculate next run time based on cron expression
  // Implementation would use a cron parser library
  return new Date().toISOString();
}
```

## Backup Storage Costs

### Estimated Monthly Costs
```yaml
Neon PostgreSQL:
  - Branches: Free (included in plan)
  - Storage: $0.15/GB-month

Cloudflare R2:
  - Storage: $0.015/GB-month
  - Operations: $0.36/million requests
  - Egress: Free

Total Estimated:
  - 10GB database: $1.50/month
  - 100GB R2 storage: $1.50/month
  - Total: ~$3/month for comprehensive backups
```

## Testing Backup & Recovery

### 8.1 Test Backup Script
```bash
#!/bin/bash
# test-backup.sh

echo "Testing Pitchey Backup System"
echo "=============================="

# Test database backup
echo "1. Testing database backup..."
curl -X POST https://api.pitchey.com/api/admin/backup/database \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test R2 backup
echo "2. Testing R2 backup..."
curl -X POST https://api.pitchey.com/api/admin/backup/storage \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test KV backup
echo "3. Testing KV backup..."
curl -X POST https://api.pitchey.com/api/admin/backup/kv \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check backup status
echo "4. Checking backup status..."
curl https://api.pitchey.com/api/admin/backup/status \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 8.2 Test Recovery Script
```bash
#!/bin/bash
# test-recovery.sh

echo "Testing Pitchey Recovery System"
echo "================================"

# List available backups
echo "Available backups:"
curl https://api.pitchey.com/api/admin/backup/list \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test recovery (dry run)
echo "Testing recovery (dry run)..."
curl -X POST https://api.pitchey.com/api/admin/recovery/test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": "2024-12-02T02:00:00Z", "dry_run": true}'
```

## Backup Checklist

- [ ] Neon database backup configured
- [ ] R2 backup bucket created
- [ ] KV backup system implemented
- [ ] GitHub backup integration
- [ ] Scheduled cron jobs deployed
- [ ] Email notifications configured
- [ ] Monitoring dashboard created
- [ ] Recovery procedures tested
- [ ] Documentation updated
- [ ] Team trained on recovery
- [ ] Backup retention policy set
- [ ] Storage costs budgeted
- [ ] Compliance requirements met
- [ ] Disaster recovery plan documented
- [ ] Regular recovery drills scheduled

## Next Steps

1. Deploy backup scheduler worker
2. Test all backup procedures
3. Document recovery runbook
4. Set up monitoring alerts
5. Schedule quarterly recovery drills