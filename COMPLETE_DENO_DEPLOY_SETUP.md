# Complete Your Deno Deploy Setup - Final Steps

## ✅ What's Already Done
- Project "pitchey-backend" created on Deno Deploy
- Code pushed to GitHub repository: CavellTopDev/pitchey-platform
- All Fly.io configurations removed
- Environment variables prepared

## 🔧 Complete the Deployment (2 minutes)

### Step 1: Open Deno Deploy Dashboard
1. Go to: **https://dash.deno.com/projects/pitchey-backend**
2. You should see your project page

### Step 2: Connect GitHub Repository
1. Click **"Link a GitHub repository"** button
2. If not already authorized, click **"Configure GitHub App"**
3. Select repository: **CavellTopDev/pitchey-platform**
4. Choose branch: **main**

### Step 3: Configure Build Settings
1. **Entry Point**: `working-server.ts`
2. **Install Step**: (leave empty)
3. **Build Step**: (leave empty)
4. **Root Directory**: (leave empty or `.`)

### Step 4: Add Environment Variables
Click **"Add Variable"** and add each of these (copy the entire line):

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

### Step 5: Deploy
1. Click **"Link"** or **"Deploy"** button
2. Wait for deployment (usually 30-60 seconds)
3. Your backend will be live at: **https://pitchey-backend.deno.dev**

## 🧪 Test Your Deployment

Once deployed, test these endpoints:

### 1. Basic Health Check:
```bash
curl https://pitchey-backend.deno.dev/
```
Expected: `{"success":true,"message":"Pitchey API Server"}`

### 2. Test Authentication:
```bash
curl -X POST https://pitchey-backend.deno.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}'
```
Expected: JWT token response

## 📱 Update Frontend Configuration

After successful deployment, update your frontend:

1. Edit `frontend/.env.production`:
```env
VITE_API_URL=https://pitchey-backend.deno.dev
VITE_WS_URL=wss://pitchey-backend.deno.dev
```

2. Rebuild and redeploy frontend:
```bash
cd frontend
npm run build
~/.fly/bin/flyctl deploy --app pitchey-frontend
```

## ✨ Expected Result
- Backend running on Deno's edge network: **https://pitchey-backend.deno.dev**
- Automatic SSL/TLS
- Global CDN distribution
- Auto-scaling
- Connected to Neon PostgreSQL

## 🆘 If You Have Issues

### "Deployment not found" error:
- Make sure you clicked "Link" after configuring GitHub
- Check the deployments tab for any errors

### "Build failed" error:
- Verify entry point is exactly: `working-server.ts`
- Make sure the main branch has the latest code

### Database connection errors:
- Double-check the DATABASE_URL environment variable
- Ensure it includes `?sslmode=require` at the end

---

**Your deployment URL will be: https://pitchey-backend.deno.dev**

Once you complete these steps, the authentication flow will work end-to-end!