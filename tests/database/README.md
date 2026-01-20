# Database Consistency Test Suite

Comprehensive database testing for the Pitchey platform. Tests validate schema integrity, referential consistency, data quality, and business rules across all three portals (creator, investor, production).

## Test Files

### 1. `db-consistency.test.ts`
**Primary comprehensive test suite**

Tests:
- Table existence (80+ expected tables)
- Schema validation (required columns, data types)
- Foreign key constraints
- Primary keys
- Indexes
- Orphaned records detection
- Portal-specific data integrity
- Enum/status value validation
- Timestamp consistency
- Database statistics and health metrics

### 2. `referential-integrity.test.ts`
**Deep foreign key relationship validation**

Tests:
- User relationship integrity
- Pitch relationship integrity
- NDA relationship validation
- Investment relationships
- Messaging system relationships
- Production portal relationships
- Contract relationships
- Email system relationships

### 3. `data-quality.test.ts`
**Business rules and data quality validation**

Tests:
- Email format validation
- Timestamp logic (created_at < updated_at)
- Numeric data validation (amounts, percentages)
- Business logic (no self-follows, self-likes)
- Message content validation
- File URL and size validation
- Production budget calculations
- Location coordinate validation
- Notification expiration logic

## Running Tests

### Run All Database Tests
```bash
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
bun test tests/database/
```

### Run Specific Test Suite
```bash
# Comprehensive tests
bun test tests/database/db-consistency.test.ts

# Referential integrity only
bun test tests/database/referential-integrity.test.ts

# Data quality only
bun test tests/database/data-quality.test.ts
```

### Run with Verbose Output
```bash
bun test tests/database/ --verbose
```

### Run with Coverage
```bash
bun test tests/database/ --coverage
```

## Environment Setup

The tests use the production Neon PostgreSQL database:
- Connection string is loaded from `DATABASE_URL` environment variable
- Falls back to the production connection string if not set
- Tests are READ-ONLY and safe to run against production

### Environment Variable
```bash
export DATABASE_URL="postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

## Test Results Interpretation

### Success Criteria
- All tables exist with proper schemas
- No orphaned records
- All foreign keys valid
- Business rules enforced
- Data types consistent
- No future timestamps
- Valid enum values

### Common Issues

#### Orphaned Records
```
Found X orphaned pitches
```
**Cause**: Pitches exist with creator_id pointing to deleted users
**Fix**: Run data cleanup migration to remove orphaned records

#### Invalid Foreign Keys
```
Found X invalid conversation participants
```
**Cause**: Records reference non-existent parent records
**Fix**: Add CASCADE delete rules or cleanup orphaned data

#### Timestamp Inconsistencies
```
Table has X records with created_at > updated_at
```
**Cause**: Data imported or migrated incorrectly
**Fix**: Update records to ensure created_at <= updated_at

#### Missing Indexes
```
No index found on frequently queried column
```
**Cause**: Performance optimization needed
**Fix**: Add index via migration

## Database Tables Tested

### Core Tables
- users
- sessions
- accounts
- verifications

### Pitch System
- pitches
- pitch_views
- pitch_likes
- saved_pitches
- pitch_shares

### NDA System
- nda_requests
- ndas

### Investment Portal
- investments
- investment_deals
- investment_performance
- investment_risk_analysis
- portfolio
- budget_allocations
- completed_projects
- financial_transactions
- market_data
- tax_documents

### Messaging System
- conversations
- conversation_participants
- messages
- message_attachments
- message_reactions
- message_read_receipts
- typing_indicators
- message_encryption_keys
- message_search_index
- blocked_users
- conversation_settings

### Notification System
- notifications
- notification_preferences
- notification_deliveries
- notification_logs
- notification_templates
- notification_digests
- notification_metrics

### Email System
- email_logs
- email_templates
- email_queue
- email_preferences
- email_tracking_events
- email_campaigns
- email_suppressions
- email_webhooks
- email_lists
- email_list_subscribers
- email_ab_tests
- email_health_metrics
- email_unsubscribe_requests
- email_analytics_summary

### Production Portal
- production_companies
- production_projects
- production_talent
- production_crew
- location_scouts
- production_budgets
- production_schedules

### Creator Portal
- contracts
- contract_milestones
- creator_revenue

### Engagement
- follows
- likes
- views
- reviews
- investment_interests
- production_interests
- user_activity
- search_logs
- page_views
- analytics_events

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Database Consistency Tests
  run: bun test tests/database/
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Pre-Deployment Checks
Run these tests before any database migration:
```bash
npm run test:db:pre-deploy
```

## Maintenance

### Adding New Tests
1. Identify the data consistency requirement
2. Choose appropriate test file (consistency, integrity, or quality)
3. Write test with clear assertion
4. Add documentation to this README

### Test Performance
- Tests use indexed queries where possible
- LIMIT clauses prevent full table scans
- Read-only operations ensure safety

### Updating Expected Tables
When adding new tables to the schema:
1. Update `EXPECTED_TABLES` array in `db-consistency.test.ts`
2. Add relationship tests in `referential-integrity.test.ts`
3. Add business rule tests in `data-quality.test.ts`

## Troubleshooting

### Connection Timeout
```
Error: Connection timeout
```
**Solution**: Check network connectivity to Neon database

### Permission Denied
```
Error: Permission denied for table
```
**Solution**: Verify DATABASE_URL credentials

### Table Not Found
```
Error: relation "table_name" does not exist
```
**Solution**: Run migrations or check table name spelling

## Contact

For questions or issues with database tests:
- Check test output for specific error details
- Review database schema in `src/db/migrations/`
- Consult CLAUDE.md for project context
