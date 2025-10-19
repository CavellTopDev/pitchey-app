# Comprehensive Search Functionality Test Suite

## Overview

The `test-search-workflows.sh` script provides a comprehensive test suite for all search functionality in the Pitchey application. It covers 12 major categories of search features with over 100 individual test cases.

## Test Categories

### 1. Basic Pitch Search by Title and Keywords
- **Coverage**: Basic text search, exact matches, partial matches, keyword searches
- **Tests**: 
  - Public search endpoints (no authentication required)
  - Authenticated search with better relevance
  - Search by title, genre, format
  - Multi-keyword and phrase searches
  - Special character handling

### 2. Advanced Search with Multiple Filters
- **Coverage**: Complex filtering combinations
- **Tests**:
  - Genre filters (single and multiple)
  - Format filters (Feature, Short, TV Series)
  - Budget range filters (min/max budget)
  - Creator type filters (creator, investor, production)
  - Status filters (published, draft, etc.)
  - Date range filters
  - Media availability filters (has video, lookbook, script, etc.)
  - Verified creators filter
  - Location-based filtering
  - Complex combined filter scenarios

### 3. Search Autocomplete and Suggestions
- **Coverage**: Real-time search assistance
- **Tests**:
  - Title autocomplete
  - Genre autocomplete
  - Creator name autocomplete
  - Search suggestions based on popular queries
  - Related search recommendations
  - Trending searches
  - Popular searches analytics
  - Empty and single-character queries

### 4. User Search (Creators, Investors, Production Companies)
- **Coverage**: User discovery and networking
- **Tests**:
  - Basic user search by username/name
  - User type filtering
  - Verification status filtering
  - Company affiliation filtering
  - Location-based user search
  - Specialty/expertise filtering
  - Follower count filtering
  - User search sorting options
  - Complex user search combinations

### 5. Global Search Across All Content Types
- **Coverage**: Universal search functionality
- **Tests**:
  - Search across pitches, users, and messages
  - Type-specific filtering
  - Result limit controls
  - Multi-type search results
  - Public vs authenticated global search
  - Quoted phrase and multi-word searches

### 6. Search Result Pagination and Sorting
- **Coverage**: Result management and organization
- **Tests**:
  - Pagination (first page, subsequent pages, large page sizes)
  - Sorting options (relevance, date, views, likes, NDAs, budget, alphabetical)
  - Edge cases (zero page, negative page, very high page numbers)
  - Pagination with filters
  - Maximum page size limits

### 7. Search Relevance and Ranking
- **Coverage**: Search result quality and ordering
- **Tests**:
  - Exact match vs partial match relevance
  - Field-specific relevance (title vs synopsis vs logline)
  - Boost factors (views, likes, NDAs)
  - Fuzzy matching for typos
  - Multi-word relevance scoring
  - Phrase vs keyword searches
  - Relevance with filters applied

### 8. Saved Searches and Search History
- **Coverage**: User personalization and search management
- **Tests**:
  - Creating saved searches (basic, advanced, user searches)
  - Retrieving saved searches
  - Updating saved searches
  - Running saved searches
  - Deleting saved searches
  - Search history retrieval
  - Search history management
  - Notification preferences
  - Invalid operation handling

### 9. AI-Powered/Semantic Search
- **Coverage**: Advanced AI-driven search capabilities
- **Tests**:
  - Semantic search endpoints
  - Natural language query processing
  - AI intent understanding
  - AI recommendations (pitches, creators, investors)
  - Match scoring algorithms
  - Trend analysis
  - Pitch analysis with AI
  - Concept and emotion-based searches

### 10. Search Performance with Large Datasets
- **Coverage**: Performance optimization and scalability
- **Tests**:
  - Query performance with different query sizes
  - Result set size performance
  - Complex filter performance
  - Different search type performance
  - Cache performance testing
  - Aggregation performance
  - Concurrent search simulation
  - Heavy load scenarios

### 11. Empty State and Error Handling
- **Coverage**: Resilience and error management
- **Tests**:
  - No results scenarios
  - Invalid parameter handling
  - Malformed request handling
  - Authentication error scenarios
  - Rate limiting tests
  - SQL injection protection
  - Timeout scenario handling
  - Special character and large query handling

