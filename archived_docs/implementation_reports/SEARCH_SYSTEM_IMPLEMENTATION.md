# Advanced Search and Filtering System Implementation

## Overview

This document describes the comprehensive search and filtering system implemented for Pitchey, providing powerful search capabilities with full-text search, advanced filtering, analytics, and performance optimizations.

## Architecture

### Core Components

1. **Search Service** (`/src/services/search.service.ts`)
   - Full-text search with PostgreSQL fuzzy matching
   - Weighted search scoring (title > logline > synopsis)
   - Advanced filtering and sorting
   - Result enrichment with user-specific data

2. **Search Cache Service** (`/src/services/search-cache.service.ts`)
   - In-memory caching with automatic eviction
   - Database persistence for popular searches
   - Cache warming and precomputation
   - Performance monitoring and statistics

3. **Search Analytics Service** (`/src/services/search-analytics.service.ts`)
   - Click-through rate tracking
   - Search performance metrics
   - Content gap analysis
   - User behavior insights

4. **Database Schema** (`/src/db/schema.ts`)
   - Search history tracking
   - Click tracking for analytics
   - Saved searches functionality
   - Search suggestions management

## Features Implemented

### 1. Full-Text Search

- **PostgreSQL Extensions**: Enabled `pg_trgm` for trigram matching and `btree_gin` for performance
- **Weighted Search**: Title matches weighted highest, followed by logline, then synopsis
- **Fuzzy Matching**: Handles typos using PostgreSQL similarity functions
- **Relevance Scoring**: Combines text matching with engagement metrics (views, likes, NDAs)

```typescript
// Search relevance calculation
const relevanceScore = sql`
  (
    CASE 
      WHEN LOWER(${pitches.title}) = LOWER(${searchTerm}) THEN 100
      WHEN LOWER(${pitches.title}) LIKE LOWER('%${searchTerm}%') THEN 80
      WHEN ${and(...titleMatch)} THEN 70
      WHEN LOWER(${pitches.logline}) LIKE LOWER('%${searchTerm}%') THEN 60
      WHEN ${and(...loglineMatch)} THEN 50
      WHEN ${and(...synopsisMatch)} THEN 30
      WHEN similarity(LOWER(${pitches.title}), LOWER(${searchTerm})) > 0.3 THEN 40
      WHEN similarity(LOWER(${pitches.logline}), LOWER(${searchTerm})) > 0.2 THEN 25
      ELSE 10
    END +
    CASE WHEN ${pitches.genre} = ANY(${words}) THEN 20 ELSE 0 END +
    CASE WHEN ${pitches.format} = ANY(${words}) THEN 15 ELSE 0 END +
    (${pitches.viewCount} * 0.01) +
    (${pitches.likeCount} * 0.05) +
    (${pitches.ndaCount} * 0.1)
  ) as relevance_score
`;
```

### 2. Advanced Filtering

#### Supported Filters:
- **Content Filters**: Genres, formats, status
- **Budget Filters**: Min/max budget range with predefined brackets
- **Date Filters**: Creation date, publication date ranges
- **Engagement Filters**: View count, like count, NDA count ranges
- **Creator Filters**: Creator type, verified status, location
- **Media Filters**: Available media types (lookbook, script, trailer, pitch deck)
- **User-Specific Filters**: Following status, NDA status

#### Filter Implementation:
```typescript
// Example: Genre and budget filtering
if (filters.genres && filters.genres.length > 0) {
  conditions.push(inArray(pitches.genre, filters.genres));
}

if (filters.budgetMin !== undefined) {
  conditions.push(gte(pitches.estimatedBudget, filters.budgetMin));
}
```

### 3. Search Performance Optimizations

#### Database Indexes
- Full-text search indexes using GIN
- Trigram indexes for fuzzy matching
- Composite indexes for filtered searches
- Partial indexes for specific scenarios
- Expression indexes for computed fields

```sql
-- Example indexes created
CREATE INDEX idx_pitches_title_fulltext ON pitches USING gin(to_tsvector('english', title));
CREATE INDEX idx_pitches_title_trigram ON pitches USING gin(title gin_trgm_ops);
CREATE INDEX idx_pitches_status_genre_format ON pitches (status, genre, format);
```

