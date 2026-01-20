# Database Consistency Tests - Quick Start

## Running Tests

### All Database Tests (Recommended)
```bash
npm run db:test
```

### Individual Test Suites
```bash
# Comprehensive consistency (tables, schema, FKs, indexes)
npm run db:test:consistency

# Referential integrity (orphaned records, relationships)
npm run db:test:integrity

# Data quality (business rules, validation)
npm run db:test:quality
```

## What Gets Tested

### 1. Table Existence (80+ tables)
- Core: users, sessions, accounts
- Pitches: pitches, pitch_views, pitch_likes
- Investments: investments, portfolio, deals
- Messaging: messages, conversations, attachments
- Notifications: notifications, preferences
- Production: projects, companies, budgets
- Contracts: contracts, milestones
- Email: logs, campaigns, templates

### 2. Schema Validation
- Required columns exist
- Proper data types
- Primary keys on all tables
- Timestamp columns (created_at, updated_at)

### 3. Referential Integrity
- No orphaned pitches (creator deleted)
- No orphaned messages (sender deleted)
- No orphaned investments (user deleted)
- Valid NDA request relationships
- Valid conversation participants

### 4. Data Quality
- Valid email formats
- No duplicate emails
- created_at <= updated_at
- No future timestamps
- Non-negative amounts
- Valid equity percentages (0-100%)
- No self-follows or self-likes

### 5. Business Rules
- Users can't follow themselves
- Users can't like their own pitches
- NDA requester != pitch owner
- Valid status transitions
- Conversations have >= 2 participants

## Expected Output

### Success
```
✓ All test suites PASSED
```

### Warnings (Non-critical)
```
Found 3 orphaned pitch views
```
These are logged but don't fail tests if acceptable.

### Failures
```
✗ DB Consistency FAILED
  - Found 5 orphaned pitches
```
These must be fixed.

## Common Issues

### Issue: Missing Tables
**Error**: `Table 'pitches' not found`
**Fix**: Run migrations
```bash
npm run db:migrate
```

### Issue: Orphaned Records
**Error**: `Found X orphaned pitches`
**Fix**: Clean up orphaned data
```sql
DELETE FROM pitches WHERE creator_id NOT IN (SELECT id FROM users);
```

### Issue: Invalid Foreign Keys
**Error**: `Invalid NDA requests found`
**Fix**: Add foreign key constraints or clean data

## Test Results Interpretation

| Test Result | Action Required |
|------------|-----------------|
| All PASSED | Safe to deploy |
| Warnings | Review and decide |
| Failures | MUST fix before deploy |

## Pre-Deployment Checklist

Before deploying database changes:

1. Run all tests: `npm run db:test`
2. Review warnings
3. Fix all failures
4. Re-run tests
5. Deploy when green

## CI/CD Integration

Add to your pipeline:
```yaml
- name: Database Consistency Tests
  run: npm run db:test
```

## Need Help?

- Check full docs: `tests/database/README.md`
- Review schema: `src/db/migrations/`
- Check test files for specific validations
