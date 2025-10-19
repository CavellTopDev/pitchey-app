# Deploy to Deno Deploy - Instructions

## ✅ Code is Ready and Pushed to GitHub

Your updated backend with **real data implementation** (no more mock 15k views!) has been pushed to GitHub:
- Repository: https://github.com/CavellTopDev/pitchey-platform
- Branch: main
- Commit: "Replace all mock data with real backend implementation"

## 🚀 Deploy via Deno Deploy Dashboard

### Step 1: Go to Deno Deploy
1. Open https://dash.deno.com
2. Sign in with your GitHub account

### Step 2: Connect to Your Project
1. Find your existing project: **pitchey-backend**
2. Or create new project if needed

### Step 3: Link GitHub Repository
1. Click **"Settings"** in your project
2. Under **"Git Integration"**:
   - Repository: `CavellTopDev/pitchey-platform`
   - Branch: `main`
   - Entry file: `working-server.ts`

### Step 4: Set Environment Variables
In the **"Environment Variables"** section, ensure these are set:

```bash
DATABASE_URL=postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-very-secure-jwt-secret-key-change-this-in-production
FRONTEND_URL=https://pitchey-frontend.deno.dev
```

### Step 5: Deploy
1. Click **"Link"** to connect the repository
2. Deno Deploy will automatically build and deploy
3. Wait for deployment to complete (usually 1-2 minutes)

## 🧪 Test the Deployment

### 1. Check Health Endpoint
```bash
curl https://pitchey-backend-62414fc1npma.deno.dev/api/health
```

### 2. Test Demo Login (Alex Creator)
```bash
curl -X POST https://pitchey-backend-62414fc1npma.deno.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'
```

### 3. Check Dashboard for Real Data
```bash
# Get token from login response above, then:
curl -X GET https://pitchey-backend-62414fc1npma.deno.dev/api/creator/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected**: You should see real counts (starting from 0), not mock data like 1250 views!

## 📊 What's Changed

### Before (Mock Data)
- 15,000 views (hardcoded)
- 892 followers (hardcoded)
- 1,250 in dashboard (hardcoded)
- Static achievements

### After (Real Data)
- Actual view count from database
- Real follower count from follows table
- True analytics from user interactions
- Dynamic milestones based on activity

## 🔍 Verify No More Mock Data

Run this to check for mock patterns:
```bash
curl -s https://pitchey-backend-62414fc1npma.deno.dev/api/creator/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN" | \
  grep -E "15000|892|1250|mockPitchesData"
```

Should return nothing if mock data is gone!

## 🎯 Important Notes

1. **Database Migration**: The Neon database might need the demo accounts created:
   - The demo accounts (alex.creator@demo.com, etc.) work with password: Demo123
   - If they don't exist, they'll be created on first login attempt

2. **Schema Alignment**: Some columns were removed from schema as they didn't exist in DB:
   - production_timeline
   - title_image_url  
   - lookbook_url, script_url, trailer_url

3. **Real-time Updates**: Every action now updates the database:
   - Views increment on each pitch view
   - Likes toggle and update count
   - Followers tracked in follows table

## ✨ Success Indicators

When successfully deployed with real data:
1. Dashboard shows actual counts (may be 0 initially)
2. No "15k views" or "892 followers" anywhere
3. Views increment when pitches are viewed
4. Likes work as toggle (like/unlike)
5. All stats calculated from database

## 🐛 Troubleshooting

If you still see mock data after deployment:
1. Check deployment logs in Deno Deploy dashboard
2. Verify environment variables are set
3. Ensure latest commit was deployed
4. Clear frontend cache/localStorage

## 📱 Frontend Update

Your frontend at https://pitchey-frontend.deno.dev will automatically start showing real data once the backend is deployed!