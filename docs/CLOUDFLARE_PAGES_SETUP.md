# Cloudflare Pages Setup Documentation

## Current Deployment Architecture

### Active Cloudflare Pages Projects

We have **two** Cloudflare Pages projects configured:

1. **Primary Project: `pitchey`**
   - **Production URL**: https://pitchey-5o8.pages.dev
   - **Custom Domain**: https://pitchey-5o8.pages.dev (if configured)
   - **Deployment Method**: GitHub Actions (automated)
   - **Last Updated**: 8 minutes ago
   - **Status**: ✅ ACTIVE - This is what GitHub Actions deploys to

2. **Secondary Project: `pitchey-5o8`**
   - **Production URL**: https://pitchey-5o8-66n.pages.dev
   - **Deployment Method**: Manual (wrangler CLI)
   - **Last Updated**: 1 day ago
   - **Status**: Available but not actively used by CI/CD

## How It Works

### Communication Flow
```
User Browser → Cloudflare Pages (Frontend) → Cloudflare Workers (API)
     ↓                    ↓                            ↓
pitchey-5o8.pages.dev    React App    pitchey-api-prod.ndlovucavelle.workers.dev
```

### Frontend-Backend Communication

The frontend (at `pitchey-5o8.pages.dev`) communicates with the backend API through:

1. **API Endpoint**: `https://pitchey-api-prod.ndlovucavelle.workers.dev`
2. **WebSocket Endpoint**: `wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws`

These URLs are baked into the frontend build via environment variables:
- `VITE_API_URL`: Points to the Worker API
- `VITE_WS_URL`: Points to the Worker WebSocket endpoint

### GitHub Actions Deployment

When you push to the `main` branch:

1. GitHub Actions triggers the `deploy-frontend.yml` workflow
2. The workflow:
   - Builds the frontend with production API URLs
   - Uses `wrangler pages deploy` to deploy to the `pitchey` project
   - Creates a unique deployment URL: `https://[deployment-id].pitchey-5o8.pages.dev`
   - Updates the production URL: `https://pitchey-5o8.pages.dev`

### Why Two Projects?

- **`pitchey`**: Created for the automated CI/CD pipeline (GitHub Actions)
- **`pitchey-5o8`**: Original project, possibly created manually

Cloudflare automatically adds suffixes (`-5o8`, `-66n`) to ensure globally unique URLs.

## Deployment Commands

### Via GitHub Actions (Recommended)
```bash
# Automatic deployment on push
git push origin main

# Manual trigger
gh workflow run deploy-frontend.yml
```

### Via Wrangler CLI (Manual)
```bash
# Deploy to primary project
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=pitchey

# Deploy to secondary project
npx wrangler pages deploy dist --project-name=pitchey-5o8
```

## URLs Summary

### Frontend URLs
- **Primary Production**: https://pitchey-5o8.pages.dev
- **Secondary Production**: https://pitchey-5o8-66n.pages.dev
- **Individual Deployments**: https://[deployment-id].pitchey-5o8.pages.dev

### Backend URLs
- **API**: https://pitchey-api-prod.ndlovucavelle.workers.dev
- **WebSocket**: wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws

### Database
- **Neon PostgreSQL**: `ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech`

## Configuration Files

### wrangler.json
```json
{
  "name": "pitchey",
  "compatibility_date": "2026-01-05",
  "pages_build_output_dir": "frontend/dist"
}
```

### GitHub Workflow
The `deploy-frontend.yml` workflow automatically deploys to the `pitchey` project, which resolves to `pitchey-5o8.pages.dev`.

## Custom Domain Setup (Optional)

To add a custom domain (e.g., `app.yourdomain.com`):

1. Go to Cloudflare Dashboard → Pages → pitchey → Custom domains
2. Add your domain
3. Update DNS records as instructed
4. Update frontend environment variables if needed

## Troubleshooting

### If deployment goes to wrong URL
The project name in the workflow determines the URL:
- `--project-name=pitchey` → `pitchey-5o8.pages.dev`
- `--project-name=pitchey-5o8` → `pitchey-5o8-66n.pages.dev`

### To consolidate to one project
If you want to use only one project:
1. Choose which project to keep
2. Update `wrangler.json` and workflow files with the correct project name
3. Delete the unused project from Cloudflare Dashboard

## Security Notes

- API authentication uses Better Auth with session cookies
- All API calls go through Cloudflare Workers (edge security)
- Database connections use SSL/TLS encryption
- Frontend-backend communication is always over HTTPS/WSS

## Next Steps

1. **Verify Current Setup**: The deployment is working correctly to `pitchey-5o8.pages.dev`
2. **Consider Consolidation**: Decide if you want to keep both projects or consolidate
3. **Custom Domain**: Add a custom domain if desired for production use