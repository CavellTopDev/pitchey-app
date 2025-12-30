# Creator & Production Portal API Integration Guide

## Overview
This guide documents all new API endpoints for the Creator and Production portals, now live at:
- **Production Worker**: https://pitchey-api-prod.ndlovucavelle.workers.dev
- **Production Worker (Alt)**: https://pitchey-api-prod.ndlovucavelle.workers.dev

## Authentication
All endpoints require authentication via Better Auth session cookies or JWT token in Authorization header.

## Creator Portal Endpoints

### Dashboard & Analytics

#### GET /api/creator/dashboard
Main creator dashboard with revenue, engagement metrics, and recent activity.
```javascript
const response = await fetch('/api/creator/dashboard?userId=1');
const data = await response.json();
// Returns: revenue stats, engagement metrics, recent pitches, contracts
```

#### GET /api/creator/revenue
Detailed revenue breakdown by source.
```javascript
const response = await fetch('/api/creator/revenue?userId=1&period=30d');
const data = await response.json();
// Returns: revenue by source, trends, payment history
```

#### GET /api/creator/analytics
Comprehensive pitch performance analytics.
```javascript
const response = await fetch('/api/creator/analytics?userId=1&period=7d');
const data = await response.json();
// Returns: views, likes, shares, engagement rates
```

### Contract Management

#### GET /api/creator/contracts
List all contracts for a creator.
```javascript
const response = await fetch('/api/creator/contracts?userId=1');
const data = await response.json();
```

#### POST /api/creator/contracts
Create a new contract.
```javascript
const response = await fetch('/api/creator/contracts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    creator_id: 1,
    title: 'Production Agreement',
    type: 'production',
    counterparty_name: 'ABC Studios',
    value: 500000,
    start_date: '2024-01-01',
    end_date: '2024-12-31'
  })
});
```

#### GET /api/creator/contracts/:id
Get specific contract details.

#### PUT /api/creator/contracts/:id
Update contract.

#### DELETE /api/creator/contracts/:id
Delete contract.

### Milestones & Deliverables

#### GET /api/creator/milestones
Track contract milestones and payments.
```javascript
const response = await fetch('/api/creator/milestones?contractId=1');
const data = await response.json();
```

#### POST /api/creator/milestones/:id/complete
Mark milestone as complete.

### Pitch Management

#### GET /api/creator/pitches
List creator's pitches with performance metrics.
```javascript
const response = await fetch('/api/creator/pitches?userId=1&status=published');
const data = await response.json();
```

#### GET /api/creator/pitch-performance/:id
Detailed analytics for a specific pitch.

### Investor Relations

#### GET /api/creator/investors
List investors interested in creator's work.
```javascript
const response = await fetch('/api/creator/investors?userId=1');
const data = await response.json();
```

#### GET /api/creator/investment-pipeline
Track investment discussions and status.

## Production Portal Endpoints

### Dashboard & Pipeline

#### GET /api/production/dashboard
Main production dashboard with pipeline overview.
```javascript
const response = await fetch('/api/production/dashboard?companyId=1');
const data = await response.json();
// Returns: active projects, talent roster, budget overview
```

#### GET /api/production/pipeline
Production pipeline with all projects.
```javascript
const response = await fetch('/api/production/pipeline?companyId=1&status=production');
const data = await response.json();
```

### Project Management

#### GET /api/production/projects
List all production projects.
```javascript
const response = await fetch('/api/production/projects?companyId=1');
const data = await response.json();
```

#### POST /api/production/projects
Create new production project.
```javascript
const response = await fetch('/api/production/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_id: 1,
    title: 'New Feature Film',
    type: 'feature',
    status: 'pre_production',
    budget: 5000000,
    start_date: '2024-03-01'
  })
});
```

#### GET /api/production/projects/:id
Get project details with full breakdown.

#### PUT /api/production/projects/:id
Update project status and details.

### Talent Discovery & Management

#### GET /api/production/talent/search
Search for talent with filters.
```javascript
const response = await fetch('/api/production/talent/search?type=actor&available=true&location=LA');
const data = await response.json();
```

#### GET /api/production/talent/roster
Company's talent roster.
```javascript
const response = await fetch('/api/production/talent/roster?companyId=1');
const data = await response.json();
```

