# 🚀 Deploying Pitchey to Fly.io

## Why Fly.io Instead of Lagoon?

- **Native Deno Support**: First-class Deno runtime (Lagoon doesn't support Deno)
- **Cost**: $50-300/month vs $400-900/month for Lagoon
- **Simplicity**: One command deployment vs complex Kubernetes setup
- **WebSockets**: Built-in WebSocket support with edge networking
- **Global**: Automatic geographic distribution

## Prerequisites

1. Create a Fly.io account: https://fly.io/signup
2. Install Fly CLI:
```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

## Step-by-Step Deployment

### 1. Authenticate with Fly.io
```bash
fly auth login
```

### 2. Initialize Your App
```bash
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
fly launch --name pitchey --no-deploy
```

### 3. Create PostgreSQL Database
```bash
# Create a PostgreSQL cluster
fly postgres create --name pitchey-db

# Attach it to your app
fly postgres attach pitchey-db

# This will add DATABASE_URL to your app's secrets
```

### 4. Set Environment Variables
```bash
# Set your secrets
fly secrets set JWT_SECRET="your-secure-jwt-secret-here"
fly secrets set JWT_REFRESH_SECRET="your-secure-refresh-secret-here"
fly secrets set STRIPE_SECRET_KEY="your-stripe-secret-key"
fly secrets set STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"
fly secrets set AWS_ACCESS_KEY_ID="your-aws-access-key"
fly secrets set AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
fly secrets set AWS_REGION="us-east-1"
fly secrets set S3_BUCKET_NAME="pitchey-uploads"
fly secrets set EMAIL_PROVIDER="smtp"
fly secrets set SMTP_HOST="smtp.gmail.com"
fly secrets set SMTP_PORT="587"
fly secrets set SMTP_USER="your-email@gmail.com"
fly secrets set SMTP_PASS="your-app-password"
```

### 5. Deploy Your App
```bash
fly deploy
```

### 6. Access Your App
```bash
# Get your app URL
fly status

# Your app will be available at:
# https://pitchey.fly.dev
```

### 7. Set Up Custom Domain (Optional)
```bash
# Add your domain
fly certs add pitchey.com
fly certs add www.pitchey.com
fly certs add api.pitchey.com

# Configure DNS (add these records to your DNS provider):
# A     pitchey.com     -> Fly.io IP (shown after cert add)
# AAAA  pitchey.com     -> Fly.io IPv6 (shown after cert add)
# CNAME www.pitchey.com -> pitchey.fly.dev
# CNAME api.pitchey.com -> pitchey.fly.dev
```

## Monitoring & Management

### View Logs
```bash
fly logs
```

### SSH into Container
```bash
fly ssh console
```

### Scale Your App
```bash
# Add more instances
fly scale count 2

# Increase memory/CPU
fly scale vm shared-cpu-2x
```

### Database Management
```bash
# Connect to PostgreSQL
fly postgres connect -a pitchey-db

# Create backup
fly postgres backup create -a pitchey-db
```

## Deployment Workflow

### For Updates
```bash
# Make your changes
git add .
git commit -m "Update features"

# Deploy to Fly.io
fly deploy

# Check deployment status
fly status
```

### Rollback if Needed
```bash
# List releases
fly releases

# Rollback to previous version
fly deploy --image registry.fly.io/pitchey:v2
```

## Cost Breakdown

### Estimated Monthly Costs:
- **App Hosting**: $5-25 (shared CPU)
- **PostgreSQL**: $15-50 (depending on size)
- **Persistent Storage**: $0.15/GB
- **Bandwidth**: First 100GB free, then $0.02/GB
- **Total**: ~$50-150/month for beta

### Scaling Costs:
- **Production**: $200-500/month
- **High Traffic**: $500-1500/month

## Troubleshooting

### If WebSockets Don't Work:
Add to fly.toml:
```toml
[[services.ports]]
  handlers = ["tls", "http"]
  port = 443
  
[services.ports.http_options]
  response.headers.X-Frame-Options = "SAMEORIGIN"
```

### If Database Connection Fails:
```bash
# Check secrets
fly secrets list

# Ensure DATABASE_URL is set
fly postgres attach pitchey-db --database-name pitchey
```

### If Deploy Fails:
```bash
# Check build logs
fly logs

# SSH and debug
fly ssh console
cd /app
deno run --allow-all multi-portal-server.ts
```

## Advantages Over Lagoon

| Feature | Fly.io | Lagoon |
|---------|--------|---------|
| **Deno Support** | ✅ Native | ❌ Container only |
| **Setup Time** | 15 minutes | 2-4 hours |
| **Monthly Cost** | $50-150 | $400-900 |
| **WebSocket Support** | ✅ Built-in | ⚠️ Manual config |
| **Learning Curve** | Low | High (Kubernetes) |
| **Global Edge** | ✅ Included | ❌ Extra cost |

## Next Steps

1. **Deploy to Fly.io** (15 minutes)
2. **Configure your domain** (30 minutes)
3. **Test all features** (1 hour)
4. **Monitor performance** (ongoing)
5. **Scale as needed** (automatic)

## Support Resources

- Fly.io Docs: https://fly.io/docs
- Fly.io Community: https://community.fly.io
- Status Page: https://status.fly.io
- Support: support@fly.io

---

**Your Pitchey app will be live at `https://pitchey.fly.dev` in less than 30 minutes!** 🎉

This is much simpler, cheaper, and more suitable than Lagoon for your Deno-based application.