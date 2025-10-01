# 🚀 Coolify Deployment Guide

Your application is **READY TO DEPLOY** to Coolify! All configuration files have been created.

## ✅ What's Been Prepared

### Files Created for Coolify:
- `docker-compose.coolify.yml` - Complete stack configuration
- `Dockerfile.backend` - Deno backend container
- `frontend/Dockerfile` - Nginx-optimized frontend
- `frontend/nginx.conf` - Production nginx config
- `.env.coolify` - Environment variables (JWT secret already generated!)

### Your Stack Includes:
- **Backend**: Deno with all APIs
- **Frontend**: React with Nginx
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **All in one deployment!**

## 📋 Next Steps

### Step 1: Push to GitHub

```bash
# Your code is already committed! Just push:
git push origin main

# Or create a new repo:
gh repo create pitchey-app --public --source=. --push
```

### Step 2: Set Up Coolify

1. **Install Coolify on your VPS** (if not done):
   ```bash
   curl -fsSL https://get.coolify.io | bash
   ```

2. **Access Coolify Dashboard**:
   ```
   https://your-server-ip:8000
   ```

### Step 3: Deploy in Coolify

1. **Click "New Resource"** → **"Docker Compose"**

2. **Connect GitHub**:
   - Repository: `your-username/pitchey-app`
   - Branch: `main`
   - Docker Compose file: `docker-compose.coolify.yml`

3. **Configure Environment** (in Coolify):
   ```env
   JWT_SECRET=i0DUQ0U/5PUhRIvGvp075H/K3NLOpa+3JpRLa2bTwNA=
   FRONTEND_URL=https://your-domain.com
   ```
   (JWT_SECRET is already generated and secure!)

4. **Click Deploy!**

### Step 4: Configure Domain (Optional)

In Coolify:
1. Go to your resource settings
2. Add your domain
3. Enable "Generate SSL Certificate"
4. Coolify handles Let's Encrypt automatically!

## 🎯 What You Get

### With Coolify ($5-10/month VPS):
- ✅ **Everything in one place** - No external services needed
- ✅ **Automatic SSL** - HTTPS with Let's Encrypt
- ✅ **One-click updates** - Push to GitHub, click deploy
- ✅ **Built-in monitoring** - CPU, memory, logs
- ✅ **Automatic backups** - Database snapshots
- ✅ **No vendor lock-in** - Your server, your data
- ✅ **WebSockets work** - Real-time features
- ✅ **No cold starts** - Always running

## 🔧 Configuration Details

### Ports Exposed:
- Frontend: `3000` (mapped to 80/443 by Coolify)
- Backend: `8001` (internal)
- Database: `5432` (internal)
- Redis: `6379` (internal)

### Resource Requirements:
- **Minimum VPS**: 2GB RAM, 1 CPU
- **Recommended**: 4GB RAM, 2 CPU
- **Storage**: 20GB (includes database)

### Database Access:
If you need to access PostgreSQL:
```bash
# In Coolify terminal or SSH
docker exec -it <container-name> psql -U postgres -d pitchey
```

### Redis Monitoring:
```bash
# Check Redis
docker exec -it <redis-container> redis-cli INFO
```

## 📊 Monitoring

### In Coolify Dashboard:
- **Logs**: Real-time application logs
- **Metrics**: CPU, Memory, Network
- **Deployments**: History and rollback
- **Health Checks**: Automatic monitoring

### Application Health:
```bash
# Check backend health
curl https://your-domain.com/api/health

# Should return:
{
  "status": "healthy",
  "cache": {
    "type": "redis",
    "distributed": true
  }
}
```

## 🚀 Alternative: Coolify Build Packs

Instead of Docker Compose, you can deploy separately:

### Backend (Deno):
1. New Resource → **Deno**
2. Start command: `deno run --allow-all working-server.ts`
3. Port: `8001`

### Frontend (Static):
1. New Resource → **Static Site**
2. Build command: `cd frontend && npm run build`
3. Output directory: `frontend/dist`

### Database:
1. New Resource → **PostgreSQL**
2. Version: 15
3. Note connection string

### Redis:
1. New Resource → **Redis**
2. Version: 7

## 🆚 Comparison

| Feature | Vercel/Deno Deploy | Coolify |
|---------|-------------------|---------|
| **Cost** | $0 (with limits) | $5-10/month (unlimited) |
| **Control** | Limited | Complete |
| **Privacy** | Cloud providers | Your server |
| **Complexity** | Multiple services | One dashboard |
| **Scaling** | Automatic | Manual (but flexible) |
| **Best for** | MVPs, testing | Production, privacy |

## 🛠️ Troubleshooting

### If deployment fails:
1. Check Coolify logs for errors
2. Verify environment variables are set
3. Ensure ports aren't conflicting
4. Check VPS has enough resources

### If database connection fails:
- Internal hostname should be `db` not `localhost`
- Connection string: `postgresql://postgres:password@db:5432/pitchey`

### If frontend can't reach backend:
- Internal URL should be `http://backend:8001`
- Check CORS settings in backend

## 🎉 Success!

Once deployed, you'll have:
- **Frontend**: `https://your-domain.com`
- **Backend API**: `https://your-domain.com/api`
- **Database**: PostgreSQL (internal)
- **Cache**: Redis (internal)

All managed from one Coolify dashboard with:
- Automatic SSL
- One-click updates
- Built-in monitoring
- Automatic backups

---

**Ready to deploy?** Your code is committed and all configuration files are prepared. Just push to GitHub and configure in Coolify! 🚀