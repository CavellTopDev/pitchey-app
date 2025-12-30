
# Sentry Configuration Guide for Pitchey Production

## 🚨 Alert Rules Setup

Copy these configurations into your Sentry project settings:

### Error Rate Alerts

**High Error Rate** (high)
- Metric: error_rate
- Threshold: 5
- Time Window: 5m
- Actions: email, slack

**API Response Time Degradation** (medium)
- Metric: p95_response_time
- Threshold: 2000
- Time Window: 5m
- Actions: email

**Database Query Performance** (medium)
- Metric: database_query_duration
- Threshold: 1000
- Time Window: 1m
- Actions: email

**Critical System Error** (critical)
- Metric: fatal_errors
- Threshold: 1
- Time Window: 1m
- Actions: email, slack, pagerduty

**Authentication Failures** (medium)
- Metric: auth_failure_rate
- Threshold: 10
- Time Window: 5m
- Actions: email

**WebSocket Connection Failures** (medium)
- Metric: websocket_error_rate
- Threshold: 15
- Time Window: 5m
- Actions: email


## 📊 Performance Budgets

Set these targets in your monitoring dashboard:


**Page Load Time**
- Target: 2000ms
- Warning: 3000ms  
- Critical: 5000ms
- Frontend page load performance

**API Response Time (P95)**
- Target: 500ms
- Warning: 1000ms  
- Critical: 2000ms
- Backend API response time 95th percentile

**Database Query Duration**
- Target: 100ms
- Warning: 500ms  
- Critical: 1000ms
- Database query execution time

**Time to Interactive (TTI)**
- Target: 3000ms
- Warning: 5000ms  
- Critical: 8000ms
- Frontend interactivity performance


## 📈 Recommended Dashboard Widgets

Configure these widgets in your Sentry dashboard:


**Error Rate Trends** (error_rate_chart)
- Timeframe: 24h
- Breakdown: endpoint, user_type, environment



**API Response Times** (performance_chart)
- Timeframe: 4h

- Metrics: p50, p95, p99


**Active Users by Portal** (user_activity)
- Timeframe: 1h
- Breakdown: creator, investor, production



**Database Metrics** (database_performance)
- Timeframe: 4h

- Metrics: query_duration, connection_count, slow_queries


**Feature Adoption** (feature_usage)
- Timeframe: 7d


- Features: pitch_creation, nda_requests, investments, messaging


## 🔧 Team Configuration

1. **Add Team Members**: Invite developers to Sentry project
2. **Notification Channels**: Configure email, Slack, PagerDuty
3. **Alert Ownership**: Assign alert rules to specific team members
4. **Escalation Rules**: Set up escalation for critical alerts

## 📱 Integration Setup

### Slack Integration:
1. Install Sentry app in Slack workspace
2. Connect to #alerts or #engineering channel
3. Configure alert formatting preferences

### Email Notifications:
- Configure digest emails (daily/weekly summaries)
- Set individual alert email preferences
- Create escalation email lists

## 🎯 Custom Tags for Filtering

Add these custom tags to your Sentry events:

- `user_type`: creator, investor, production
- `portal`: dashboard, browse, pitch_detail
- `feature`: auth, pitch_mgmt, nda, messaging, investment
- `api_version`: v1, v2 (for API versioning)
- `deployment_env`: production, staging

## 🔍 Search Queries for Common Issues

Save these as bookmark searches in Sentry:

1. **Authentication Errors**: `event.type:error AND message:"auth*"`
2. **Database Issues**: `event.type:error AND message:"database*" OR message:"sql*"`
3. **API Timeouts**: `event.type:error AND message:"timeout*"`
4. **WebSocket Errors**: `event.type:error AND message:"websocket*"`
5. **Payment Issues**: `event.type:error AND message:"payment*" OR message:"stripe*"`

## 📋 Weekly Review Checklist

- [ ] Review error trends and patterns
- [ ] Check performance budget compliance
- [ ] Analyze user experience metrics  
- [ ] Review security-related alerts
- [ ] Update alert thresholds based on traffic patterns
