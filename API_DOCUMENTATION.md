# Pitchey Platform API Documentation

## Base Information
- **Base URL**: `http://localhost:8001`
- **Authentication**: JWT-based authentication
- **Authentication Endpoints**:
  - Creator Login: `/api/auth/creator/login`
  - Investor Login: `/api/auth/investor/login`
  - Production Login: `/api/auth/production/login`

## Authentication

### Login Endpoints

#### POST `/api/auth/creator/login`
**Description**: Authenticate a creator user
**Request Body**:
```json
{
  "email": "string",
  "password": "string"
}
```
**Responses**:
- `200 OK`: Authentication successful, returns user and token
- `401 Unauthorized`: Invalid credentials

#### POST `/api/auth/investor/login`
**Description**: Authenticate an investor user
**Request Body**:
```json
{
  "email": "string", 
  "password": "string"
}
```
**Responses**:
- `200 OK`: Authentication successful, returns user and token
- `401 Unauthorized`: Invalid credentials

#### POST `/api/auth/production/login`
**Description**: Authenticate a production company user
**Request Body**:
```json
{
  "email": "string",
  "password": "string"
}
```
**Responses**:
- `200 OK`: Authentication successful, returns user and token
- `401 Unauthorized`: Invalid credentials

## Pitches

### Pitch Creation and Management

#### POST `/api/creator/pitches`
**Description**: Create a new pitch
**Authentication**: Creator token required
**Request Body**:
```json
{
  "title": "string (required)",
  "logline": "string (required)",
  "genre": "drama|comedy|thriller|horror|scifi|fantasy|documentary|animation|action|romance|other",
  "format": "feature|tv|short|webseries|other",
  "shortSynopsis": "string (optional)",
  "longSynopsis": "string (optional)",
  "characters": [
    {
      "name": "string",
      "description": "string",
      "age": "string (optional)",
      "gender": "string (optional)",
      "actor": "string (optional)"
    }
  ],
  "themes": "string (optional)",
  "worldDescription": "string (optional)",
  "estimatedBudget": "number (optional)",
  "requireNDA": "boolean (optional)"
}
```
**Responses**:
- `201 Created`: Pitch successfully created
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Authentication required

#### GET `/api/creator/pitches`
**Description**: Retrieve all pitches for the authenticated creator
**Authentication**: Creator token required
**Responses**:
- `200 OK`: List of pitches
- `401 Unauthorized`: Authentication required

#### GET `/api/pitches/{pitchId}`
**Description**: Retrieve a specific pitch by ID
**Authentication**: Depends on pitch's NDA status
**Responses**:
- `200 OK`: Pitch details
- `403 Forbidden`: NDA required
- `404 Not Found`: Pitch does not exist

#### PATCH `/api/creator/pitches/{pitchId}`
**Description**: Update an existing pitch
**Authentication**: Creator token required, must own the pitch
**Request Body**: Same as pitch creation
**Responses**:
- `200 OK`: Pitch updated successfully
- `400 Bad Request`: Invalid input
- `403 Forbidden`: Not pitch owner
- `404 Not Found`: Pitch does not exist

## WebSocket Endpoints

### WebSocket Connection
**URL**: `ws://localhost:8001/ws`
**Authentication**: JWT token required as query parameter

### WebSocket Message Types
- `ping`: Client/server connection health check
- `notification`: Real-time platform notifications
- `dashboard_update`: Live dashboard metrics
- `draft_sync`: Auto-sync draft changes
- `presence_update`: User online/away/offline status
- `typing_start/stop`: Conversation typing indicators
- `send_message`: Send instant messages
- `message_read`: Message read receipts

## NDA Endpoints

#### POST `/api/ndas/request`
**Description**: Request an NDA for a pitch
**Authentication**: Required
**Request Body**:
```json
{
  "pitchId": "number",
  "ndaType": "basic|enhanced"
}
```
**Responses**:
- `200 OK`: NDA request created
- `400 Bad Request`: Invalid pitch or NDA type
- `403 Forbidden`: Unauthorized

#### GET `/api/ndas/signed`
**Description**: Retrieve signed NDAs
**Authentication**: Required
**Responses**:
- `200 OK`: List of signed NDAs

## Marketplace Endpoints

#### GET `/api/marketplace/pitches`
**Description**: Retrieve pitches for marketplace browsing
**Authentication**: Optional
**Query Parameters**:
- `genre`: Filter by pitch genre
- `format`: Filter by pitch format
- `limit`: Number of results
- `offset`: Pagination offset
**Responses**:
- `200 OK`: List of pitches

## Demo Accounts
- **Creator**: alex.creator@demo.com / Demo123
- **Investor**: sarah.investor@demo.com / Demo123
- **Production**: stellar.production@demo.com / Demo123

## Notes
- All endpoints return appropriate HTTP status codes
- Authentication is required for most endpoints
- Rate limiting is implemented for WebSocket connections
- Responses include user-friendly error messages

## WebSocket Subscription Events
- `pitch_view_update`: Real-time pitch view counter
- `dashboard_update`: Live metrics for user dashboards
- `upload_progress`: File upload tracking

## Error Handling
- Descriptive error messages
- Standard HTTP status codes
- Detailed logging on server-side