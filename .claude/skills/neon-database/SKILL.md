---
name: neon-database
description: Raw SQL patterns for Neon PostgreSQL with Hyperdrive. Use when working with database queries, migrations, or performance optimization.
---

# Neon PostgreSQL with Raw SQL

## Connection Patterns

### Basic Connection with Hyperdrive
```typescript
import postgres from 'postgres';

// Always use Hyperdrive for connection pooling
export function getDb(env: Env) {
  return postgres(env.HYPERDRIVE.connectionString, {
    prepare: false, // Required for Hyperdrive
    max: 1, // Single connection per request
    idle_timeout: 20,
    connect_timeout: 10,
  });
}
```

### Query Patterns

#### Basic SELECT with Parameters
```typescript
async function getUser(env: Env, userId: string) {
  const sql = getDb(env);
  try {
    const [user] = await sql`
      SELECT id, email, name, role, created_at
      FROM users 
      WHERE id = ${userId}
      AND deleted_at IS NULL
    `;
    return user;
  } finally {
    await sql.end(); // Always close connection
  }
}
```

#### INSERT with RETURNING
```typescript
async function createPitch(env: Env, data: any) {
  const sql = getDb(env);
  try {
    const [pitch] = await sql`
      INSERT INTO pitches (
        title, logline, genre, creator_id, status
      ) VALUES (
        ${data.title},
        ${data.logline},
        ${data.genre},
        ${data.creatorId},
        'draft'
      )
      RETURNING *
    `;
    return pitch;
  } finally {
    await sql.end();
  }
}
```

#### UPDATE with Conditions
```typescript
async function updatePitchStatus(env: Env, pitchId: string, status: string) {
  const sql = getDb(env);
  try {
    const result = await sql`
      UPDATE pitches 
      SET 
        status = ${status},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${pitchId}
      AND creator_id = ${userId} -- Authorization check
      RETURNING *
    `;
    return result[0];
  } finally {
    await sql.end();
  }
}
```

#### Complex JOIN Queries
```typescript
async function getPitchWithDetails(env: Env, pitchId: string) {
  const sql = getDb(env);
  try {
    const [pitch] = await sql`
      SELECT 
        p.*,
        u.name as creator_name,
        u.email as creator_email,
        COUNT(DISTINCT i.id) as investment_count,
        COUNT(DISTINCT n.id) as nda_count
      FROM pitches p
      LEFT JOIN users u ON p.creator_id = u.id
      LEFT JOIN investments i ON p.id = i.pitch_id
      LEFT JOIN ndas n ON p.id = n.pitch_id
      WHERE p.id = ${pitchId}
      GROUP BY p.id, u.name, u.email
    `;
    return pitch;
  } finally {
    await sql.end();
  }
}
```

### Transaction Patterns

```typescript
async function transferFunds(env: Env, fromId: string, toId: string, amount: number) {
  const sql = getDb(env);
  try {
    await sql.begin(async sql => {
      // Deduct from sender
      await sql`
        UPDATE wallets 
        SET balance = balance - ${amount}
        WHERE user_id = ${fromId}
        AND balance >= ${amount}
      `;
      
      // Add to recipient
      await sql`
        UPDATE wallets 
        SET balance = balance + ${amount}
        WHERE user_id = ${toId}
      `;
      
      // Log transaction
      await sql`
        INSERT INTO transactions (from_id, to_id, amount, created_at)
        VALUES (${fromId}, ${toId}, ${amount}, CURRENT_TIMESTAMP)
      `;
    });
    
    return { success: true };
  } catch (error) {
    // Transaction automatically rolled back on error
    throw error;
  } finally {
    await sql.end();
  }
}
```

### Performance Optimization

#### Batch Operations
```typescript
async function batchInsert(env: Env, records: any[]) {
  const sql = getDb(env);
  try {
    // Build values for batch insert
    const values = records.map(r => ({
      title: r.title,
      status: r.status,
      created_at: new Date()
    }));
    
    await sql`
      INSERT INTO items ${sql(values, 'title', 'status', 'created_at')}
    `;
  } finally {
    await sql.end();
  }
}
```

#### Index Usage
```sql
-- Common indexes for the platform
CREATE INDEX idx_pitches_creator_status ON pitches(creator_id, status);
CREATE INDEX idx_ndas_pitch_user ON ndas(pitch_id, user_id);
CREATE INDEX idx_investments_investor ON investments(investor_id, created_at DESC);
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
```

#### Query Optimization
```typescript
// Bad: N+1 query
for (const pitch of pitches) {
  const creator = await getUser(env, pitch.creator_id);
  pitch.creator = creator;
}

// Good: Single query with JOIN
const pitchesWithCreators = await sql`
  SELECT 
    p.*,
    row_to_json(u.*) as creator
  FROM pitches p
  LEFT JOIN users u ON p.creator_id = u.id
  WHERE p.status = 'published'
`;
```

### Migration Management

#### Migration Table
```sql
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Running Migrations
```typescript
async function runMigration(env: Env, filename: string, sqlContent: string) {
  const sql = getDb(env);
  try {
    await sql.begin(async sql => {
      // Execute migration
      await sql.unsafe(sqlContent); // Use unsafe for raw SQL
      
      // Record migration
      await sql`
        INSERT INTO migrations (filename)
        VALUES (${filename})
      `;
    });
  } finally {
    await sql.end();
  }
}
```

## Common Patterns

### Pagination
```typescript
async function getPaginatedPitches(env: Env, page: number, limit: number) {
  const sql = getDb(env);
  const offset = (page - 1) * limit;
  
  try {
    const pitches = await sql`
      SELECT * FROM pitches
      WHERE status = 'published'
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    
    const [{ count }] = await sql`
      SELECT COUNT(*) FROM pitches
      WHERE status = 'published'
    `;
    
    return {
      data: pitches,
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    };
  } finally {
    await sql.end();
  }
}
```

### Search with Full Text
```typescript
async function searchPitches(env: Env, query: string) {
  const sql = getDb(env);
  try {
    return await sql`
      SELECT 
        *,
        ts_rank(search_vector, plainto_tsquery(${query})) as rank
      FROM pitches
      WHERE search_vector @@ plainto_tsquery(${query})
      ORDER BY rank DESC
      LIMIT 20
    `;
  } finally {
    await sql.end();
  }
}
```

## Best Practices

1. **Always close connections** - Use try/finally blocks
2. **Use parameterized queries** - Never concatenate SQL strings
3. **Add appropriate indexes** - Monitor slow queries
4. **Use transactions for consistency** - Especially for multi-table operations
5. **Handle errors gracefully** - Return appropriate HTTP status codes
6. **Avoid SELECT \*** - Specify columns explicitly
7. **Use LIMIT for large result sets** - Implement pagination
8. **Monitor connection pool** - Don't exceed Hyperdrive limits