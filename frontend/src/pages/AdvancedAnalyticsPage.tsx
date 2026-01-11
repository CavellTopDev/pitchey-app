import React from 'react';
import { UnifiedAnalyticsDashboard } from '../components/Analytics';

/**
 * Advanced Analytics Page
 * 
 * Provides access to the comprehensive analytics and reporting dashboard
 * with role-based views, real-time updates, predictive analytics,
 * and export capabilities.
 * 
 * Features:
 * - Unified dashboard for all user roles
 * - Interactive charts and visualizations
 * - Real-time metrics with WebSocket updates
 * - Predictive analytics and forecasting
 * - Export center with multiple formats
 * - Business insights and recommendations
 * - Anomaly detection
 * - Performance monitoring
 * - Geographic and demographic analytics
 * - Technology usage analytics
 * - Financial reporting
 */
export default function AdvancedAnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <UnifiedAnalyticsDashboard />
    </div>
  );
}