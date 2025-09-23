# Pitchey Deno Deploy - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Code Preparation
- [x] Updated database client to use Neon serverless driver
- [x] Created deno.json configuration
- [x] Updated imports for Deno Deploy compatibility
- [x] Created Neon database initialization script
- [x] Tested locally - all authentication endpoints working

### 2. Accounts Setup
- [ ] **Neon Database Account**
  - Sign up at https://neon.tech
  - Create new project: "pitchey-production"
  - Copy connection string
- [ ] **Deno Deploy Account**
  - Sign up at https://deno.com/deploy
  - Connect GitHub account
- [ ] **GitHub Repository**
  - Code committed and pushed
  - Repository accessible to Deno Deploy

### 3. Environment Variables Preparation
- [ ] **DATABASE_URL**: `postgresql://user:pass@host/db?sslmode=require`
- [ ] **JWT_SECRET**: Generated secure random string (32+ chars)
- [ ] **FRONTEND_URL**: `https://pitchey-frontend.fly.dev`
- [ ] **NODE_ENV**: `production`
- [ ] **STRIPE_SECRET_KEY**: (optional for testing)

## 🚀 Deployment Steps

### Step 1: Create Neon Database
1. [ ] Go to https://neon.tech
2. [ ] Create account and new project
3. [ ] Note down connection string
4. [ ] Test connection (optional)

### Step 2: Deploy to Deno Deploy
1. [ ] Go to https://dash.deno.com/projects
2. [ ] Click "New Project"
3. [ ] Connect GitHub repository
4. [ ] Set entry point: `working-server.ts`
5. [ ] Add environment variables (see list above)
6. [ ] Deploy

### Step 3: Initialize Database
1. [ ] Wait for deployment to complete
2. [ ] Set DATABASE_URL environment variable locally
3. [ ] Run: `deno task init-db`
4. [ ] Verify demo users created

### Step 4: Test Deployment
1. [ ] Test health endpoint: `curl https://your-project.deno.dev/api/health`
2. [ ] Test creator login with demo credentials
3. [ ] Test investor login with demo credentials
4. [ ] Test production login with demo credentials
5. [ ] Run full test suite: `./test-deployment.sh https://your-project.deno.dev`

### Step 5: Update Frontend
1. [ ] Update frontend API configuration
2. [ ] Test frontend connection to new backend
3. [ ] Verify all authentication flows work
4. [ ] Test core functionality

## 📋 Demo Credentials

After successful deployment, these credentials should work:

| User Type | Email | Password |
|-----------|-------|----------|
| Creator | alex.creator@demo.com | Demo123 |
| Investor | sarah.investor@demo.com | Demo123 |
| Production | stellar.production@demo.com | Demo123 |

## 🔧 Environment Variables Reference

Copy these to your Deno Deploy project settings:

```env
DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
FRONTEND_URL=https://pitchey-frontend.fly.dev
NODE_ENV=production
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
```

## 🧪 Testing Commands

### Local Testing
```bash
# Test locally
./test-deployment.sh

# Or test specific endpoint
curl http://localhost:8000/api/health
```

### Remote Testing
```bash
# Test deployed version
./test-deployment.sh https://your-project.deno.dev

# Test specific endpoints
curl https://your-project.deno.dev/api/health
curl -X POST https://your-project.deno.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}'
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Ensure Neon database is active
   - Verify SSL mode is required

2. **Authentication Errors**
   - Check JWT_SECRET is set
   - Verify demo users were created
   - Test locally first

3. **CORS Errors**
   - Verify FRONTEND_URL is correct
   - Check origin in frontend requests

4. **502/503 Errors**
   - Check Deno Deploy logs
   - Verify all imports are working
   - Test locally with same environment

### Getting Help

- **Deno Deploy Logs**: Check project dashboard
- **Local Testing**: Run `deno task dev` and check console
- **Database Issues**: Check Neon dashboard
- **Code Issues**: Review error logs in deployment

## ✨ Post-Deployment

### Immediate Tasks
- [ ] Test all authentication endpoints
- [ ] Verify frontend can connect
- [ ] Check all demo credentials work
- [ ] Monitor deployment logs

### Optional Enhancements
- [ ] Set up custom domain
- [ ] Configure monitoring/alerting
- [ ] Set up staging environment
- [ ] Implement rate limiting
- [ ] Add performance monitoring

## 🎉 Success Criteria

Deployment is successful when:
- ✅ Health endpoint returns 200 OK
- ✅ All three demo users can log in
- ✅ Profile endpoint works with authentication
- ✅ Creator dashboard loads successfully
- ✅ Frontend can connect to deployed backend
- ✅ No 502/503 errors in logs

---

**Your Deno Deploy URL**: `https://your-project.deno.dev`

**Frontend Update Required**: Update `config/api.config.ts` to point to new backend URL