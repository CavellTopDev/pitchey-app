# Complete Drizzle Schema Fix Protocol for Pitchey

## Quick Fix (If you need pitches working NOW)

Run these commands immediately to fix the schema and get your pitches showing:

```bash
# 1. First, backup your current schema
cp src/db/schema.ts src/db/schema.backup.ts

# 2. Create and run the schema analyzer
cat > analyze-schema-issues.ts << 'EOF'
#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

console.log("🔍 Analyzing Schema Issues...\n");

// Check what columns actually exist
const pitchColumns = await sql`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'pitches'
  ORDER BY ordinal_position
`;

console.log("Actual database columns for pitches table:");
pitchColumns.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

// Test a simple query
try {
  const testQuery = await sql`SELECT * FROM pitches LIMIT 1`;
  console.log("\n✅ Direct SQL query works!");
} catch (error) {
  console.log("\n❌ Direct SQL failed:", error.message);
}
EOF

deno run --allow-env --allow-net --allow-read analyze-schema-issues.ts
```

## Immediate Fix for Pitches Table

Replace your `src/db/schema.ts` pitches table definition with this corrected version:

```typescript
export const pitches = pgTable("pitches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  // Basic fields that exist in your database
  title: varchar("title", { length: 255 }).notNull(),
  logline: text("logline").notNull(),
  genre: varchar("genre", { length: 100 }),
  format: varchar("format", { length: 100 }),
  budget: varchar("budget", { length: 100 }),
  
  // Content fields
  shortSynopsis: text("short_synopsis"),
  longSynopsis: text("long_synopsis"),
  
  // Status and metrics
  status: varchar("status", { length: 50 }).default("draft"),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  ndaCount: integer("nda_count").default(0),
  
  // Media URLs
  thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
  lookbookUrl: varchar("lookbook_url", { length: 500 }),
  scriptUrl: varchar("script_url", { length: 500 }),
  trailerUrl: varchar("trailer_url", { length: 500 }),
  pitchDeckUrl: varchar("pitch_deck_url", { length: 500 }),
  
  // Settings
  requireNda: boolean("require_nda").default(false),
  
  // Timestamps
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

## Complete Diagnostic Script

```bash
cat > complete-schema-fix.ts << 'EOF'
#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read --allow-write

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

console.log("🔧 COMPLETE SCHEMA FIX GENERATOR");
console.log("=".repeat(80));

// Function to convert snake_case to camelCase
const toCamelCase = (str: string) => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Function to map PostgreSQL types to Drizzle
const pgToDrizzle = (dataType: string, columnName: string, charLength: number | null) => {
  switch (dataType) {
    case 'integer':
      return columnName === 'id' ? `serial("${columnName}")` : `integer("${columnName}")`;
    case 'character varying':
      return charLength ? `varchar("${columnName}", { length: ${charLength} })` : `varchar("${columnName}")`;
    case 'text':
      return `text("${columnName}")`;
    case 'boolean':
      return `boolean("${columnName}")`;
    case 'timestamp without time zone':
      return `timestamp("${columnName}")`;
    case 'numeric':
    case 'decimal':
      return `decimal("${columnName}")`;
    case 'jsonb':
      return `jsonb("${columnName}")`;
    default:
      return `varchar("${columnName}")`;
  }
};

// Generate correct schema for each table
const tables = ['users', 'pitches', 'follows', 'ndas', 'messages', 'notifications', 'portfolio', 'pitch_views'];

let schemaOutput = `// CORRECTED SCHEMA - Generated ${new Date().toISOString()}
import { 
  pgTable, 
  serial, 
  integer, 
  varchar, 
  text, 
  boolean, 
  timestamp, 
  decimal, 
  jsonb 
} from "npm:drizzle-orm/pg-core";

`;

