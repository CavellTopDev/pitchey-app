# Pitchey Serverless API Documentation

## Production URL
`https://pitchey-production.cavelltheleaddev.workers.dev`

## Current Status
- **Version**: `serverless-final-v2.0`
- **Deployment ID**: `6c3b0ee1-8c4b-47ab-8f15-4ee3ad27b936`
- **Last Updated**: December 14, 2024
- **Endpoints Implemented**: 30 of 83 planned
- **Test Results**: 21/31 passing (68% success rate)

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

### Login Endpoints

#### Creator Login
```http
POST /api/auth/creator/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Investor Login
```http
POST /api/auth/investor/login
Content-Type: application/json

{
  "email": "investor@example.com",
  "password": "password123"
}
```

#### Production Company Login
```http
POST /api/auth/production/login
Content-Type: application/json

{
  "email": "production@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "userType": "creator",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "eyJ0eXAiOiJKV1Q...",
  "message": "Login successful"
}
```

## Dashboard Endpoints

### Creator Dashboard
```http
GET /api/creator/dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalPitches": 10,
      "totalViews": 150,
      "totalSaves": 25,
      "pendingNDAs": 3
    },
    "recentPitches": [...],
    "recentNDAs": [...]
  }
}
```

### Investor Dashboard
```http
GET /api/investor/dashboard
Authorization: Bearer <token>
```

### Production Dashboard
```http
GET /api/production/dashboard
Authorization: Bearer <token>
```

## Pitch Management

### Create Pitch
```http
POST /api/pitches
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "My Amazing Film",
  "logline": "A compelling story about...",
  "genre": "Drama",
  "format": "Feature Film",
  "synopsis": "Full synopsis...",
  "status": "draft"
}
```

### List User's Pitches
```http
GET /api/pitches
Authorization: Bearer <token>
```

### Get Single Pitch
```http
GET /api/pitches/{id}
```

### Update Pitch
```http
PUT /api/pitches/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "published"
}
```

### Delete Pitch
```http
DELETE /api/pitches/{id}
Authorization: Bearer <token>
```

## Saved Pitches

### Save a Pitch
```http
POST /api/saved-pitches
Authorization: Bearer <token>
Content-Type: application/json

{
  "pitchId": 123
}
```

### Get Saved Pitches
```http
GET /api/saved-pitches
Authorization: Bearer <token>
```

### Unsave a Pitch
```http
DELETE /api/saved-pitches/{pitchId}
Authorization: Bearer <token>
```

## NDA System

### Request NDA
```http
POST /api/nda/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "pitchId": 123,
  "message": "I would like to review this pitch",
  "companyInfo": "ABC Productions"
}
```

### List NDA Requests (For Creators)
```http
GET /api/nda/requests?pitchId=123
Authorization: Bearer <token>
```

### Approve NDA
```http
PUT /api/nda/approve/{requestId}
Authorization: Bearer <token>
```

### Reject NDA
```http
PUT /api/nda/reject/{requestId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Not a good fit for the project"
}
```

### Get Signed NDAs (For Investors)
```http
GET /api/nda/signed
Authorization: Bearer <token>
```

### Check NDA Status
```http
GET /api/nda/check?pitchId=123
Authorization: Bearer <token>
```

### NDA Statistics
```http
GET /api/nda/stats
Authorization: Bearer <token>
```

## Browse & Search

### Browse Pitches (Enhanced)
```http
GET /api/pitches/browse/enhanced?genre=Action&format=Feature Film&sort=trending&limit=20&offset=0
```

**Query Parameters:**
- `genre`: Filter by genre (optional)
- `format`: Filter by format (optional)
- `sort`: Sort order - "recent" or "trending" (default: "recent")
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset (default: 0)

### Trending Pitches
```http
GET /api/pitches/trending
```

### New Releases
```http
GET /api/pitches/new
```

### Featured Pitches
```http
GET /api/pitches/featured
```

### Search
```http
GET /api/search?q=keyword&genre=Drama&format=TV Series
```

**Query Parameters:**
- `q`: Search query
- `genre`: Filter by genre (optional)
- `format`: Filter by format (optional)

## Configuration

### Get Available Genres
```http
GET /api/config/genres
```

**Response:**
```json
{
  "success": true,
  "data": [
    "Action", "Adventure", "Animation", "Biography", "Comedy",
    "Crime", "Documentary", "Drama", "Family", "Fantasy",
    "Film Noir", "History", "Horror", "Music", "Musical",
    "Mystery", "Romance", "Sci-Fi", "Sport", "Superhero",
    "Thriller", "War", "Western"
  ]
}
```

### Get Available Formats
```http
GET /api/config/formats
```

## Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-14T23:45:00.000Z",
  "version": "serverless-final-v2.0",
  "database": true,
  "driver": "@neondatabase/serverless",
  "services": {
    "database": true,
    "cache": true,
    "redis": true,
    "websocket": true,
    "r2": true
  },
  "indexes": 274,
  "endpoints": {
    "implemented": 30,
    "total": 83
  }
}
```

## Demo Accounts

For testing purposes, these demo accounts are available:

| Type | Email | Password |
|------|-------|----------|
| Creator | alex.creator@demo.com | Demo123 |
| Investor | sarah.investor@demo.com | Demo123 |
| Production | stellar.production@demo.com | Demo123 |

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Technical error details (in development only)"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## Known Issues (As of Dec 14, 2024)

1. **Dashboard Endpoints**: Some dashboard endpoints experiencing count query issues
2. **Saved Pitches**: Join queries need optimization
3. **Browse Enhanced**: Count aggregation queries failing
4. **NDA Approve/Reject**: Update queries need fixing

## Next Steps

1. Fix remaining SQL query issues with count() and joins
2. Implement remaining 53 endpoints
3. Add WebSocket real-time features
4. Integrate R2 file storage for uploads
5. Add comprehensive error handling

## Frontend Integration Notes

1. **CORS**: All endpoints support CORS with credentials
2. **Authentication**: JWT tokens don't expire for 7 days
3. **Rate Limiting**: Currently no rate limiting implemented
4. **Caching**: Redis caching available but not fully integrated
5. **Real-time**: WebSocket endpoints planned but not yet implemented

## Contact

For issues or questions about the API:
- Check deployment status: `wrangler tail --config wrangler-serverless.toml`
- View logs: Check Cloudflare dashboard
- Database issues: Check Neon dashboard for connection status