-- User Acquisition Metrics
-- Total users by type and signup date
WITH user_signups AS (
  SELECT 
    date_trunc('day', timestamp) AS signup_date,
    COUNT(DISTINCT user_id) AS total_signups,
    properties->>'user_type' AS user_type
  FROM analytics_events
  WHERE category = 'user_interaction' AND type = 'signup'
  GROUP BY signup_date, user_type
)
SELECT * FROM user_signups
ORDER BY signup_date DESC;

-- Pitch Performance Analytics
-- Top performing pitches by views and interactions
WITH pitch_performance AS (
  SELECT 
    properties->>'pitch_id' AS pitch_id,
    COUNT(CASE WHEN type = 'pitch_viewed' THEN 1 END) AS total_views,
    COUNT(CASE WHEN type = 'pitch_shared' THEN 1 END) AS total_shares,
    COUNT(DISTINCT user_id) AS unique_viewers
  FROM analytics_events
  WHERE category = 'pitch_lifecycle'
  GROUP BY pitch_id
)
SELECT 
  pitch_id, 
  total_views, 
  total_shares, 
  unique_viewers,
  (total_shares * 1.0 / NULLIF(total_views, 0)) AS share_rate
FROM pitch_performance
ORDER BY total_views DESC
LIMIT 10;

-- Investment Funnel Analysis
-- Conversion rates and investment metrics
WITH investment_funnel AS (
  SELECT 
    DATE_TRUNC('month', timestamp) AS month,
    COUNT(CASE WHEN type = 'investment_initiated' THEN 1 END) AS investment_requests,
    COUNT(CASE WHEN type = 'investment_completed' THEN 1 END) AS investments_completed,
    AVG(CASE 
      WHEN type = 'investment_completed' 
      THEN CAST(properties->>'investment_amount' AS NUMERIC) 
      ELSE NULL 
    END) AS avg_investment_amount
  FROM analytics_events
  WHERE category = 'investment'
  GROUP BY month
)
SELECT 
  month, 
  investment_requests, 
  investments_completed,
  ROUND(investments_completed * 100.0 / NULLIF(investment_requests, 0), 2) AS conversion_rate,
  avg_investment_amount
FROM investment_funnel
ORDER BY month DESC;

-- NDA Workflow Analysis
-- NDA request and signing patterns
WITH nda_workflow AS (
  SELECT 
    DATE_TRUNC('week', timestamp) AS week,
    properties->>'user_type' AS user_type,
    COUNT(CASE WHEN type = 'nda_requested' THEN 1 END) AS nda_requests,
    COUNT(CASE WHEN type = 'nda_signed' THEN 1 END) AS nda_signed,
    AVG(EXTRACT(EPOCH FROM (
      MAX(CASE WHEN type = 'nda_signed' THEN timestamp END) - 
      MIN(CASE WHEN type = 'nda_requested' THEN timestamp END)
    )) / 3600) AS avg_processing_hours
  FROM analytics_events
  WHERE category = 'nda_workflow'
  GROUP BY week, user_type
)
SELECT * FROM nda_workflow
ORDER BY week DESC;

-- User Retention Query
-- 30-day and 90-day retention rates
WITH user_cohorts AS (
  SELECT 
    DATE_TRUNC('month', MIN(timestamp)) AS cohort_month,
    user_id,
    COUNT(DISTINCT DATE_TRUNC('month', timestamp)) AS months_active
  FROM analytics_events
  GROUP BY cohort_month, user_id
)
SELECT 
  cohort_month,
  COUNT(DISTINCT user_id) AS total_users,
  ROUND(
    COUNT(DISTINCT CASE WHEN months_active >= 2 THEN user_id END) * 100.0 / COUNT(DISTINCT user_id), 
    2
  ) AS one_month_retention_rate,
  ROUND(
    COUNT(DISTINCT CASE WHEN months_active >= 4 THEN user_id END) * 100.0 / COUNT(DISTINCT user_id), 
    2
  ) AS three_month_retention_rate
FROM user_cohorts
GROUP BY cohort_month
ORDER BY cohort_month DESC;