### 12. Search Analytics Tracking
- **Coverage**: Search behavior monitoring and insights
- **Tests**:
  - Search event tracking
  - Click tracking
  - Search analytics dashboards
  - Popular search analytics
  - Performance analytics
  - User behavior analytics
  - Export functionality
  - Cache statistics
  - Suggestion performance tracking

## Performance Testing

### Performance Metrics
- **Threshold**: 1000ms (configurable)
- **Tracking**: Response time for each endpoint
- **Reporting**: Performance failures and recommendations
- **Logs**: Detailed performance log with timestamps

### Performance Features
- Real-time performance monitoring
- Performance failure detection
- Performance trend analysis
- Bottleneck identification
- Cache effectiveness measurement

## Test Configuration

### Environment Variables
- `API_URL`: Base URL for the API (default: http://localhost:8001)
- `TEST_TIMEOUT`: Timeout for individual tests (default: 15 seconds)
- `PERFORMANCE_THRESHOLD_MS`: Performance threshold (default: 1000ms)

### Test Data
- Uses existing demo accounts for authentication
- Tests with real pitch data in the database
- Generates test data during execution
- Cleans up test artifacts

## Usage

### Basic Usage
```bash
./test-search-workflows.sh
```

### With Custom Configuration
```bash
API_URL=https://your-api.com TEST_TIMEOUT=30 ./test-search-workflows.sh
```

### Output Files
- `search_test_summary.json`: Comprehensive test results
- `search_performance.log`: Performance timing logs
- `search_performance_report.txt`: Performance analysis
- `messaging_test_results.json`: Detailed test results

## Test Results Interpretation

### Success Criteria
- **90%+ pass rate**: Excellent search functionality
- **70-89% pass rate**: Good with minor issues
- **<70% pass rate**: Significant issues requiring attention

### Performance Criteria
- **<1000ms**: Good performance
- **1000-2000ms**: Acceptable performance
- **>2000ms**: Performance optimization needed

## Error Handling

### Authentication Issues
- Fallback to public endpoints when authentication fails
- Graceful degradation for protected features
- Clear error reporting for auth problems

### Network Issues
- Timeout handling
- Retry logic for transient failures
- Connection error reporting

### Data Issues
- Empty result set handling
- Invalid parameter graceful handling
- Malformed data protection

## Security Testing

### Protection Tests
- SQL injection attempts
- XSS prevention
- Authentication bypass attempts
- Rate limiting enforcement
- Input validation testing

## Extensibility

### Adding New Tests
1. Create new test function following naming convention
2. Add to main execution flow
3. Update documentation
4. Include performance tracking if needed

### Custom Assertions
- Response validation helpers
- Data integrity checks
- Performance assertion helpers
- Security validation functions

## Dependencies

### Required Tools
- `curl`: For API requests
- `bash`: Shell environment
- `date`: For timing and logging
- `grep`, `cut`: For response parsing

### Server Requirements
- Pitchey application running
- Database with test data
- Authentication system operational
- Search endpoints configured

## Troubleshooting

### Common Issues
1. **Rate Limiting**: Wait between authentication attempts
2. **Authentication Failures**: Check demo account credentials
3. **Performance Issues**: Verify database indexing
4. **Empty Results**: Ensure test data exists

### Debug Mode
Set `set -x` in the script for verbose output during debugging.

## Future Enhancements

### Planned Features
- Load testing with concurrent users
- Search result quality scoring
- A/B testing framework integration
- Real-time search monitoring
- Search analytics dashboard integration

### Performance Optimizations
- Parallel test execution
- Result caching for repeated tests
- Database connection pooling tests
- Search index optimization verification

## Contributing

When adding new search features to the application:
1. Add corresponding tests to this suite
2. Update performance benchmarks
3. Include error case handling
4. Document new test categories
5. Update success criteria if needed

## Integration

This test suite integrates with:
- CI/CD pipelines for automated testing
- Performance monitoring systems
- Search analytics platforms
- Error tracking and alerting systems