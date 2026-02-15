# Pitchey Platform API Documentation

## Overview
The Pitchey API provides endpoints for a three-portal entertainment industry marketplace connecting creators, investors, and production companies.

**Base URL:** `http://localhost:8001/api` (development)  
**Production URL:** `https://pitchey-api-prod.ndlovucavelle.workers.dev/api`

## Authentication

### Authentication Methods
- **JWT Bearer Token**: Required for protected endpoints
- **Portal-Specific Login**: Separate authentication flows for each user type

### Login Endpoints

#### Universal Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "userType": "creator",
    "username": "user_creator"
  }
}
```

#### Portal-Specific Login
```http
POST /api/auth/creator/login
POST /api/auth/investor/login  
POST /api/auth/production/login
```

### Authentication Headers
```http
Authorization: Bearer <jwt_token>
```

## Core Endpoints

### Configuration & Content

#### Get All Configuration Data
```http
GET /api/config/all
```
**Response:**
```json
{
  "genres": ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Thriller"],
  "formats": ["Feature", "Series", "Short", "Documentary"],
  "budgetRanges": ["Under $1M", "$1M-$5M", "$5M-$15M", "$15M-$50M", "Over $50M"],
  "stages": ["Development", "Pre-production", "Production", "Post-production"]
}
```

#### Platform Statistics
```http
GET /api/content/stats
```

### Pitch Management

#### Get Public Pitches
```http
GET /api/pitches/public?page=1&limit=20
```
**Response:**
```json
{
  "pitches": [
    {
      "id": 1,
      "title": "Shadow Protocol",
      "logline": "A cybersecurity expert must infiltrate...",
      "genre": "thriller",
      "format": "feature",
      "budget": "5000000",
      "creator": {
        "id": 1,
        "username": "alex_creator",
        "userType": "creator"
      }
    }
  ],
  "totalCount": 4,
  "hasMore": false
}
```

#### Create Pitch (Protected)
```http
POST /api/pitches
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "My New Pitch",
  "logline": "A compelling story about...",
  "genre": "drama",
  "format": "feature",
  "shortSynopsis": "Brief description",
  "longSynopsis": "Detailed description",
  "budget": "1000000"
}
```

#### Get User's Pitches
```http
GET /api/pitches
Authorization: Bearer <token>
```

#### Update Pitch
```http
PUT /api/pitches/:id
Authorization: Bearer <token>
```

### Dashboard Endpoints

#### Creator Dashboard
```http
GET /api/creator/dashboard
Authorization: Bearer <token>
```
**Response:**
```json
{
  "stats": {
    "totalPitches": 3,
    "totalViews": 0,
    "followers": 0,
    "averageRating": 0
  },
  "recentActivity": [],
  "milestones": [
    {
      "id": "first-pitch",
      "title": "First Pitch Created",
      "description": "Upload your first pitch",
      "completed": true
    }
  ]
}
```

#### Investor Dashboard
```http
GET /api/investor/dashboard
Authorization: Bearer <token>
```

#### Production Dashboard
```http
GET /api/production/dashboard
Authorization: Bearer <token>
```

### Social Features

#### Follow User/Pitch
```http
POST /api/follows/follow
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetType": "user",
  "targetId": 2
}
```

#### Get Followers
```http
GET /api/follows/followers
Authorization: Bearer <token>
```

#### Get Following List
```http
GET /api/follows/following
Authorization: Bearer <token>
```

### Messaging

#### Get Conversations
```http
GET /api/messages/conversations
Authorization: Bearer <token>
```

#### Send Message
```http
POST /api/messages/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipientId": 2,
  "content": "Hello, I'm interested in your pitch!"
}
```

### Search & Discovery

#### Advanced Search
```http
GET /api/search/advanced?query=thriller&genre=action&budget=1000000-5000000
```

#### Get Search Suggestions
```http
GET /api/search/suggestions?q=shadow
```

### Analytics

#### Track Event
```http
POST /api/analytics/event
Authorization: Bearer <token>
Content-Type: application/json

{
  "event": "pitch_view",
  "pitchId": 1,
  "metadata": {
    "duration": 30,
    "source": "dashboard"
  }
}
```

#### Get Pitch Analytics
```http
GET /api/analytics/pitch/:id
Authorization: Bearer <token>
```

### WebSocket Endpoints

#### WebSocket Health
```http
GET /api/ws/health
```

#### WebSocket Statistics
```http
GET /api/ws/stats
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

- **General API**: 100 requests per minute
- **Authentication**: 10 requests per minute
- **WebSocket**: 120 messages per minute

## Error Responses

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-01-07T12:00:00Z"
}
```

## Known Issues

### Critical Issues
1. **Social Features**: Follow endpoints fail due to missing `follows` table
2. **Pitch Creation**: Some operations fail with "DATABASE_URL not configured"
3. **Analytics**: View tracking not functional due to database issues
4. **NDA System**: Most NDA endpoints return 404 errors

### Workarounds
- Use demo accounts for testing: alex.creator@demo.com, sarah.investor@demo.com, stellar.production@demo.com
- Public pitch browsing works correctly
- Authentication and basic dashboard access functional

## Demo Accounts

| Portal | Email | Password | User ID |
|--------|--------|----------|---------|
| Creator | alex.creator@demo.com | Demo123 | 1 |
| Investor | sarah.investor@demo.com | Demo123 | 2 |
| Production | stellar.production@demo.com | Demo123 | 3 |