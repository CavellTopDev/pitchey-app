# Deno Deploy Deployment Guide for Pitchey Backend

This guide will walk you through deploying the Pitchey backend to Deno Deploy with a Neon PostgreSQL database.

## Prerequisites

1. **Deno Deploy Account**: Sign up at https://deno.com/deploy
2. **Neon Database Account**: Sign up at https://neon.tech
3. **GitHub Repository**: Your code should be in a GitHub repository
4. **Stripe Account**: For payment processing (optional for initial testing)

## Step 1: Set Up Neon Database

### 1.1 Create Neon Project
1. Go to https://neon.tech and sign in
2. Click "Create a project"
3. Choose a name like "pitchey-production"
4. Select a region close to your users
5. Wait for the database to be created

### 1.2 Get Connection String
1. In your Neon dashboard, go to "Connection Details"
2. Copy the connection string that looks like:
   ```
   postgresql://username:password@hostname/database?sslmode=require
   ```
3. Save this for later - you'll need it for Deno Deploy

### 1.3 Initialize Database Schema
After deploying to Deno Deploy (see Step 2), you'll run:
```bash
# Set your DATABASE_URL environment variable
export DATABASE_URL="your-neon-connection-string"

# Run the initialization script
deno task init-db
```

## Step 2: Deploy to Deno Deploy

### 2.1 Connect GitHub Repository
1. Go to https://dash.deno.com/projects
2. Click "New Project"
3. Connect your GitHub account
4. Select your repository containing the Pitchey code
5. Choose the branch (usually `main` or `master`)

### 2.2 Configure Deployment Settings
1. **Entry Point**: Set to `working-server.ts`
2. **Build Command**: Leave empty (Deno Deploy handles this automatically)
3. **Environment Variables**: Add the following:

```env
DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
STRIPE_SECRET_KEY=sk_test_or_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_or_live_your_stripe_publishable_key
NODE_ENV=production
FRONTEND_URL=https://pitchey-frontend.fly.dev
```

### 2.3 Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Secret for JWT token signing (min 32 chars) | `your-super-secure-random-string-here-12345` |
| `STRIPE_SECRET_KEY` | Your Stripe secret key | `sk_test_...` or `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | Your Stripe publishable key | `pk_test_...` or `pk_live_...` |
| `NODE_ENV` | Environment mode | `production` |
| `FRONTEND_URL` | Your frontend URL for CORS | `https://pitchey-frontend.fly.dev` |

### 2.4 Deploy
1. Click "Deploy"
2. Wait for the deployment to complete
3. Note your deployment URL (e.g., `https://your-project.deno.dev`)

## Step 3: Initialize Database

### 3.1 Set Up Database Schema
Once deployed, initialize your database:

```bash
# Use Deno Deploy's URL to run the init script
curl -X POST https://your-project.deno.dev/api/admin/init-db \
  -H "Authorization: Bearer your-admin-token"
```

Or manually run the initialization:
```bash
# Set your DATABASE_URL
export DATABASE_URL="your-neon-connection-string"

# Run locally to initialize remote Neon database
deno run --allow-net --allow-env init-neon-db.ts
```

## Step 4: Update Frontend Configuration

Update your frontend's API configuration to point to your new Deno Deploy URL:

```typescript
// In your frontend config/api.config.ts
const API_BASE_URL = 'https://your-project.deno.dev';
```

## Step 5: Test Deployment

### 5.1 Test Health Endpoint
```bash
curl https://your-project.deno.dev/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-XX-XXTXX:XX:XX.XXXZ",
  "environment": "production"
}
```

### 5.2 Test Authentication
```bash
# Test creator login
curl -X POST https://your-project.deno.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }'
```

Expected response:
```json
{
  "success": true,
  "token": "eyJ...",
  "user": {
    "id": 1,
    "email": "alex.creator@demo.com",
    "userType": "creator",
    ...
  }
}
```

### 5.3 Test Profile Endpoint
```bash
# Use the token from the login response
curl https://your-project.deno.dev/api/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Step 6: Configure Custom Domain (Optional)

1. In Deno Deploy dashboard, go to your project
2. Click "Domains"
3. Add your custom domain (e.g., `api.pitchey.com`)
4. Follow the DNS configuration instructions
5. Update your frontend to use the custom domain

## Step 7: Set Up Monitoring

### 7.1 Enable Deno Deploy Analytics
1. In your project dashboard, enable analytics
2. Monitor response times, error rates, and usage

### 7.2 Set Up External Monitoring
Consider adding services like:
- **Uptime monitoring**: Pingdom, UptimeRobot
- **Error tracking**: Sentry
- **Performance monitoring**: DataDog, New Relic

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify your `DATABASE_URL` is correct
   - Ensure your Neon database is active
   - Check that the connection string includes `?sslmode=require`

2. **CORS Errors**
   - Verify `FRONTEND_URL` environment variable
   - Check that your frontend URL is correctly configured

3. **Authentication Failures**
   - Ensure `JWT_SECRET` is set and matches between deployments
   - Check that demo users were created successfully

4. **502 Errors**
   - Check Deno Deploy logs in the dashboard
   - Verify all environment variables are set
   - Ensure the entry point file exists

### Viewing Logs
1. Go to your Deno Deploy project dashboard
2. Click on "Logs" tab
3. View real-time logs and errors

## Security Best Practices

1. **Environment Variables**: Never commit secrets to your repository
2. **JWT Secret**: Use a strong, random secret (32+ characters)
3. **Database**: Use connection pooling and prepared statements
4. **HTTPS**: Always use HTTPS in production
5. **CORS**: Restrict CORS to your frontend domain only

## Performance Optimization

1. **Database Queries**: Use indexes and optimize slow queries
2. **Caching**: Implement Redis or in-memory caching for frequently accessed data
3. **Connection Pooling**: Neon automatically handles this
4. **CDN**: Use a CDN for static assets

## Backup and Recovery

1. **Database Backups**: Neon provides automatic backups
2. **Code Backups**: Keep your code in version control
3. **Environment Variables**: Document all required environment variables
4. **Deployment History**: Deno Deploy keeps deployment history

## Support and Resources

- **Deno Deploy Docs**: https://deno.com/deploy/docs
- **Neon Docs**: https://neon.tech/docs
- **Pitchey Support**: Check project issues or documentation
- **Community**: Deno Discord, Neon community forums

## Next Steps

1. Set up monitoring and alerting
2. Configure custom domain
3. Implement database migrations
4. Set up staging environment
5. Configure CI/CD pipeline
6. Add performance monitoring
7. Implement rate limiting
8. Set up database backups schedule

---

Your Pitchey backend should now be successfully deployed to Deno Deploy with a Neon database! 🎉