#### Caching Strategy
- **Memory Cache**: Fast in-memory cache for frequent searches
- **Database Cache**: Persistent cache for popular search results
- **Cache Invalidation**: Smart invalidation when pitches are updated
- **Cache Warming**: Precompute popular search combinations

```typescript
// Cache key generation
static generateCacheKey(filters: any): string {
  const sortedFilters = Object.keys(filters)
    .sort()
    .reduce((result: any, key) => {
      result[key] = filters[key];
      return result;
    }, {});

  return btoa(JSON.stringify(sortedFilters));
}
```

### 4. Search Analytics

#### Metrics Tracked:
- **Search Volume**: Total searches, unique users, unique queries
- **Click-Through Rates**: Search clicks vs impressions
- **Result Quality**: Average result count, zero-result searches
- **User Behavior**: Search abandonment, popular queries
- **Performance**: Search duration, cache hit rates

#### Analytics Features:
- **Content Gap Analysis**: Identify missing content based on zero-result searches
- **Query Performance**: Track individual query success rates
- **Search Trends**: Time-based analytics with configurable granularity
- **Abandonment Tracking**: Searches without clicks

```typescript
// Analytics data structure
interface SearchAnalyticsData {
  totalSearches: number;
  uniqueUsers: number;
  uniqueQueries: number;
  averageResultCount: number;
  zeroResultSearches: number;
  totalClicks: number;
  clickThroughRate: number;
  averagePosition: number;
  topQueries: Array<{
    query: string;
    count: number;
    ctr: number;
  }>;
  searchTrends: Array<{
    date: string;
    searches: number;
    clicks: number;
    ctr: number;
  }>;
}
```

### 5. Search Suggestions

#### Auto-Complete Features:
- **Real-time Suggestions**: Based on user input with debouncing
- **Multiple Sources**: Titles, genres, formats, creators
- **Popularity-Based**: Weighted by search frequency and success rate
- **User History**: Recent search history integration

#### Suggestion Types:
- `title`: Pitch titles matching the query
- `genre`: Genre suggestions
- `format`: Format suggestions  
- `creator`: Creator/company name suggestions
- `search`: Popular search terms

### 6. Saved Searches

#### Features:
- **Personal Searches**: Save complex filter combinations
- **Notifications**: Alert when new results match saved searches
- **Usage Tracking**: Monitor how often saved searches are used
- **Public Sharing**: Optional public sharing of search configurations

#### API Endpoints:
- `GET /api/search/saved` - Get user's saved searches
- `POST /api/search/saved` - Save new search
- `PUT /api/search/saved/[id]` - Update saved search
- `DELETE /api/search/saved/[id]` - Delete saved search
- `POST /api/search/saved/[id]` - Use saved search (increment stats)

### 7. Frontend Components

#### Search Components Created:
- **SearchBar**: Auto-complete search input with suggestions
- **AdvancedFilters**: Collapsible filter panels with all filtering options
- **SearchResults**: Formatted result display with click tracking
- **SavedSearches**: Management interface for saved searches
- **SearchPage**: Complete search interface with tabs and analytics

#### Key Features:
- **Responsive Design**: Works on desktop and mobile
- **Keyboard Navigation**: Arrow keys for suggestion navigation
- **Real-time Feedback**: Loading states and error handling
- **Click Tracking**: Automatic analytics tracking
- **Filter Management**: Easy filter application and removal

## API Endpoints

### Core Search APIs
- `POST /api/search/advanced` - Advanced search with all filters
- `GET /api/search/suggestions` - Get search suggestions
- `GET /api/search/popular` - Get popular searches
- `GET /api/search/history` - Get user search history
- `POST /api/search/track-click` - Track search result clicks

### Analytics APIs
- `GET /api/search/analytics` - Get search analytics data
- `POST /api/search/cache` - Cache management operations
- `GET /api/search/cache` - Get cache statistics

### Saved Search APIs
- `GET /api/search/saved` - List saved searches
- `POST /api/search/saved` - Create saved search
- `PUT /api/search/saved/[id]` - Update saved search
- `DELETE /api/search/saved/[id]` - Delete saved search

## Database Schema

### New Tables Added:

#### search_history
Tracks all search queries for analytics:
```sql
CREATE TABLE search_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  session_id VARCHAR(100),
  query TEXT NOT NULL,
  filters JSONB,
  result_count INTEGER DEFAULT 0,
  clicked_results JSONB DEFAULT '[]',
  search_duration INTEGER,
  source VARCHAR(50) DEFAULT 'web',
  ip_address VARCHAR(45),
  user_agent TEXT,
  searched_at TIMESTAMP DEFAULT NOW()
);
```

