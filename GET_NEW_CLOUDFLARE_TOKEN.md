# Get New Cloudflare API Token

## ⚠️ Current Token Issue
Your existing token (`-QyXWKHN8Op_OiUUrqsjm8gHRb1DeI6ICNA7agLQ`) is returning:
- **Error**: Authentication error [code: 10000]
- **HTTP Status**: 403 Forbidden
- **Reason**: Insufficient permissions or expired token

## 🔑 Create New Token (2 minutes)

### Step 1: Go to Cloudflare Dashboard
1. Open: https://dash.cloudflare.com/profile/api-tokens
2. Sign in with your Cloudflare account

### Step 2: Create Token
1. Click **"Create Token"** button
2. Select **"Custom token"** template
3. Give it a name: `Pitchey Worker Deploy`

### Step 3: Set Permissions
Add these **EXACT** permissions:

#### Account Permissions:
- **Account** → **Cloudflare Workers Scripts** → **Edit**
- **Account** → **Account Settings** → **Read**

#### Zone Permissions (if you have a domain):
- **Zone** → **Workers Routes** → **Edit**

### Step 4: Configure Token Settings
- **Account Resources**: Include → Your account (e16d3bf549153de23459a6c6a06a431b)
- **Zone Resources**: Include → All zones (or specific zone if you have one)
- **Client IP Address Filtering**: Leave blank (optional)
- **TTL**: Leave as default

### Step 5: Create and Copy
1. Click **"Continue to summary"**
2. Review permissions
3. Click **"Create Token"**
4. **IMPORTANT**: Copy the token immediately (you won't see it again!)

## 🚀 Deploy With New Token

Once you have the new token:

```bash
# Set the new token
export CLOUDFLARE_API_TOKEN="your-new-token-here"

# Deploy
./deploy-now.sh
```

## 🔍 Verify Token Works

Test your token first:
```bash
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
     -H "Authorization: Bearer YOUR_NEW_TOKEN_HERE" \
     -H "Content-Type:application/json"
```

Should return:
```json
{"result":{"id":"...","status":"active"},"success":true}
```

## 💡 Token Best Practices
- Store in password manager
- Never commit to Git
- Rotate every 90 days
- Use minimal required permissions

## 📱 Alternative: Use Wrangler Login

If token creation is complex:
```bash
# Interactive login (opens browser)
wrangler login

# Then deploy
wrangler deploy --env production
```

---

Your account ID: `e16d3bf549153de23459a6c6a06a431b`
Worker name: `pitchey-optimized`