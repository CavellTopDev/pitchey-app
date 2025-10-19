# Pitchey API Documentation

## Base URL
```
http://localhost:8000
```

## Authentication
The API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

## Response Format
All API responses are in JSON format with appropriate HTTP status codes.

### Success Response
```json
{
  "data": { ... },
  "message": "Success message"
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": { ... }
}
```

---

## Endpoints

### Authentication

#### Register User
**POST** `/auth/register`

Creates a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "minimum8chars",
  "userType": "creator|production|investor",
  "companyName": "Optional Company Name",
  "companyNumber": "Optional Registration Number"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "userType": "creator"
  },
  "session": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2025-09-26T17:00:00.000Z"
  }
}
```

#### Login
**POST** `/auth/login`

Authenticates user and returns session token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "user": { ... },
  "session": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2025-09-26T17:00:00.000Z"
  }
}
```

#### Logout
**POST** `/auth/logout`
**Authentication:** Required

Invalidates the current session.

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

---

### User Profile

#### Get Current User Profile
**GET** `/api/profile`
**Authentication:** Required

Returns the authenticated user's profile.

**Response:** `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "userType": "creator",
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Film creator and writer",
  "profileImage": "https://...",
  "companyName": "Doe Productions",
  "subscriptionTier": "pro"
}
```

#### Update Profile
**PUT** `/api/profile`
**Authentication:** Required

Updates the authenticated user's profile.

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

**Response:** `200 OK`
```json
{
  "message": "Profile updated successfully",
  "user": { ... }
}
```

---

### Pitches

#### List All Pitches
**GET** `/api/pitches`

Returns a paginated list of published pitches.

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20)
- `genre` (string): Filter by genre
- `format` (string): Filter by format
- `search` (string): Search in title and logline

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "title": "The Matrix",
    "logline": "A computer hacker learns about the true nature of reality",
    "genre": "scifi",
    "format": "feature",
    "creator": {
      "id": 1,
      "username": "wachowski",
      "userType": "creator"
    },
    "viewCount": 1523,
    "likeCount": 342,
    "ndaCount": 89,
    "createdAt": "2025-09-19T12:00:00.000Z"
  }
]
```

#### Get Single Pitch
**GET** `/api/pitches/:id`

Returns detailed information about a specific pitch.

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "The Matrix",
  "logline": "A computer hacker learns about the true nature of reality",
  "genre": "scifi",
  "format": "feature",
  "shortSynopsis": "...",
  "longSynopsis": "...",
  "characters": [...],
  "themes": ["reality", "freedom", "technology"],
  "budgetBracket": "$50M-$100M",
  "creator": { ... },
  "ndaRequired": true,
  "hasSignedNda": false
}
```

#### Create Pitch
**POST** `/api/pitches`
**Authentication:** Required (Creator only)

Creates a new pitch draft.

**Request Body:**
```json
{
  "title": "My Amazing Film",
  "logline": "One-line description of the story",
  "genre": "drama|comedy|thriller|horror|scifi|fantasy|documentary|animation|action|romance|other",
  "format": "feature|tv|short|webseries|other",
  "shortSynopsis": "Brief synopsis (optional)",
  "longSynopsis": "Detailed synopsis (optional)",
  "characters": [
    {
      "name": "John Doe",
      "description": "The protagonist",
      "age": "35",
      "gender": "male"
    }
  ],
  "themes": ["love", "redemption"],
  "budgetBracket": "$1M-$5M",
  "aiUsed": false
}
```

**Response:** `201 Created`
```json
{
  "id": 42,
  "title": "My Amazing Film",
  "status": "draft",
  "createdAt": "2025-09-19T17:00:00.000Z"
}
```

#### Update Pitch
**PUT** `/api/pitches/:id`
**Authentication:** Required (Owner only)

Updates an existing pitch.

**Request Body:**
Same as Create Pitch (all fields optional)

**Response:** `200 OK`
```json
{
  "message": "Pitch updated successfully",
  "pitch": { ... }
}
```

#### Delete Pitch
**DELETE** `/api/pitches/:id`
**Authentication:** Required (Owner only)

Deletes a pitch permanently.

**Response:** `200 OK`
```json
{
  "message": "Pitch deleted successfully"
}
```

#### Publish Pitch
**POST** `/api/pitches/:id/publish`
**Authentication:** Required (Owner only)

Changes pitch status from draft to published.

**Response:** `200 OK`
```json
{
  "message": "Pitch published successfully",
  "pitch": {
    "id": 42,
    "status": "published",
    "publishedAt": "2025-09-19T17:00:00.000Z"
  }
}
```

---

### NDA Management

#### Sign NDA
**POST** `/api/pitches/:id/nda`
**Authentication:** Required

Signs an NDA to access protected pitch content.

