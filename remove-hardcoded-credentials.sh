#!/bin/bash

# Script to remove hardcoded database credentials from codebase
# These should be stored in environment variables instead

echo "🔒 Removing hardcoded database credentials..."

# Define patterns to search for
PATTERNS=(
  "npg_YibeIGRuv40J"
  "npg_DZhIpVaLAk06"
  "postgresql://neondb_owner:[^@]*@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb"
)

# Create .env.example if it doesn't exist
if [ ! -f .env.example ]; then
  cat > .env.example << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Authentication
JWT_SECRET=your-secret-key

# Cloudflare
CLOUDFLARE_API_TOKEN=your-cloudflare-token

# Sentry (optional)
SENTRY_DSN=your-sentry-dsn
EOF
  echo "✅ Created .env.example file"
fi

# Replace hardcoded credentials with environment variables in TypeScript/JavaScript files
echo "📝 Updating TypeScript/JavaScript files..."
find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
  -not -path "./node_modules/*" \
  -not -path "./dist/*" \
  -not -path "./.git/*" \
  -exec grep -l "npg_YibeIGRuv40J\|npg_DZhIpVaLAk06" {} \; | while read file; do
  
  # Skip if file is in archive or deprecated folder
  if [[ "$file" == *"/archive/"* ]] || [[ "$file" == *"/archived_"* ]] || [[ "$file" == *"/deprecated/"* ]]; then
    continue
  fi
  
  echo "  Updating: $file"
  
  # Replace full connection strings with environment variable
  sed -i 's|postgresql://neondb_owner:[^@]*@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb[^"]*|${process.env.DATABASE_URL || Deno.env.get("DATABASE_URL")}|g' "$file"
  
  # Replace standalone passwords
  sed -i 's/npg_YibeIGRuv40J/${process.env.DB_PASSWORD}/g' "$file"
  sed -i 's/npg_DZhIpVaLAk06/${process.env.DB_PASSWORD}/g' "$file"
done

# Update shell scripts
echo "📝 Updating shell scripts..."
find . -type f -name "*.sh" \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -exec grep -l "npg_YibeIGRuv40J\|npg_DZhIpVaLAk06" {} \; | while read file; do
  
  # Skip if file is in archive or deprecated folder
  if [[ "$file" == *"/archive/"* ]] || [[ "$file" == *"/archived_"* ]] || [[ "$file" == *"/deprecated/"* ]]; then
    continue
  fi
  
  echo "  Updating: $file"
  
  # Replace passwords with environment variable
  sed -i 's/npg_YibeIGRuv40J/$DB_PASSWORD/g' "$file"
  sed -i 's/npg_DZhIpVaLAk06/$DB_PASSWORD/g' "$file"
done

# Update config files
echo "📝 Updating config files..."
for file in drizzle.config.ts wrangler.toml; do
  if [ -f "$file" ]; then
    echo "  Updating: $file"
    sed -i 's|postgresql://neondb_owner:[^@]*@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb.*|env.DATABASE_URL|g' "$file"
  fi
done

# Remove backup files containing credentials
echo "🗑️  Removing backup files with credentials..."
find . -type f \( -name "*.backup" -o -name "*.exposed.backup" \) -exec rm {} \;

# Create gitignore entries
if ! grep -q "# Sensitive files" .gitignore 2>/dev/null; then
  echo "" >> .gitignore
  echo "# Sensitive files" >> .gitignore
  echo "*.exposed.backup" >> .gitignore
  echo "*-credentials.txt" >> .gitignore
  echo ".env.local" >> .gitignore
  echo ".env.production" >> .gitignore
  echo "✅ Updated .gitignore"
fi

echo ""
echo "✅ Credential removal complete!"
echo ""
echo "⚠️  IMPORTANT: Set these environment variables before running:"
echo "  DATABASE_URL=postgresql://neondb_owner:<password>@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
echo "  DB_PASSWORD=<your-password>"
echo ""
echo "For Cloudflare Workers, add these secrets:"
echo "  wrangler secret put DATABASE_URL"
echo "  wrangler secret put DB_PASSWORD"