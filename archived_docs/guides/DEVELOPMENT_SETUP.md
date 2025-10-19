# Pitchey Platform Development Setup Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Backend Setup](#backend-setup)
5. [Frontend Setup](#frontend-setup)
6. [Development Workflow](#development-workflow)
7. [Testing](#testing)
8. [Debugging](#debugging)
9. [Common Issues](#common-issues)
10. [Development Tools](#development-tools)

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| **Deno** | 1.37+ | [https://deno.land/#installation](https://deno.land/#installation) |
| **Node.js** | 18+ | [https://nodejs.org/](https://nodejs.org/) |
| **PostgreSQL** | 14+ | [https://www.postgresql.org/download/](https://www.postgresql.org/download/) |
| **Git** | 2.30+ | [https://git-scm.com/downloads](https://git-scm.com/downloads) |
| **VS Code** (recommended) | Latest | [https://code.visualstudio.com/](https://code.visualstudio.com/) |

### System Requirements

- **OS**: macOS, Linux, or Windows with WSL2
- **RAM**: Minimum 8GB, recommended 16GB
- **Storage**: At least 10GB free space
- **CPU**: Multi-core processor recommended

### Verify Installations

```bash
# Check Deno
deno --version

# Check Node.js and npm
node --version
npm --version

# Check PostgreSQL
psql --version

# Check Git
git --version
```

## Environment Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/pitchey/pitchey-platform.git
cd pitchey-platform/pitchey_v0.2

# Create your feature branch
git checkout -b feature/your-feature-name
```

### 2. Environment Variables

Create `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Database Configuration
DATABASE_URL=postgresql://pitchey_user:your_password@localhost:5432/pitchey_dev
DATABASE_POOL_SIZE=20

# Security Keys (generate secure random strings)
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Development Environment
DENO_ENV=development
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug

# API Configuration
API_PORT=8000
API_HOST=localhost
BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8000

# Email Service (for development, use console output)
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@pitchey.local
EMAIL_FROM_NAME=Pitchey Dev
EMAIL_PREVIEW_MODE=true

# File Upload
UPLOAD_DIR=./static/uploads
MAX_FILE_SIZE=10485760

# Stripe (use test keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3 (optional for development)
AWS_S3_BUCKET=pitchey-dev-uploads
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Feature Flags
ENABLE_WEBSOCKET=true
ENABLE_EMAIL_QUEUE=true
ENABLE_ANALYTICS=true
ENABLE_AI_FEATURES=false

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. VS Code Setup

Install recommended extensions:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "denoland.vscode-deno",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "dsznajder.es7-react-js-snippets",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "cweijan.vscode-postgresql-client2"
  ]
}
```

Configure VS Code settings:

```json
// .vscode/settings.json
{
  "deno.enable": true,
  "deno.lint": true,
  "deno.unstable": true,
  "deno.import_intellisense_origins": {
    "https://deno.land": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "denoland.vscode-deno",
  "[typescript]": {
    "editor.defaultFormatter": "denoland.vscode-deno"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Database Configuration

### 1. PostgreSQL Setup

#### macOS
```bash
# Install with Homebrew
brew install postgresql
brew services start postgresql

# Create user and database
createuser -s pitchey_user
createdb pitchey_dev -O pitchey_user
```

#### Linux (Ubuntu/Debian)
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create user and database
sudo -u postgres createuser -s pitchey_user
sudo -u postgres createdb pitchey_dev -O pitchey_user
```

#### Windows (WSL2)
```bash
# Install PostgreSQL in WSL2
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo service postgresql start

# Create user and database
sudo -u postgres createuser -s pitchey_user
sudo -u postgres createdb pitchey_dev -O pitchey_user
```

### 2. Database Migration

```bash
# Run initial migrations
deno run --allow-all src/db/migrate.ts

# Verify migrations
psql -U pitchey_user -d pitchey_dev -c "\dt"

# Seed development data (optional)
deno run --allow-all src/db/seed.ts
```

### 3. Database Management Tools

#### pgAdmin (GUI)
```bash
# Install pgAdmin
# macOS: brew install --cask pgadmin4
# Linux: sudo apt install pgadmin4
# Windows: Download from https://www.pgadmin.org/
```

#### TablePlus (Recommended)
- Download from [https://tableplus.com/](https://tableplus.com/)
- Create connection with your database credentials

## Backend Setup

### 1. Install Deno Dependencies

```bash
# Cache all dependencies
deno cache --reload multi-portal-server.ts

# Verify dependencies
deno info multi-portal-server.ts
```

### 2. Start Backend Server

```bash
# Development mode with watch
deno run --allow-all --watch multi-portal-server.ts

# Or use the task runner
deno task dev:backend
```

The backend server will start on `http://localhost:8000`

### 3. Verify Backend

```bash
# Test health endpoint
curl http://localhost:8000/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-21T..."}
```

## Frontend Setup

### 1. Navigate to Frontend Directory

```bash
cd frontend
```

### 2. Install Dependencies

```bash
# Install npm packages
npm install

# Or with yarn
yarn install

# Or with pnpm
pnpm install
```

### 3. Start Frontend Development Server

```bash
# Start Vite dev server
npm run dev

# Or with specific port
npm run dev -- --port 5173
```

The frontend will be available at `http://localhost:5173`

### 4. Frontend Build

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## Development Workflow

### 1. Project Structure

```
pitchey_v0.2/
├── src/                    # Backend source code
│   ├── config/            # Configuration files
│   ├── db/               # Database schema and migrations
│   ├── middleware/       # Server middleware
│   ├── services/         # Business logic services
│   ├── schemas/          # Validation schemas
│   └── utils/            # Utility functions
├── routes/               # API route handlers
│   └── api/             # API endpoints
├── frontend/             # React frontend application
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   ├── store/      # State management
│   │   └── lib/        # Utilities and helpers
│   └── public/         # Static assets
├── tests/               # Test files
├── drizzle/            # Database migrations
├── static/             # Static files served by backend
└── legal/              # Legal documents
```

### 2. Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/your-feature

# Create pull request on GitHub
```

### 3. Code Style

#### Backend (Deno/TypeScript)
```bash
# Format code
deno fmt

# Lint code
deno lint

# Type check
deno check multi-portal-server.ts
```

#### Frontend (React/TypeScript)
```bash
cd frontend

# Format code
npm run format

# Lint code
npm run lint

# Type check
npm run type-check
```

### 4. Database Changes

```bash
# Generate new migration
deno run --allow-all drizzle-kit generate:pg

# Apply migration
deno run --allow-all src/db/migrate.ts

# Rollback migration (if needed)
deno run --allow-all src/db/rollback.ts
```

## Testing

### 1. Backend Testing

```bash
# Run all tests
deno test --allow-all

# Run specific test file
deno test --allow-all tests/api.integration.test.ts

# Run with coverage
deno test --allow-all --coverage=coverage

# Generate coverage report
deno coverage coverage --lcov > coverage.lcov
```

### 2. Frontend Testing

```bash
cd frontend

# Run unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run e2e tests (requires backend running)
npm run test:e2e
```

### 3. Security Testing

```bash
# Run security tests
deno run --allow-all test-security-features.ts

# Test rate limiting
for i in {1..10}; do curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}'; done

# Test SQL injection protection
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin' OR '1'='1","password":"'; DROP TABLE users; --"}'
```

## Debugging

### 1. Backend Debugging

#### Using VS Code
1. Create launch configuration:

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Deno: Run",
      "request": "launch",
      "type": "pwa-node",
      "program": "${workspaceFolder}/multi-portal-server.ts",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "deno",
      "runtimeArgs": ["run", "--inspect-brk", "--allow-all"],
      "attachSimplePort": 9229
    }
  ]
}
```

2. Set breakpoints in VS Code
3. Press F5 to start debugging

#### Using Chrome DevTools
```bash
# Start server with inspector
deno run --inspect --allow-all multi-portal-server.ts

# Open Chrome and navigate to:
chrome://inspect

# Click "inspect" next to the Deno process
```

### 2. Frontend Debugging

#### React Developer Tools
1. Install React Developer Tools extension
2. Open browser DevTools
3. Navigate to Components/Profiler tabs

#### Redux DevTools (if using Redux)
```typescript
// In store configuration
const store = configureStore({
  reducer: rootReducer,
  devTools: process.env.NODE_ENV !== 'production'
});
```

### 3. Database Debugging

```sql
-- Enable query logging in PostgreSQL
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- View logs
-- Location varies by OS:
-- macOS: /usr/local/var/log/postgresql.log
-- Linux: /var/log/postgresql/postgresql-*.log

-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Common Issues

### Issue 1: Database Connection Failed

**Error**: `Cannot connect to database`

**Solution**:
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Verify connection string
psql "postgresql://pitchey_user:password@localhost:5432/pitchey_dev"

# Check pg_hba.conf for authentication
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Ensure: local all all md5
```

### Issue 2: CORS Errors

**Error**: `Access to fetch at ... from origin ... has been blocked by CORS`

**Solution**:
```typescript
// Verify ALLOWED_ORIGINS in .env.local includes your frontend URL
ALLOWED_ORIGINS=http://localhost:5173

// Restart backend server
```

### Issue 3: Module Not Found

**Error**: `Module not found`

**Solution**:
```bash
# For backend
deno cache --reload multi-portal-server.ts

# For frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Issue 4: Port Already in Use

**Error**: `Port 8000 is already in use`

**Solution**:
```bash
# Find process using port
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### Issue 5: TypeScript Errors

**Solution**:
```bash
# Clear Deno cache
deno cache --reload multi-portal-server.ts

# For frontend
cd frontend
npm run type-check
```

## Development Tools

### 1. API Testing

#### Postman
- Import collection from `/docs/postman-collection.json`
- Set environment variables for local development

#### HTTPie
```bash
# Install
brew install httpie  # macOS
apt install httpie   # Linux

# Test API
http POST localhost:8000/api/auth/login \
  email=test@test.com \
  password=testpassword
```

#### Thunder Client (VS Code)
- Install Thunder Client extension
- Import collection from `/docs/thunder-collection.json`

### 2. Database Tools

#### Drizzle Studio
```bash
# Launch Drizzle Studio
npx drizzle-kit studio

# Open browser at http://localhost:4983
```

#### Database Migrations
```bash
# Generate migration from schema changes
npx drizzle-kit generate:pg

# Push schema changes directly (dev only)
npx drizzle-kit push:pg
```

### 3. Performance Monitoring

#### Backend Performance
```bash
# Run with profiling
deno run --allow-all --v8-flags=--prof multi-portal-server.ts

# Process profiling data
deno run --allow-all --v8-flags=--prof-process isolate-*.log
```

#### Frontend Performance
```bash
# Build with bundle analysis
cd frontend
npm run build -- --analyze

# Lighthouse audit
npm run lighthouse
```

### 4. Code Quality Tools

#### SonarQube (Optional)
```bash
# Run SonarQube locally
docker run -d -p 9000:9000 sonarqube

# Run analysis
sonar-scanner
```

#### Code Coverage
```bash
# Backend coverage
deno test --allow-all --coverage=coverage
deno coverage coverage

# Frontend coverage
cd frontend
npm run test:coverage
```

## Hot Reload Setup

### Backend Hot Reload
```bash
# Using denon (install globally)
deno install -qAf --unstable https://deno.land/x/denon/denon.ts

# Create denon.json
{
  "scripts": {
    "start": {
      "cmd": "deno run --allow-all multi-portal-server.ts",
      "watch": true
    }
  }
}

# Run with hot reload
denon start
```

### Frontend Hot Reload
Already configured with Vite - changes reflect immediately.

## Docker Development

### Using Docker Compose
```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up backend

# Rebuild after changes
docker-compose up --build
```

### Docker Configuration
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: pitchey_dev
      POSTGRES_USER: pitchey_user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://pitchey_user:password@postgres:5432/pitchey_dev
    depends_on:
      - postgres
    volumes:
      - .:/app
      - /app/node_modules

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  postgres_data:
```

## Troubleshooting Tips

1. **Clear all caches**:
```bash
# Deno cache
rm -rf ~/.cache/deno

# npm cache
npm cache clean --force

# Browser cache
# Open DevTools > Application > Clear Storage
```

2. **Reset database**:
```bash
dropdb pitchey_dev
createdb pitchey_dev
deno run --allow-all src/db/migrate.ts
deno run --allow-all src/db/seed.ts
```

3. **Check logs**:
```bash
# Backend logs
tail -f deno.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log

# Frontend build logs
cd frontend && npm run build --verbose
```

---

*Last Updated: January 2025*
*Version: 2.0*

For development support, join our Discord or email dev-support@pitchey.com