for (const tableName of tables) {
  console.log(`\nGenerating schema for: ${tableName}`);
  
  const columns = await sql\`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_name = \${tableName}
    ORDER BY ordinal_position
  \`;
  
  const constraints = await sql\`
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = \${tableName} 
      AND tc.constraint_type = 'FOREIGN KEY'
  \`;
  
  const camelCaseTableName = toCamelCase(tableName);
  schemaOutput += \`\nexport const \${camelCaseTableName} = pgTable("\${tableName}", {\n\`;
  
  for (const col of columns) {
    const fieldName = toCamelCase(col.column_name);
    let drizzleType = pgToDrizzle(col.data_type, col.column_name, col.character_maximum_length);
    
    // Add constraints
    if (col.column_name === 'id') {
      drizzleType += '.primaryKey()';
    } else if (col.is_nullable === 'NO' && !col.column_default) {
      drizzleType += '.notNull()';
    }
    
    // Add defaults
    if (col.column_default) {
      if (col.column_default.includes('CURRENT_TIMESTAMP') || col.column_default.includes('now()')) {
        drizzleType += '.defaultNow()';
      } else if (col.column_default === '0') {
        drizzleType += '.default(0)';
      } else if (col.column_default === 'false' || col.column_default === 'true') {
        drizzleType += \`.default(\${col.column_default})\`;
      } else if (col.column_default.includes("'draft'")) {
        drizzleType += '.default("draft")';
      }
    }
    
    // Add foreign keys
    const fk = constraints.find(c => c.column_name === col.column_name);
    if (fk) {
      const refTable = toCamelCase(fk.foreign_table_name);
      drizzleType += \`.references(() => \${refTable}.\${toCamelCase(fk.foreign_column_name)}, { onDelete: "cascade" })\`;
    }
    
    schemaOutput += \`  \${fieldName}: \${drizzleType},\n\`;
  }
  
  schemaOutput += '});\n';
}

// Save the corrected schema
await Deno.writeTextFile("src/db/schema.corrected.ts", schemaOutput);
console.log("\n✅ Corrected schema saved to: src/db/schema.corrected.ts");

// Also create a minimal working version
const minimalSchema = \`// MINIMAL WORKING SCHEMA
import { pgTable, serial, integer, varchar, text, boolean, timestamp } from "npm:drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  userType: varchar("user_type", { length: 50 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  bio: text("bio"),
  location: varchar("location", { length: 255 }),
  profileImageUrl: varchar("profile_image", { length: 500 }),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pitches = pgTable("pitches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  logline: text("logline").notNull(),
  genre: varchar("genre", { length: 100 }),
  format: varchar("format", { length: 100 }),
  budget: varchar("budget", { length: 100 }),
  shortSynopsis: text("short_synopsis"),
  longSynopsis: text("long_synopsis"),
  status: varchar("status", { length: 50 }).default("draft"),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  ndaCount: integer("nda_count").default(0),
  thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
  lookbookUrl: varchar("lookbook_url", { length: 500 }),
  scriptUrl: varchar("script_url", { length: 500 }),
  trailerUrl: varchar("trailer_url", { length: 500 }),
  pitchDeckUrl: varchar("pitch_deck_url", { length: 500 }),
  requireNda: boolean("require_nda").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => users.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id").references(() => users.id, { onDelete: "cascade" }),
  followedAt: timestamp("followed_at").defaultNow(),
});

export const ndas = pgTable("ndas", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  requesterId: integer("requester_id").references(() => users.id, { onDelete: "cascade" }),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("pending"),
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  documentUrl: varchar("document_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").references(() => users.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 255 }),
  content: text("content"),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "set null" }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pitchViews = pgTable("pitch_views", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  viewerId: integer("viewer_id").references(() => users.id, { onDelete: "cascade" }),
  viewType: varchar("view_type", { length: 50 }),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }),
  title: varchar("title", { length: 255 }),
  message: text("message"),
  relatedId: integer("related_id"),
  relatedType: varchar("related_type", { length: 50 }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portfolio = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 50 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
\`;

await Deno.writeTextFile("src/db/schema.minimal.ts", minimalSchema);
console.log("✅ Minimal schema saved to: src/db/schema.minimal.ts");

console.log("\n📝 Next Steps:");
console.log("1. Backup current schema: cp src/db/schema.ts src/db/schema.backup.ts");
console.log("2. Replace with minimal: cp src/db/schema.minimal.ts src/db/schema.ts");
console.log("3. Commit and push: git add . && git commit -m 'Fix schema' && git push");
EOF

deno run --allow-env --allow-net --allow-read --allow-write complete-schema-fix.ts
```

## Apply the Fix

```bash
# 1. Backup current schema
cp src/db/schema.ts src/db/schema.backup.$(date +%Y%m%d_%H%M%S).ts

# 2. Replace with the minimal working schema
cp src/db/schema.minimal.ts src/db/schema.ts

# 3. Test locally
deno run --allow-all working-server.ts &
# Wait a moment then test
curl http://localhost:8000/api/health

# 4. If working, commit and deploy
git add src/db/schema.ts
git commit -m "Fix schema to match Neon database structure exactly

- Remove non-existent columns (opener, premise, etc.)
- Change enums to varchar to match database
- Fix all field mappings
- Ensure all column names match database

This fixes the empty pitches array issue."

git push origin main

# 5. Wait for deployment (60-90 seconds)
sleep 90

# 6. Test production
curl https://pitchey-backend-fresh.deno.dev/api/health
```

## Verification Script

```bash
cat > verify-fix.ts << 'EOF'
#!/usr/bin/env -S deno run --allow-net

const API_URL = "https://pitchey-backend-fresh.deno.dev";

console.log("🔍 Verifying Schema Fix...\n");

// Login
const login = await fetch(`${API_URL}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "alex.creator@demo.com",
    password: "Demo123"
  })
});

