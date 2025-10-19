# Demo Accounts Status

## Summary
✅ **Demo accounts are working on both local and deployed backends**

## Account Credentials

### Creator Account
- **Email**: alex.creator@demo.com
- **Password**: Demo123
- **User ID**: 1001
- **Portal**: Creator Dashboard
- **Sample Pitches**: 3 (The Last Frontier, Urban Legends, Digital Hearts)

### Investor Account
- **Email**: sarah.investor@demo.com
- **Password**: Demo123  
- **User ID**: 1002
- **Portal**: Investor Dashboard

### Production Account
- **Email**: stellar.production@demo.com
- **Password**: Demo123
- **User ID**: 1003
- **Portal**: Production Dashboard

## Backend Status

### Local Backend (localhost:8000)
- ✅ Demo accounts created and working
- ✅ Real data implementation (no mock data)
- ✅ Views, likes, followers start at 0 (actual counts)
- ✅ Database: Local PostgreSQL via Podman

### Deployed Backend (Deno Deploy)
- ✅ Demo accounts working
- ⚠️ Still serving mock data (1250 views, etc.)
- 📝 Needs deployment of updated real data code
- 📝 Database: Neon PostgreSQL

## Frontend Status

Your frontend at `https://pitchey-frontend.deno.dev` is configured to connect to:
- **API**: `https://pitchey-backend-62414fc1npma.deno.dev`
- **WebSocket**: `wss://pitchey-backend-62414fc1npma.deno.dev`

The frontend is storing user data in localStorage after login:
```javascript
{
  id: "1001",
  email: "alex.creator@demo.com",
  username: "alexcreator",
  name: "Alex Filmmaker",
  role: "creator",
  userType: "creator",
  companyName: "Independent Films",
  createdAt: "2025-09-24T16:52:05.414Z"
}
```

## Current Issues

1. **Deployed backend has mock data**: The deployed version still returns hardcoded values (1250 views, 892 followers)
2. **Schema mismatches**: Some columns in the schema don't exist in the actual database tables

## To Deploy Real Data Implementation

1. Deploy the updated `working-server.ts` to Deno Deploy
2. Ensure the schema matches the production database
3. Run any necessary migrations

## Testing Commands

### Test Local Backend
```bash
# Login as Alex Creator
curl -X POST http://localhost:8000/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'
```

### Test Deployed Backend  
```bash
# Login as Alex Creator
curl -X POST https://pitchey-backend-62414fc1npma.deno.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'
```

### Run Test Script
```bash
./test-demo-accounts.sh
```

## Real Data Implementation

The following has been implemented to replace mock data:

1. **View Tracking**: Every pitch view is recorded in `analyticsEvents` table
2. **Like System**: Real like/unlike functionality with database tracking
3. **Follower System**: Real follow/unfollow with `follows` table
4. **Analytics**: All stats calculated from actual database values
5. **Milestones**: Replaced achievements with creator milestones

No more seeing "15k views" or "892 followers" when the app hasn't received those interactions!