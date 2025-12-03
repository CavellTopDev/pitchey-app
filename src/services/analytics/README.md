# Pitchey Analytics System

## Overview
The Pitchey Analytics System is a comprehensive business intelligence platform designed to track, analyze, and provide insights into platform performance, user behavior, and business metrics.

## Components

### 1. Event Tracking (`event-tracking.ts`)
- Centralized event tracking service
- Captures user interactions across the platform
- Supports multiple event categories and types
- Buffered event submission with configurable batch processing

#### Key Features
- Unique event ID generation
- Timestamp tracking
- User type and context preservation
- Extensible event properties

### 2. Business Metrics (`business-metrics.ts`)
- Calculates key performance indicators
- Provides insights into user acquisition, pitch performance, investments, and NDA workflows
- Includes predictive analytics for churn and pitch success

#### Metrics Tracked
- User Acquisition
- Pitch Performance
- Investment Funnel
- NDA Workflow
- Predictive Churn and Success Scoring

### 3. Data Warehouse (`data-warehouse.ts`)
- ETL pipeline for event data
- PostgreSQL-based data storage
- Advanced analytical query capabilities
- Data export functionality

#### Key Capabilities
- Event insertion
- Complex analytical queries
- User retention analysis
- Data export in multiple formats

### 4. Dashboard Configuration (`dashboard-config.ts`)
- Configurable dashboards for different user types
- Supports multiple visualization types
- Customizable widget configuration

#### Dashboard Types
- Executive Dashboard
- Creator Dashboard
- Investor Dashboard

## Setup and Configuration

### Environment Variables
- `DATA_WAREHOUSE_HOST`
- `DATA_WAREHOUSE_PORT`
- `DATA_WAREHOUSE_DB`
- `DATA_WAREHOUSE_USER`
- `DATA_WAREHOUSE_PASSWORD`

### Database Schema
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP,
  user_id VARCHAR(255),
  user_type VARCHAR(50),
  category VARCHAR(100),
  type VARCHAR(100),
  properties JSONB
);
```

## Usage Examples

### Track an Event
```typescript
const analyticsService = AnalyticsService.getInstance();
analyticsService.trackEvent({
  category: EventCategory.PITCH_LIFECYCLE,
  type: EventType.PITCH_CREATED,
  userId: 'user123',
  userType: 'creator',
  properties: { 
    pitchId: 'pitch456', 
    genre: 'sci-fi' 
  }
});
```

### Get Business Metrics
```typescript
const metricsService = BusinessMetricsService.getInstance();
const metrics = await metricsService.calculateBusinessMetrics();
```

### Run Analytical Query
```typescript
const dataWarehouse = DataWarehouseService.getInstance();
const retentionData = await dataWarehouse.getUserRetentionQuery(30);
```

## Future Enhancements
- Machine learning model integration
- Real-time anomaly detection
- Advanced predictive analytics
- Enhanced visualization capabilities

## Security Considerations
- Anonymize personal identifiable information
- Implement role-based access controls
- Use encryption for sensitive data