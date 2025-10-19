# Deploy Pitchey Backend to Deno Deploy - Complete Guide

## 🚀 Quick Deployment via GitHub Integration

### Step 1: Access Deno Deploy Dashboard
1. Open your browser and go to: **https://dash.deno.com/projects**
2. Sign in with your GitHub account (or create a new account)

### Step 2: Create New Project
1. Click the **"New Project"** button
2. Select **"Deploy from GitHub repository"**

### Step 3: Connect Your Repository
1. If prompted, authorize Deno Deploy to access your GitHub
2. Search for and select: **`CavellTopDev/pitchey-platform`**
3. Choose branch: **`main`**

### Step 4: Configure Deployment Settings
1. **Project Name**: `pitchey-backend` (or any name you prefer)
2. **Entry Point**: `working-server.ts`
3. **Install Step**: Leave empty (Deno doesn't need npm install)
4. **Build Step**: Leave empty

### Step 5: Add Environment Variables
Click on **"Environment Variables"** and add these (copy exactly):

```
DATABASE_URL=postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
```

```
JWT_SECRET=super-secret-jwt-key-for-production-change-this-to-something-secure-at-least-32-chars
```

```
FRONTEND_URL=https://pitchey-frontend.fly.dev
```

```
NODE_ENV=production
```

### Step 6: Deploy
1. Click **"Deploy Project"**
2. Wait for deployment (usually 1-2 minutes)
3. Your backend will be available at: `https://[your-project-name].deno.dev`

## ✅ After Deployment

### Update Frontend Configuration
Once your backend is deployed, update the frontend to use the new URL:

1. Edit `frontend/.env.production`:
```env
VITE_API_URL=https://[your-project-name].deno.dev
VITE_WS_URL=wss://[your-project-name].deno.dev
```

2. Rebuild and redeploy frontend:
```bash
cd frontend
npm run build
~/.fly/bin/flyctl deploy --app pitchey-frontend
```

## 🧪 Test Your Deployment

### Test Basic Connection:
```bash
curl https://[your-project-name].deno.dev/
```

### Test Authentication:
```bash
curl -X POST https://[your-project-name].deno.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}'
```

### Demo Credentials:
- **Creator**: alex.creator@demo.com / Demo123
- **Investor**: sarah.investor@demo.com / Demo123
- **Production**: stellar.production@demo.com / Demo123

## 🔧 Troubleshooting

### If deployment fails:
1. Check the deployment logs in Deno Deploy dashboard
2. Verify all environment variables are set correctly
3. Ensure the GitHub repository is accessible

### Common Issues:
- **Module not found errors**: Already fixed in latest commit
- **Database connection errors**: Check DATABASE_URL is correct
- **CORS errors**: Frontend URL must match FRONTEND_URL env var

## 📝 Notes
- The Neon database is already initialized with demo data
- JWT tokens expire after 7 days
- The backend supports WebSocket connections for real-time messaging
- All authentication endpoints are working and tested

## 🎯 Expected Result
Once deployed, you'll have:
- ✅ Serverless backend on Deno's global edge network
- ✅ Automatic scaling and high availability
- ✅ Connected to Neon PostgreSQL database
- ✅ All authentication endpoints working
- ✅ Demo accounts ready to use

Your deployment URL will be: `https://[your-project-name].deno.dev`

Replace `[your-project-name]` with the actual project name you chose during setup.