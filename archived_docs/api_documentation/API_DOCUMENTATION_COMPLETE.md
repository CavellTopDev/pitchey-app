# Pitchey Platform API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [Auth Endpoints](#auth-endpoints)
   - [User Management](#user-management)
   - [Pitch Management](#pitch-management)
   - [NDA Management](#nda-management)
   - [Messaging System](#messaging-system)
   - [Payment System](#payment-system)
   - [Analytics](#analytics)
   - [Search & Discovery](#search--discovery)
   - [Email & Notifications](#email--notifications)
   - [Media Management](#media-management)
   - [AI Features](#ai-features)
4. [WebSocket API](#websocket-api)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Security](#security)
8. [Testing](#testing)

## Overview

The Pitchey Platform API is a RESTful API with WebSocket support for real-time features. All API endpoints are prefixed with `/api` and return JSON responses.

### Base URLs

- **Development**: `http://localhost:8000/api`
- **Staging**: `https://staging-api.pitchey.com/api`
- **Production**: `https://api.pitchey.com/api`

### Request/Response Format

All requests and responses use JSON format with UTF-8 encoding.

```json
{
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

### Timestamps

All timestamps are in ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`

## Authentication

The API uses JWT (JSON Web Token) authentication with refresh tokens.

### Authentication Flow

1. User logs in with credentials
2. Server returns access token (2 hours) and refresh token (7 days)
3. Include access token in Authorization header for protected endpoints
4. Refresh access token when expired using refresh endpoint

### Headers

```http
Authorization: Bearer <access_token>
X-CSRF-Token: <csrf_token>  # For state-changing operations
```

## API Endpoints

### Auth Endpoints

#### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "username": "johndoe",
  "userType": "creator|production|investor|viewer",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Optional for production/investor",
  "acceptedTerms": true,
  "acceptedPrivacy": true
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "userType": "creator"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "csrfToken": "csrf_token_here"
}
```

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "userType": "creator"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "csrfToken": "csrf_token_here"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Logout
```http
POST /api/auth/logout
```

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### Password Reset Request
```http
POST /api/auth/password-reset
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

#### Password Reset Confirm
```http
POST /api/auth/password-reset/confirm
```

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePassword123!"
}
```

### User Management

#### Get Current User
```http
GET /api/users/me
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "userType": "creator",
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Film creator and storyteller",
  "profileImage": "https://example.com/image.jpg",
  "subscriptionTier": "pro",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

#### Update User Profile
```http
PUT /api/users/me
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Updated bio",
  "location": "Los Angeles, CA",
  "phone": "+1234567890"
}
```

#### Upload Profile Image
```http
POST /api/users/me/avatar
```

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Field: `avatar` (image file)

**Response:**
```json
{
  "success": true,
  "profileImage": "https://example.com/uploads/avatar-123.jpg"
}
```

### Pitch Management

#### List Pitches
```http
GET /api/pitches?page=1&limit=20&genre=drama&format=feature&status=published
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `genre` (string): Filter by genre
- `format` (string): Filter by format (feature, tv, short, etc.)
- `status` (string): Filter by status (draft, published, hidden)
- `search` (string): Search in title and logline
- `userId` (number): Filter by creator
- `sortBy` (string): Sort field (createdAt, views, title)
- `sortOrder` (string): asc or desc

**Response:**
```json
{
  "pitches": [
    {
      "id": 1,
      "title": "The Last Journey",
      "logline": "A compelling story about...",
      "genre": "drama",
      "format": "feature",
      "status": "published",
      "userId": 1,
      "creator": {
        "id": 1,
        "username": "johndoe",
        "firstName": "John",
        "lastName": "Doe"
      },
      "thumbnailUrl": "https://example.com/thumbnail.jpg",
      "views": 150,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "totalItems": 100
  }
}
```

#### Get Pitch Details
```http
GET /api/pitches/:id
```

**Response:**
```json
{
  "id": 1,
  "title": "The Last Journey",
  "logline": "A compelling story about...",
  "genre": "drama",
  "format": "feature",
  "status": "published",
  "shortSynopsis": "Short synopsis...",
  "longSynopsis": "Detailed synopsis...",
  "targetAudience": "18-35 demographic",
  "budget": "$5-10M",
  "comparables": ["Movie A", "Movie B"],
  "keyTalent": ["Actor A", "Director B"],
  "media": [
    {
      "id": 1,
      "type": "image",
      "url": "https://example.com/media1.jpg",
      "caption": "Concept art"
    }
  ],
  "userId": 1,
  "creator": {
    "id": 1,
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "bio": "Creator bio"
  },
  "views": 150,
  "requiresNDA": true,
  "ndaType": "enhanced",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-15T00:00:00Z"
}
```

#### Create Pitch
```http
POST /api/pitches
```

**Request Body:**
```json
{
  "title": "New Pitch Title",
  "logline": "One-line description",
  "genre": "thriller",
  "format": "feature",
  "shortSynopsis": "Brief overview...",
  "longSynopsis": "Detailed story...",
  "targetAudience": "Target demographic",
  "budget": "$1-5M",
  "comparables": ["Similar Movie 1", "Similar Movie 2"],
  "keyTalent": ["Attached talent"],
  "requiresNDA": true,
  "ndaType": "basic"
}
```

#### Update Pitch
```http
PUT /api/pitches/:id
```

**Request Body:** Same as create pitch (partial updates supported)

#### Delete Pitch
```http
DELETE /api/pitches/:id
```

#### Upload Pitch Media
```http
POST /api/pitches/:id/media
```

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Fields:
  - `file` (file): Media file
  - `type` (string): image|video|document
  - `caption` (string): Optional caption

### NDA Management

#### Request NDA Access
```http
POST /api/ndas/request
```

**Request Body:**
```json
{
  "pitchId": 1,
  "ndaType": "basic|enhanced|custom",
  "message": "I'm interested in this project for production",
  "companyInfo": {
    "name": "Production Company LLC",
    "role": "Executive Producer"
  }
}
```

#### List NDA Requests (Incoming)
```http
GET /api/ndas/incoming-requests
```

**Response:**
```json
{
  "requests": [
    {
      "id": 1,
      "pitchId": 1,
      "pitchTitle": "The Last Journey",
      "requesterId": 2,
      "requesterName": "Jane Smith",
      "requesterCompany": "Big Productions",
      "ndaType": "enhanced",
      "message": "Interested in production",
      "status": "pending",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Approve NDA Request
```http
POST /api/ndas/:requestId/approve
```

**Request Body:**
```json
{
  "expirationDate": "2025-12-31T23:59:59Z",
  "notes": "Approved for initial review"
}
```

#### Reject NDA Request
```http
POST /api/ndas/:requestId/reject
```

**Request Body:**
```json
{
  "reason": "Project not suitable for your company"
}
```

#### Get Signed NDAs
```http
GET /api/ndas/signed?type=incoming|outgoing
```

**Response:**
```json
{
  "ndas": [
    {
      "id": 1,
      "pitchId": 1,
      "pitchTitle": "The Last Journey",
      "signedBy": "Jane Smith",
      "company": "Big Productions",
      "ndaType": "enhanced",
      "signedAt": "2025-01-01T00:00:00Z",
      "expiresAt": "2025-12-31T23:59:59Z"
    }
  ]
}
```

### Messaging System

#### WebSocket Connection
```http
GET /api/messages/ws?token=<auth_token>
```

See [WebSocket API](#websocket-api) section for details.

#### Send Message
```http
POST /api/messages/send
```

**Request Body:**
```json
{
  "conversationId": 1,
  "content": "Hello, I'd like to discuss your pitch",
  "attachments": [
    {
      "type": "document",
      "url": "https://example.com/doc.pdf",
      "name": "proposal.pdf"
    }
  ],
  "replyTo": null
}
```

#### Get Conversations
```http
GET /api/messages/conversations?archived=false
```

**Response:**
```json
{
  "conversations": [
    {
      "id": 1,
      "title": "Discussion about The Last Journey",
      "participants": [
        {
          "id": 1,
          "username": "johndoe",
          "profileImage": "https://example.com/avatar.jpg"
        }
      ],
      "lastMessage": {
        "id": 100,
        "content": "Looking forward to your response",
        "senderId": 2,
        "createdAt": "2025-01-01T00:00:00Z"
      },
      "unreadCount": 3,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Conversation Messages
```http
GET /api/messages/:conversationId/messages?page=1&limit=50
```

**Response:**
```json
{
  "messages": [
    {
      "id": 1,
      "conversationId": 1,
      "senderId": 1,
      "sender": {
        "id": 1,
        "username": "johndoe",
        "firstName": "John",
        "profileImage": "https://example.com/avatar.jpg"
      },
      "content": "Hello, interested in your pitch",
      "attachments": [],
      "readBy": [2],
      "createdAt": "2025-01-01T00:00:00Z",
      "editedAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalPages": 2,
    "totalMessages": 75
  }
}
```

#### Mark Messages as Read
```http
POST /api/messages/mark-read
```

**Request Body:**
```json
{
  "messageIds": [1, 2, 3],
  "conversationId": 1
}
```

#### Block/Unblock User
```http
POST /api/messages/block-user
```

**Request Body:**
```json
{
  "userId": 5,
  "action": "block|unblock"
}
```

### Payment System

#### Create Subscription
```http
POST /api/payments/subscribe
```

**Request Body:**
```json
{
  "tier": "creator|pro|investor",
  "paymentMethodId": "pm_1234567890",
  "billingCycle": "monthly|annual"
}
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_1234567890",
    "tier": "pro",
    "status": "active",
    "currentPeriodEnd": "2025-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  }
}
```

#### Cancel Subscription
```http
POST /api/payments/cancel-subscription
```

**Request Body:**
```json
{
  "cancelImmediately": false
}
```

#### Purchase Credits
```http
POST /api/payments/credits/purchase
```

**Request Body:**
```json
{
  "amount": 100,
  "paymentMethodId": "pm_1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "credits": {
    "purchased": 100,
    "bonus": 10,
    "total": 110,
    "newBalance": 310
  },
  "invoice": {
    "id": "inv_1234567890",
    "amount": 9900,
    "currency": "usd",
    "pdf": "https://example.com/invoice.pdf"
  }
}
```

#### Get Credit Balance
```http
GET /api/payments/credits/balance
```

**Response:**
```json
{
  "balance": 310,
  "pendingCharges": 0,
  "history": [
    {
      "id": 1,
      "type": "purchase",
      "amount": 100,
      "description": "Credit purchase",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Payment History
```http
GET /api/payments/history?page=1&limit=20
```

**Response:**
```json
{
  "transactions": [
    {
      "id": "ch_1234567890",
      "type": "subscription|credits|fee",
      "amount": 9900,
      "currency": "usd",
      "status": "succeeded",
      "description": "Pro subscription - January 2025",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "totalTransactions": 45
  }
}
```

### Analytics

#### Dashboard Analytics (Creator)
```http
GET /api/analytics/dashboard/creator
```

**Response:**
```json
{
  "overview": {
    "totalPitches": 12,
    "totalViews": 1500,
    "totalFollowers": 45,
    "totalRevenue": 25000
  },
  "recentActivity": [
    {
      "type": "view",
      "pitchId": 1,
      "pitchTitle": "The Last Journey",
      "viewerType": "production",
      "timestamp": "2025-01-01T00:00:00Z"
    }
  ],
  "topPitches": [
    {
      "id": 1,
      "title": "The Last Journey",
      "views": 500,
      "engagement": 85.5
    }
  ],
  "viewsOverTime": {
    "labels": ["Jan 1", "Jan 2", "Jan 3"],
    "data": [45, 52, 48]
  }
}
```

#### Dashboard Analytics (Production)
```http
GET /api/analytics/dashboard/production
```

**Response:**
```json
{
  "overview": {
    "activePitches": 5,
    "ndaSigned": 25,
    "dealsInProgress": 3,
    "totalInvestment": 5000000
  },
  "pipeline": [
    {
      "stage": "review",
      "count": 8,
      "value": 15000000
    },
    {
      "stage": "negotiation",
      "count": 3,
      "value": 8000000
    }
  ],
  "recentActivity": [],
  "topGenres": {
    "drama": 35,
    "thriller": 28,
    "comedy": 20,
    "other": 17
  }
}
```

#### Track Pitch View
```http
POST /api/analytics/track-view
```

**Request Body:**
```json
{
  "pitchId": 1,
  "duration": 45,
  "source": "marketplace|search|direct"
}
```

#### Track Engagement
```http
POST /api/analytics/track-engagement
```

**Request Body:**
```json
{
  "pitchId": 1,
  "action": "like|save|share|nda_request",
  "metadata": {
    "shareTarget": "twitter"
  }
}
```

### Search & Discovery

#### Search Pitches
```http
GET /api/search/advanced
```

**Query Parameters:**
- `q` (string): Search query
- `genre[]` (array): Genre filters
- `format[]` (array): Format filters
- `budgetMin` (number): Minimum budget
- `budgetMax` (number): Maximum budget
- `hasNDA` (boolean): Requires NDA
- `verified` (boolean): Verified creators only
- `sortBy` (string): relevance|date|popularity
- `page` (number): Page number
- `limit` (number): Results per page

**Response:**
```json
{
  "results": [
    {
      "id": 1,
      "title": "The Last Journey",
      "logline": "Compelling story...",
      "genre": "drama",
      "format": "feature",
      "score": 0.95,
      "highlights": {
        "title": ["The <mark>Last</mark> Journey"],
        "logline": ["<mark>Compelling</mark> story..."]
      }
    }
  ],
  "facets": {
    "genres": {
      "drama": 45,
      "thriller": 32
    },
    "formats": {
      "feature": 65,
      "tv": 25
    }
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalResults": 156
  }
}
```

#### Get Recommendations
```http
GET /api/recommendations/pitches
```

**Response:**
```json
{
  "recommendations": [
    {
      "id": 1,
      "title": "Recommended Pitch",
      "reason": "Based on your viewing history",
      "matchScore": 0.89,
      "pitch": {
        "id": 1,
        "title": "The Last Journey",
        "logline": "Story description..."
      }
    }
  ]
}
```

### Email & Notifications

#### Get Email Preferences
```http
GET /api/email/preferences
```

**Response:**
```json
{
  "preferences": {
    "ndaRequests": "instant",
    "messages": "daily",
    "pitchViews": "weekly",
    "marketing": "never",
    "weeklyDigest": true
  }
}
```

#### Update Email Preferences
```http
PUT /api/email/preferences
```

**Request Body:**
```json
{
  "ndaRequests": "instant|daily|weekly|never",
  "messages": "instant|daily|weekly|never",
  "pitchViews": "instant|daily|weekly|never",
  "marketing": "instant|daily|weekly|never",
  "weeklyDigest": true
}
```

#### Unsubscribe
```http
GET /api/email/unsubscribe?token=<unsubscribe_token>
```

### Media Management

#### Upload Media
```http
POST /api/media/upload
```

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Fields:
  - `file` (file): Media file
  - `type` (string): image|video|document
  - `context` (string): pitch|message|profile

**Response:**
```json
{
  "success": true,
  "media": {
    "id": "media_1234567890",
    "url": "https://example.com/uploads/file.jpg",
    "type": "image",
    "size": 1024000,
    "mimeType": "image/jpeg"
  }
}
```

#### Delete Media
```http
DELETE /api/media/:id
```

#### Stream Media
```http
GET /api/media/stream/:id
```

Supports partial content requests for video streaming.

### AI Features

#### Analyze Pitch
```http
POST /api/ai/analyze-pitch
```

**Request Body:**
```json
{
  "pitchId": 1
}
```

**Response:**
```json
{
  "analysis": {
    "marketability": 8.5,
    "originality": 7.2,
    "feasibility": 9.0,
    "strengths": [
      "Strong character development",
      "Unique premise"
    ],
    "improvements": [
      "Consider expanding target audience",
      "Add more comparables"
    ],
    "genreAlignment": 0.92,
    "estimatedAudience": "15-20M viewers"
  }
}
```

#### Get Match Score
```http
POST /api/ai/match-score
```

**Request Body:**
```json
{
  "pitchId": 1,
  "investorPreferences": {
    "genres": ["drama", "thriller"],
    "budgetRange": "$5-10M",
    "targetROI": 2.5
  }
}
```

**Response:**
```json
{
  "matchScore": 0.87,
  "breakdown": {
    "genreMatch": 1.0,
    "budgetMatch": 0.8,
    "roiPotential": 0.75
  },
  "recommendation": "Strong match - consider reviewing"
}
```

## WebSocket API

### Connection

Connect to WebSocket endpoint with authentication token:
```javascript
const ws = new WebSocket('ws://localhost:8000/api/messages/ws?token=<auth_token>');
```

### Message Format

All WebSocket messages use JSON format:
```json
{
  "type": "message_type",
  "data": {
    // Message-specific data
  }
}
```

### Client to Server Messages

#### Send Message
```json
{
  "type": "send_message",
  "data": {
    "conversationId": 1,
    "content": "Hello!",
    "attachments": []
  }
}
```

#### Typing Indicator
```json
{
  "type": "typing_start",
  "data": {
    "conversationId": 1
  }
}
```

#### Mark Read
```json
{
  "type": "mark_read",
  "data": {
    "messageIds": [1, 2, 3]
  }
}
```

#### Join Conversation
```json
{
  "type": "join_conversation",
  "data": {
    "conversationId": 1
  }
}
```

### Server to Client Messages

#### New Message
```json
{
  "type": "new_message",
  "data": {
    "id": 1,
    "conversationId": 1,
    "senderId": 2,
    "content": "Hello!",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

#### User Typing
```json
{
  "type": "user_typing",
  "data": {
    "conversationId": 1,
    "userId": 2,
    "username": "johndoe"
  }
}
```

#### User Online/Offline
```json
{
  "type": "user_online",
  "data": {
    "userId": 2,
    "username": "johndoe"
  }
}
```

#### Message Read
```json
{
  "type": "message_read",
  "data": {
    "messageId": 1,
    "userId": 2,
    "readAt": "2025-01-01T00:00:00Z"
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details
    }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `AUTH_INVALID` | 401 | Invalid credentials |
| `TOKEN_EXPIRED` | 401 | Access token expired |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

### Validation Errors

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "email": "Invalid email format",
        "password": "Password must be at least 12 characters"
      }
    }
  }
}
```

## Rate Limiting

Different endpoints have different rate limits:

| Endpoint Type | Limit | Window |
|--------------|-------|---------|
| Authentication | 5 requests | 15 minutes |
| Password Reset | 3 requests | 1 hour |
| API Endpoints | 100 requests | 1 minute |
| File Upload | 10 requests | 10 minutes |
| Search | 30 requests | 1 minute |

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## Security

### Security Headers

All API responses include security headers:
```http
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### CORS Configuration

CORS is configured for specific origins:
```http
Access-Control-Allow-Origin: https://app.pitchey.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token
Access-Control-Allow-Credentials: true
```

### Input Validation

All inputs are validated and sanitized:
- SQL injection protection via parameterized queries
- XSS protection through HTML escaping
- File upload validation (type, size, content)
- Email and URL format validation
- Password complexity requirements

## Testing

### Test Environment

Base URL: `https://test-api.pitchey.com/api`

### Test Credentials

```json
{
  "creator": {
    "email": "creator@test.pitchey.com",
    "password": "TestPassword123!"
  },
  "production": {
    "email": "production@test.pitchey.com",
    "password": "TestPassword123!"
  },
  "investor": {
    "email": "investor@test.pitchey.com",
    "password": "TestPassword123!"
  }
}
```

### API Testing Tools

#### cURL Example
```bash
# Login
curl -X POST https://test-api.pitchey.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"creator@test.pitchey.com","password":"TestPassword123!"}'

# Get pitches with auth
curl -X GET https://test-api.pitchey.com/api/pitches \
  -H "Authorization: Bearer <access_token>"
```

#### Postman Collection

Import the Pitchey API Postman collection from:
`https://api.pitchey.com/postman-collection.json`

### WebSocket Testing

```javascript
// Test WebSocket connection
const ws = new WebSocket('wss://test-api.pitchey.com/api/messages/ws?token=<auth_token>');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    type: 'ping'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## SDK and Libraries

### JavaScript/TypeScript SDK

```typescript
import { PitcheyClient } from '@pitchey/sdk';

const client = new PitcheyClient({
  apiKey: 'your_api_key',
  environment: 'production'
});

// Login
const { user, token } = await client.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Get pitches
const pitches = await client.pitches.list({
  genre: 'drama',
  limit: 20
});
```

### API Client Libraries

- **JavaScript/TypeScript**: `@pitchey/sdk`
- **Python**: `pitchey-python`
- **Ruby**: `pitchey-ruby`
- **Go**: `github.com/pitchey/pitchey-go`

## Changelog

### Version 2.0.0 (2025-01-21)
- Added complete messaging system with WebSocket support
- Implemented email notification system
- Enhanced security with rate limiting and validation
- Added AI analysis endpoints
- Improved NDA management workflow

### Version 1.0.0 (2024-12-01)
- Initial API release
- Basic authentication and user management
- Pitch CRUD operations
- Simple NDA requests

## Support

For API support and questions:
- Email: api-support@pitchey.com
- Documentation: https://docs.pitchey.com/api
- Status Page: https://status.pitchey.com
- Developer Forum: https://developers.pitchey.com/forum

---

*This documentation is current as of January 2025. For the latest updates, visit https://docs.pitchey.com/api*