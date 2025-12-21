# Investor Portal API Requirements

## Overview
This document outlines the API endpoints and database queries needed to support the new investor portal pages created on December 21, 2024.

## New Pages Created

### 1. Financial Overview (`/investor/financial-overview`)
**Purpose**: Display comprehensive financial dashboard with assets, funds, and returns

#### Required API Endpoints:
- `GET /api/investor/financial/summary`
  - Returns: Available funds, allocated funds, total returns, pending amounts, YTD growth
- `GET /api/investor/financial/recent-transactions?limit=5`
  - Returns: Recent 5 transactions for quick view

#### Database Queries:
```sql
-- Financial Summary
SELECT 
  SUM(CASE WHEN status = 'available' THEN amount ELSE 0 END) as available_funds,
  SUM(CASE WHEN status = 'allocated' THEN amount ELSE 0 END) as allocated_funds,
  SUM(CASE WHEN type = 'return' THEN amount ELSE 0 END) as total_returns,
  SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount
FROM investor_funds
WHERE user_id = ?;

-- Recent Transactions
SELECT * FROM transactions 
WHERE user_id = ? 
ORDER BY created_at DESC 
LIMIT 5;
```

### 2. Transaction History (`/investor/transaction-history`)
**Purpose**: Complete transaction history with search and filter capabilities

#### Required API Endpoints:
- `GET /api/investor/transactions`
  - Query params: `?page=1&limit=20&type=all&search=&startDate=&endDate=`
  - Returns: Paginated transaction list
- `GET /api/investor/transactions/export`
  - Returns: CSV/PDF export of transactions
- `GET /api/investor/transactions/stats`
  - Returns: Transaction statistics (total in/out, by category)

#### Database Queries:
```sql
-- Transaction List with Filters
SELECT 
  t.*,
  p.title as pitch_title
FROM transactions t
LEFT JOIN pitches p ON t.pitch_id = p.id
WHERE t.user_id = ?
  AND (? IS NULL OR t.type = ?)
  AND (? IS NULL OR t.description ILIKE ?)
  AND (? IS NULL OR t.created_at >= ?)
  AND (? IS NULL OR t.created_at <= ?)
ORDER BY t.created_at DESC
LIMIT ? OFFSET ?;
```

### 3. Budget Allocation (`/investor/budget-allocation`)
**Purpose**: Manage investment budgets across different categories

#### Required API Endpoints:
- `GET /api/investor/budget/allocations`
  - Returns: Budget allocations by category with spent/remaining
- `POST /api/investor/budget/allocations`
  - Body: `{ category, allocated_amount, period }`
  - Returns: Created/updated allocation
- `PUT /api/investor/budget/allocations/:id`
  - Body: `{ allocated_amount }`
  - Returns: Updated allocation

#### Database Queries:
```sql
-- Budget Allocations with Spending
SELECT 
  ba.*,
  COALESCE(SUM(i.amount), 0) as spent,
  ba.allocated_amount - COALESCE(SUM(i.amount), 0) as remaining
FROM budget_allocations ba
LEFT JOIN investments i ON i.category = ba.category 
  AND i.user_id = ba.user_id
  AND i.created_at >= ba.period_start
WHERE ba.user_id = ?
GROUP BY ba.id;
```

### 4. Tax Documents (`/investor/tax-documents`)
**Purpose**: Access and download tax-related documents

#### Required API Endpoints:
- `GET /api/investor/tax/documents`
  - Query params: `?year=2024&type=all`
  - Returns: List of available tax documents
- `GET /api/investor/tax/documents/:id/download`
  - Returns: Document file download
- `POST /api/investor/tax/generate`
  - Body: `{ year, type }`
  - Returns: Generated tax document

#### Database Queries:
```sql
-- Tax Documents List
SELECT * FROM tax_documents
WHERE user_id = ?
  AND (? IS NULL OR year = ?)
  AND (? IS NULL OR document_type = ?)
ORDER BY year DESC, created_at DESC;
```

### 5. Pending Deals (`/investor/pending-deals`)
**Purpose**: Track deals in negotiation or pending completion

#### Required API Endpoints:
- `GET /api/investor/deals/pending`
  - Returns: List of pending investment deals
- `PUT /api/investor/deals/:id/status`
  - Body: `{ status, notes }`
  - Returns: Updated deal status
- `GET /api/investor/deals/:id/timeline`
  - Returns: Deal progress timeline

#### Database Queries:
```sql
-- Pending Deals with Details
SELECT 
  d.*,
  p.title,
  p.genre,
  p.budget_range,
  u.name as creator_name
FROM investment_deals d
JOIN pitches p ON d.pitch_id = p.id
JOIN users u ON p.creator_id = u.id
WHERE d.investor_id = ?
  AND d.status IN ('negotiating', 'pending', 'due_diligence')
ORDER BY d.updated_at DESC;
```

### 6. Completed Projects (`/investor/completed-projects`)
**Purpose**: View completed investments with ROI and performance metrics

#### Required API Endpoints:
- `GET /api/investor/projects/completed`
  - Returns: List of completed projects with financial performance
- `GET /api/investor/projects/:id/performance`
  - Returns: Detailed performance metrics for a project
- `GET /api/investor/projects/:id/documents`
  - Returns: Final reports and documents