#### search_click_tracking
Tracks clicks on search results:
```sql
CREATE TABLE search_click_tracking (
  id SERIAL PRIMARY KEY,
  search_history_id INTEGER REFERENCES search_history(id),
  user_id INTEGER REFERENCES users(id),
  session_id VARCHAR(100),
  pitch_id INTEGER NOT NULL REFERENCES pitches(id),
  result_position INTEGER NOT NULL,
  query TEXT NOT NULL,
  source VARCHAR(50) DEFAULT 'web',
  clicked_at TIMESTAMP DEFAULT NOW()
);
```

#### saved_searches
User's saved search configurations:
```sql
CREATE TABLE saved_searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  filters JSONB NOT NULL,
  use_count INTEGER DEFAULT 0,
  last_used TIMESTAMP,
  is_public BOOLEAN DEFAULT false,
  notify_on_results BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### search_suggestions
Manages search auto-complete suggestions:
```sql
CREATE TABLE search_suggestions (
  id SERIAL PRIMARY KEY,
  query VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(50),
  search_count INTEGER DEFAULT 1,
  click_count INTEGER DEFAULT 0,
  result_count INTEGER DEFAULT 0,
  avg_click_through_rate DECIMAL(5,4) DEFAULT 0,
  last_searched TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  is_promoted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Performance Considerations

### Database Optimization
- **Materialized Views**: For complex search aggregations
- **Index Strategy**: Covering indexes for common query patterns
- **Query Optimization**: Efficient JOIN strategies and WHERE clause ordering
- **Connection Pooling**: Proper database connection management

### Caching Strategy
- **Multi-Level Caching**: Memory + Database persistence
- **Cache Invalidation**: Smart invalidation on data changes
- **Cache Warming**: Background processes for popular searches
- **Cache Monitoring**: Performance metrics and alerts

### Frontend Performance
- **Debounced Requests**: Prevent excessive API calls during typing
- **Virtual Scrolling**: For large result sets
- **Lazy Loading**: Load additional results on demand
- **Component Optimization**: Memoization for expensive renders

## Monitoring and Analytics

### Key Metrics
- **Search Performance**: Response times, cache hit rates
- **User Engagement**: Click-through rates, search abandonment
- **Content Quality**: Zero-result searches, popular queries
- **System Health**: Error rates, database performance

### Alerts and Monitoring
- High search response times
- Low cache hit rates
- Spike in zero-result searches
- Database connection issues

## Future Enhancements

### Planned Features
1. **AI-Powered Search**: Semantic search using embeddings
2. **Personalization**: User-specific search ranking
3. **Voice Search**: Speech-to-text search capabilities
4. **Visual Search**: Image-based pitch discovery
5. **Advanced Analytics**: Machine learning insights

### Scalability Improvements
1. **Search Clusters**: Distributed search infrastructure
2. **Real-time Indexing**: Immediate search availability for new content
3. **Geographic Search**: Location-based search optimization
4. **Multi-language Support**: International search capabilities

## Troubleshooting

### Common Issues
1. **Slow Search Performance**: Check indexes, query optimization
2. **Low Cache Hit Rate**: Review cache TTL settings, warming strategies
3. **Zero Results**: Analyze queries for content gaps
4. **High Memory Usage**: Monitor cache size, implement better eviction

### Debug Tools
- Cache statistics endpoint: `GET /api/search/cache`
- Search analytics: `GET /api/search/analytics`
- Database query analysis tools
- Application performance monitoring

## Security Considerations

### Data Protection
- **Search Query Privacy**: Encrypt sensitive search data
- **User Data Isolation**: Proper user-specific filtering
- **Rate Limiting**: Prevent search abuse
- **Input Sanitization**: Protect against injection attacks

### Access Control
- **Authentication**: Required for personalized features
- **Authorization**: User-specific data access
- **Audit Logging**: Track search activities
- **Privacy Settings**: User control over search history

---

This comprehensive search and filtering system provides Pitchey with enterprise-grade search capabilities, supporting both simple and complex search scenarios while maintaining high performance and providing valuable analytics insights.