#### POST /api/production/talent/book
Book talent for a project.
```javascript
const response = await fetch('/api/production/talent/book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    talent_id: 1,
    project_id: 1,
    role: 'Lead Actor',
    start_date: '2024-04-01',
    end_date: '2024-06-30',
    day_rate: 5000
  })
});
```

### Crew Assembly

#### GET /api/production/crew/search
Search for crew members by department.
```javascript
const response = await fetch('/api/production/crew/search?department=camera&available=true');
const data = await response.json();
```

#### GET /api/production/crew/roster
Company's crew roster.

#### POST /api/production/crew/hire
Hire crew for a project.

### Location Scouting

#### GET /api/production/locations/search
Search for filming locations.
```javascript
const response = await fetch('/api/production/locations/search?type=warehouse&city=Atlanta');
const data = await response.json();
```

#### POST /api/production/locations/scout
Add new location to database.

#### POST /api/production/locations/book
Book location for filming.

### Budget & Schedule Management

#### GET /api/production/budgets/:projectId
Get project budget breakdown.
```javascript
const response = await fetch('/api/production/budgets/123');
const data = await response.json();
```

#### PUT /api/production/budgets/:projectId
Update budget allocations.

#### GET /api/production/schedules/:projectId
Get shooting schedule.

#### POST /api/production/schedules
Create shooting schedule.

### Analytics & Reporting

#### GET /api/production/analytics
Production company analytics.
```javascript
const response = await fetch('/api/production/analytics?companyId=1&period=quarter');
const data = await response.json();
```

#### GET /api/production/reports/budget-variance
Budget vs actual spending report.

#### GET /api/production/reports/talent-utilization
Talent and crew utilization metrics.

## Fixed Browse Endpoints

### GET /api/browse?type=trending
Returns pitches with >100 views in last 7 days.
```javascript
const response = await fetch('/api/browse?type=trending&limit=10');
const data = await response.json();
// Only trending pitches (>100 views in 7 days)
```

### GET /api/browse?type=new
Returns pitches from last 30 days, excluding trending.
```javascript
const response = await fetch('/api/browse?type=new&limit=10');
const data = await response.json();
// Only new pitches (last 30 days, not trending)
```

## Common Response Format

All endpoints return standardized responses:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "meta": {
    "timestamp": "2025-12-27T20:00:00.000Z",
    "requestId": "uuid-here",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "hasMore": true
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

## Frontend Integration Example

```javascript
// services/creator.service.js
export class CreatorService {
  async getDashboard(userId) {
    const response = await fetch(`/api/creator/dashboard?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch dashboard');
    return response.json();
  }
  
  async getRevenue(userId, period = '30d') {
    const response = await fetch(`/api/creator/revenue?userId=${userId}&period=${period}`);
    if (!response.ok) throw new Error('Failed to fetch revenue');
    return response.json();
  }
  
  async getContracts(userId) {
    const response = await fetch(`/api/creator/contracts?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch contracts');
    return response.json();
  }
}

// services/production.service.js
export class ProductionService {
  async searchTalent(filters) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/production/talent/search?${params}`);
    if (!response.ok) throw new Error('Failed to search talent');
    return response.json();
  }
  
  async getPipeline(companyId, status) {
    const response = await fetch(`/api/production/pipeline?companyId=${companyId}&status=${status}`);
    if (!response.ok) throw new Error('Failed to fetch pipeline');
    return response.json();
  }
}
```

## Testing Endpoints

Use the following curl commands to test:

```bash
# Test Browse Trending
curl -X GET "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/browse?type=trending"

# Test Browse New
curl -X GET "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/browse?type=new"

# Test Health Check
curl -X GET "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health"
```

## Migration Status

✅ **Completed**:
- Database schema migrated (20+ new tables)
- All endpoints implemented
- Deployed to Cloudflare Workers
- Browse tab separation fixed
- Authentication integrated

🚧 **Next Steps**:
- Frontend component updates
- WebSocket integration for real-time updates
- File upload to R2 storage
- Email notifications

## Support

For issues or questions:
- Check error responses for specific error codes
- Review browser console for network errors
- Ensure authentication cookies/tokens are present
- Contact development team with requestId from error responses