const { data: { token } } = await login.json();

// Get pitches
const pitches = await fetch(`${API_URL}/api/creator/pitches`, {
  headers: { "Authorization": `Bearer ${token}` }
});

const pitchData = await pitches.json();

if (pitchData.data?.pitches?.length > 0) {
  console.log(`✅ SUCCESS! Found ${pitchData.data.pitches.length} pitches`);
  console.log("Your pitches are now visible at:");
  console.log("https://pitchey.pages.dev/creator/pitches");
} else {
  console.log("❌ Still not working. Check deployment logs.");
}
EOF

deno run --allow-net verify-fix.ts
```

## Common Issues and Solutions

### Issue 1: "column opener does not exist"
**Solution**: Remove or comment out these fields from schema.ts:
- opener
- premise  
- targetAudience
- characters
- themes
- episodeBreakdown
- budgetBracket
- estimatedBudget
- visibilitySettings
- aiUsed

### Issue 2: Enum type mismatch
**Solution**: Change all enum fields to varchar:
```typescript
// WRONG
genre: genreEnum("genre")
// CORRECT
genre: varchar("genre", { length: 100 })
```

### Issue 3: CamelCase vs snake_case
**Solution**: Ensure field names map to correct database columns:
```typescript
// Field name can be camelCase, but column name must match database
userId: integer("user_id")  // NOT integer("userId")
```

### Issue 4: Wrong field types
**Solution**: Match database types exactly:
- Database has `varchar` → use `varchar()` not `text()`
- Database has `timestamp without time zone` → use `timestamp()`
- Database has `integer` → use `integer()` not `number()`

## Emergency Fallback

If schema fixes don't work, use this in PitchService.ts:

```typescript
static async getUserPitches(userId: number) {
  try {
    // Try Drizzle first
    const pitches = await db.select().from(pitches).where(eq(pitches.userId, userId));
    return pitches;
  } catch (error) {
    // Fallback to direct SQL
    const DATABASE_URL = Deno.env.get("DATABASE_URL");
    const sql = neon(DATABASE_URL);
    const pitches = await sql`
      SELECT * FROM pitches 
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `;
    return pitches;
  }
}
```

This ensures pitches always load even if schema has issues.