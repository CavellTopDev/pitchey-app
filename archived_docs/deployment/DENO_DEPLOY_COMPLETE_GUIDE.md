# 🚀 Complete Pitchey Platform Deployment on Deno Deploy

Your platform consists of two parts that need to be deployed:
1. **Backend API** (already created as `pitchey-backend`)
2. **Frontend Application** (needs to be created)

## Step 1: Deploy Backend API

### Go to Deno Deploy Dashboard
1. Open: **https://dash.deno.com/projects/pitchey-backend**
2. Click **"Link a GitHub repository"**
3. Select: **CavellTopDev/pitchey-platform**
4. Branch: **main**
5. Entry Point: **`working-server.ts`**
6. Click **"Link"**

The backend will deploy automatically and be available at:
**https://pitchey-backend.deno.dev**

## Step 2: Deploy Frontend Application

### Create New Project for Frontend
1. Go to: **https://dash.deno.com/projects**
2. Click **"New Project"**
3. Name it: **`pitchey-frontend`**

### Link GitHub Repository
1. Click **"Link a GitHub repository"**
2. Select: **CavellTopDev/pitchey-platform**
3. Branch: **main**
4. **Entry Point**: `frontend-server.ts`
5. Click **"Link"**

The frontend will deploy and be available at:
**https://pitchey-frontend.deno.dev**

## Step 3: Test Your Deployment

### Test Backend API:
```bash
curl https://pitchey-backend.deno.dev/
```
Expected: `{"success":true,"message":"Pitchey API Server"}`

### Test Frontend:
Open in browser: **https://pitchey-frontend.deno.dev**

You should see the Pitchey homepage!

### Test Login Flow:
1. Go to: **https://pitchey-frontend.deno.dev/login**
2. Click **"Use Creator Account"**
3. Login with:
   - Email: **alex.creator@demo.com**
   - Password: **Demo123**
4. You should be redirected to the Creator Dashboard

## 🎯 Your Live URLs

After deployment, your platform will be live at:

- **Frontend**: https://pitchey-frontend.deno.dev
- **Backend API**: https://pitchey-backend.deno.dev
- **WebSocket**: wss://pitchey-backend.deno.dev

## 📝 Demo Accounts

### Creator Account:
- Email: alex.creator@demo.com
- Password: Demo123

### Investor Account:
- Email: sarah.investor@demo.com
- Password: Demo123

### Production Account:
- Email: stellar.production@demo.com
- Password: Demo123

## ✅ What You Get

- ✨ Full-stack application hosted on Deno's edge network
- 🚀 Automatic SSL/TLS certificates
- 🌍 Global CDN distribution
- ⚡ Auto-scaling and high availability
- 💾 Connected to Neon PostgreSQL database
- 🔐 Secure authentication with JWT
- 💬 Real-time WebSocket messaging
- 🎬 Complete pitch management system

## 🆘 Troubleshooting

### If frontend shows API errors:
The frontend is already configured to use `https://pitchey-backend.deno.dev` as the API URL.

### If you want custom domains later:
You can add custom domains in the Deno Deploy dashboard under Settings > Domains.

### Support:
- Deno Deploy Docs: https://docs.deno.com/deploy/
- Neon Database: https://neon.tech/docs

---

**That's it!** Your complete Pitchey platform will be live in about 1 minute! 🎉