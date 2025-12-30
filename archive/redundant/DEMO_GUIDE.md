# Pitchey Platform Demo Guide

## Quick Start

The Pitchey platform demonstrates a complete movie pitch ecosystem with three types of users interacting in realistic workflows.

### Demo Accounts (Password: Demo123)
- **Creator**: alex.creator@demo.com
- **Investor**: sarah.investor@demo.com  
- **Production**: stellar.production@demo.com

### Live URLs
- **Frontend**: https://pitchey-5o8.pages.dev
- **API**: https://pitchey-api-prod.ndlovucavelle.workers.dev

## Demo Workflows

### 1. Browse Public Pitches
```bash
curl -s "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/public?limit=5" | jq
```

### 2. Creator Login & Dashboard
1. Login as creator:
```bash
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'
```

2. View notifications (shows NDA requests, reviews, etc):
```bash
curl -X GET https://pitchey-api-prod.ndlovucavelle.workers.dev/api/user/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Investor Workflow
1. Login as investor
2. Browse public pitches
3. Request NDA for protected content:
```bash
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/nda/request \
  -H "Authorization: Bearer INVESTOR_TOKEN" \
  -d '{"pitchId": 188}'
```

4. Express investment interest:
```bash
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/investment/express-interest \
  -H "Authorization: Bearer INVESTOR_TOKEN" \
  -d '{
    "pitchId": 189,
    "amount": 1000000,
    "interestLevel": "high",
    "notes": "Very interested in this project"
  }'
```

### 4. Production Company Workflow
1. Login as production company
2. Review pitches:
```bash
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/production/reviews \
  -H "Authorization: Bearer PRODUCTION_TOKEN" \
  -d '{
    "pitchId": 190,
    "status": "approved",
    "feedback": "Great potential for adaptation",
    "meetingRequested": true
  }'
```

## Current Demo Data

### Published Pitches
1. **The Quantum Heist** (ID: 188)
   - Sci-Fi heist across parallel universes
   - Budget: $15M
   - NDA Required: Yes

2. **Digital Dreams** (ID: 189)
   - Memory manipulation thriller
   - Budget: $8M  
   - NDA Required: No

3. **The Last Echo** (ID: 190)
   - Mystery thriller with sound frequencies
   - Budget: $5M
   - NDA Required: Yes

4. **Constellation Rising** (ID: 191)
   - Multi-generational alien contact story
   - Budget: $12M
   - NDA Required: No

## Key Features Demonstrated

### ✅ Working Features
- Multi-portal authentication (Creator/Investor/Production)
- Public pitch browsing
- NDA request workflow
- Investment interest tracking
- Production company reviews
- Cross-account notifications
- User dashboards for each portal

### ⚠️ Known Limitations
- WebSocket real-time updates not fully connected (refresh needed)
- Some endpoints return generic placeholder data
- Email notifications pending implementation
- Document uploads after NDA approval pending

## Testing the Complete Workflow

Run the automated test script:
```bash
./test-complete-demo-workflows.sh
```

This will:
1. Login all three demo accounts
2. Check pitch visibility
3. Test NDA requests
4. Test investment interests
5. Test production reviews
6. Verify notifications

## API Endpoints Reference

### Authentication
- POST `/api/auth/creator/login`
- POST `/api/auth/investor/login`
- POST `/api/auth/production/login`
- POST `/api/auth/logout`

### Pitches
- GET `/api/pitches/public` - Browse public pitches
- GET `/api/pitches/{id}` - Get pitch details
- POST `/api/creator/pitches` - Create pitch (creator only)
- PUT `/api/creator/pitches/{id}` - Update pitch

### NDA Management
- POST `/api/nda/request` - Request NDA
- POST `/api/nda/{id}/approve` - Approve NDA request
- POST `/api/nda/{id}/reject` - Reject NDA request
- GET `/api/nda/pending` - View pending requests
- GET `/api/nda/active` - View active NDAs

### Investment
- POST `/api/investment/express-interest` - Express interest
- GET `/api/pitches/{id}/investment-interests` - View interests
- GET `/api/investment/portfolio` - Investor portfolio

### Production
- POST `/api/production/reviews` - Submit review
- GET `/api/pitches/{id}/reviews` - Get pitch reviews
- GET `/api/production/projects` - Production projects

### Notifications
- GET `/api/user/notifications` - Get user notifications
- POST `/api/user/notifications/{id}/read` - Mark as read

## Troubleshooting

### Rate Limiting
If you encounter "Too many login attempts" errors, wait 60 seconds before retrying.

### Authentication Issues
Ensure you're including the Bearer token in the Authorization header:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### CORS Issues
The API is configured for CORS from https://pitchey-5o8.pages.dev. If testing locally, you may need to adjust CORS settings.

## Next Steps

1. **For Developers**: 
   - Connect WebSocket for real-time updates
   - Implement document upload after NDA
   - Add email notification system
   
2. **For Demo**:
   - Create more diverse pitch content
   - Add sample documents/lookbooks
   - Implement message system between users

## Support

For issues or questions about the demo, check:
- `/test-complete-demo-workflows.sh` - Automated testing
- `/CLIENT_FEEDBACK_REQUIREMENTS.md` - Feature requirements
- Worker logs in Cloudflare dashboard