---
description: Run database migrations with raw SQL and Neon
allowed-tools: Bash(psql:*), Bash(neonctl:*), Bash(pg_dump:*), Read, Edit, Write
argument-hint: [migration-action]
---

## Database Migration

Action requested: $ARGUMENTS

## Your Task

### 1. Check Current Schema Status
- List migration files in `/migrations` folder
- Connect to database and check current schema:
```bash
psql $DATABASE_URL -c "\dt"
```

### 2. Based on Action:

#### If "create" or no action specified:
Create new migration file with timestamp:
```bash
touch migrations/$(date +%Y%m%d%H%M%S)_migration_name.sql
```
Edit the file with required changes

#### If "apply":
⚠️ WARNING: Test on Neon branch first!
1. Create test branch: `neonctl branches create --name test-migration`
2. Apply to test branch first:
   ```bash
   psql $DATABASE_URL < migrations/latest.sql
   ```
3. Verify application works with new schema
4. Only then apply to production

#### If "backup":
Create database backup:
```bash
pg_dump $DATABASE_URL > backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

#### If "status":
Check migration history and current schema:
```bash
psql $DATABASE_URL -c "SELECT * FROM migrations ORDER BY applied_at DESC LIMIT 10;"
```

### 3. Post-Migration Tasks
- Test affected API endpoints
- Document schema changes
- Update any TypeScript interfaces manually
- Clean up test branches

Always create a backup before production migrations!