#### Database Queries:
```sql
-- Completed Projects with ROI
SELECT 
  cp.*,
  p.title,
  p.genre,
  i.amount as investment_amount,
  cp.final_return,
  ((cp.final_return - i.amount) / i.amount * 100) as roi,
  cp.revenue_breakdown
FROM completed_projects cp
JOIN investments i ON cp.investment_id = i.id
JOIN pitches p ON i.pitch_id = p.id
WHERE i.user_id = ?
ORDER BY cp.completion_date DESC;
```

### 7. ROI Analysis (`/investor/roi-analysis`)
**Purpose**: Comprehensive ROI tracking and analysis with charts

#### Required API Endpoints:
- `GET /api/investor/analytics/roi/summary`
  - Returns: Overall ROI metrics and trends
- `GET /api/investor/analytics/roi/by-category`
  - Returns: ROI breakdown by investment category
- `GET /api/investor/analytics/roi/timeline`
  - Query params: `?period=6m`
  - Returns: ROI over time for charting

#### Database Queries:
```sql
-- ROI Summary
SELECT 
  COUNT(*) as total_investments,
  AVG(roi) as average_roi,
  MAX(roi) as best_roi,
  MIN(roi) as worst_roi,
  SUM(CASE WHEN roi > 0 THEN 1 ELSE 0 END) as profitable_count
FROM investment_performance
WHERE user_id = ?;

-- ROI by Category
SELECT 
  category,
  AVG(roi) as avg_roi,
  COUNT(*) as count,
  SUM(final_return - initial_investment) as total_profit
FROM investment_performance
WHERE user_id = ?
GROUP BY category;
```

### 8. Market Trends (`/investor/market-trends`)
**Purpose**: Industry trends and market analysis

#### Required API Endpoints:
- `GET /api/investor/analytics/market/trends`
  - Returns: Current market trends and insights
- `GET /api/investor/analytics/market/genres`
  - Returns: Performance by genre
- `GET /api/investor/analytics/market/forecast`
  - Returns: Market predictions and opportunities

#### Database Queries:
```sql
-- Genre Performance Trends
SELECT 
  genre,
  AVG(roi) as avg_roi,
  COUNT(*) as project_count,
  AVG(budget) as avg_budget,
  DATE_TRUNC('month', created_at) as month
FROM market_data
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY genre, month
ORDER BY month DESC;
```

### 9. Risk Assessment (`/investor/risk-assessment`)
**Purpose**: Portfolio risk analysis and scoring

#### Required API Endpoints:
- `GET /api/investor/analytics/risk/portfolio`
  - Returns: Overall portfolio risk score and breakdown
- `GET /api/investor/analytics/risk/projects`
  - Returns: Risk assessment for individual projects
- `GET /api/investor/analytics/risk/recommendations`
  - Returns: Risk mitigation recommendations

#### Database Queries:
```sql
-- Portfolio Risk Assessment
SELECT 
  AVG(risk_score) as portfolio_risk,
  COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk_count,
  COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_risk_count,
  COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk_count,
  SUM(amount) as total_at_risk
FROM investment_risk_analysis
WHERE user_id = ?;
```

### 10. All Investments (`/investor/all-investments`)
**Purpose**: Complete view of all investments with filters

#### Required API Endpoints:
- `GET /api/investor/investments/all`
  - Query params: `?status=all&genre=all&sort=date`
  - Returns: Complete investment portfolio
- `GET /api/investor/investments/summary`
  - Returns: Investment statistics and totals

#### Database Queries:
```sql
-- All Investments with Status
SELECT 
  i.*,
  p.title,
  p.genre,
  p.status as project_status,
  COALESCE(ip.roi, 0) as current_roi
FROM investments i
JOIN pitches p ON i.pitch_id = p.id
LEFT JOIN investment_performance ip ON i.id = ip.investment_id
WHERE i.user_id = ?
ORDER BY i.created_at DESC;
```

## Database Schema Requirements

### New Tables Needed:
1. `budget_allocations` - Track budget allocations by category
2. `investment_deals` - Track pending and negotiating deals
3. `completed_projects` - Store completed project data
4. `investment_performance` - Track ROI and performance metrics
5. `tax_documents` - Store tax document metadata
6. `market_data` - Store market trend data
7. `investment_risk_analysis` - Store risk scores and assessments

### Existing Tables to Modify:
1. `investments` - Add `category`, `risk_level` columns
2. `transactions` - Add `category`, `tax_year` columns
3. `users` - Add `investor_profile` JSONB column for preferences

## Implementation Priority

### Phase 1 - Core Financial Features (High Priority)
1. Financial Overview API
2. Transaction History API
3. All Investments API

### Phase 2 - Analytics Features (Medium Priority)
4. ROI Analysis API
5. Pending Deals API
6. Completed Projects API

### Phase 3 - Advanced Features (Lower Priority)
7. Budget Allocation API
8. Tax Documents API
9. Market Trends API
10. Risk Assessment API

## Next Steps

1. Create database migrations for new tables
2. Implement Phase 1 API endpoints in the Worker
3. Connect frontend pages to new APIs
4. Add real-time updates via WebSocket for financial data
5. Implement caching strategy for analytics endpoints
6. Add data export functionality for all reports

## Notes

- All endpoints should support pagination where applicable
- Financial data should be cached with 5-minute TTL
- Analytics data can be cached with 1-hour TTL
- All monetary values should be stored in cents to avoid floating-point issues
- Implement rate limiting for export endpoints
- Add audit logging for all financial transactions