**Request Body:**
```json
{
  "ndaType": "basic|enhanced",
  "customNdaUrl": "https://... (optional for custom NDAs)"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "pitchId": 42,
  "signerId": 7,
  "ndaType": "basic",
  "signedAt": "2025-09-19T17:00:00.000Z",
  "accessGranted": true
}
```

#### Get NDA Status
**GET** `/api/pitches/:id/nda`
**Authentication:** Required

Checks if the current user has signed an NDA for a pitch.

**Response:** `200 OK`
```json
{
  "hasSignedNda": true,
  "nda": {
    "id": 1,
    "signedAt": "2025-09-19T17:00:00.000Z",
    "ndaType": "basic",
    "accessGranted": true
  }
}
```

---

### File Upload

#### Upload Pitch Materials
**POST** `/api/upload`
**Authentication:** Required
**Content-Type:** `multipart/form-data`

Uploads files for pitch materials (scripts, pitch decks, images).

**Form Data:**
- `file`: The file to upload
- `type`: File type (script|pitchdeck|image|video)
- `pitchId`: Associated pitch ID (optional)

**Response:** `201 Created`
```json
{
  "url": "https://storage.pitchey.com/uploads/...",
  "filename": "pitch_deck.pdf",
  "size": 2048576,
  "type": "application/pdf"
}
```

---

### Analytics

#### Record Pitch View
**POST** `/api/pitches/:id/view`
**Authentication:** Optional

Records a view for analytics tracking.

**Response:** `200 OK`
```json
{
  "message": "View recorded",
  "viewCount": 1524
}
```

#### Get Pitch Analytics
**GET** `/api/pitches/:id/analytics`
**Authentication:** Required (Owner only)

Returns detailed analytics for a pitch.

**Response:** `200 OK`
```json
{
  "totalViews": 1523,
  "uniqueViewers": 892,
  "ndaSignatures": 89,
  "likes": 342,
  "viewsByDay": [...],
  "viewerDemographics": {
    "creators": 234,
    "producers": 456,
    "investors": 202
  }
}
```

---

### Search & Discovery

#### Search Pitches
**GET** `/api/search`

Advanced search with multiple filters.

**Query Parameters:**
- `q` (string): Search query
- `genre[]` (array): Filter by genres
- `format[]` (array): Filter by formats
- `budgetMin` (number): Minimum budget
- `budgetMax` (number): Maximum budget
- `sortBy` (string): newest|popular|trending
- `page` (integer): Page number
- `limit` (integer): Results per page

**Response:** `200 OK`
```json
{
  "results": [...],
  "totalCount": 156,
  "page": 1,
  "totalPages": 8
}
```

#### Get Trending Pitches
**GET** `/api/trending`

Returns currently trending pitches.

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "title": "Trending Pitch",
    "trendingScore": 95.2,
    "viewsToday": 523,
    "viewsChange": "+45%"
  }
]
```

---

### Follow System

#### Follow a Pitch
**POST** `/api/pitches/:id/follow`
**Authentication:** Required

Follow a pitch to get updates.

**Response:** `200 OK`
```json
{
  "message": "Now following pitch",
  "followCount": 234
}
```

#### Unfollow a Pitch
**DELETE** `/api/pitches/:id/follow`
**Authentication:** Required

Unfollow a pitch.

**Response:** `200 OK`
```json
{
  "message": "Unfollowed pitch",
  "followCount": 233
}
```

#### Get Followed Pitches
**GET** `/api/user/following`
**Authentication:** Required

Returns all pitches the user is following.

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "title": "Followed Pitch",
    "followedAt": "2025-09-19T12:00:00.000Z",
    "lastUpdate": "2025-09-19T15:00:00.000Z"
  }
]
```

---

## Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required or invalid token
- `403 Forbidden` - Access denied to resource
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Rate Limiting

API requests are limited to:
- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1758909600
```

---

## Webhooks

### Available Webhook Events

- `pitch.published` - New pitch published
- `pitch.updated` - Pitch updated
- `nda.signed` - NDA signed for your pitch
- `pitch.viewed` - Your pitch was viewed
- `user.subscribed` - User subscription changed

### Webhook Payload Format
```json
{
  "event": "pitch.published",
  "timestamp": "2025-09-19T17:00:00.000Z",
  "data": { ... }
}
```

---

## Testing

### Test Endpoints
Available only in development mode:

**GET** `/api/health`
```json
{
  "status": "healthy",
  "message": "Pitchey API is running",
  "timestamp": "2025-09-19T17:00:00.000Z"
}
```

**POST** `/api/test/reset-db`
Resets database to initial seed data (development only).

---

## SDKs & Libraries

Official SDKs coming soon:
- JavaScript/TypeScript
- Python
- Ruby
- Go

## Support

For API support, contact: api@pitchey.com