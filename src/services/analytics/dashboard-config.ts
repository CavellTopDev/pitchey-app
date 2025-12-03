export interface DashboardWidget {
  id: string;
  title: string;
  type: 'chart' | 'metric' | 'table';
  dataSource: string;
  chartType?: 'line' | 'bar' | 'pie' | 'donut';
  metrics: string[];
  filters?: Record<string, any>;
  refreshInterval?: number; // in milliseconds
}

export const EXECUTIVE_DASHBOARD_CONFIG: DashboardWidget[] = [
  {
    id: 'total-users',
    title: 'Total Users',
    type: 'metric',
    dataSource: 'user_acquisition',
    metrics: ['totalUsers'],
    refreshInterval: 300000 // 5 minutes
  },
  {
    id: 'monthly-active-users',
    title: 'Monthly Active Users',
    type: 'chart',
    dataSource: 'user_acquisition',
    chartType: 'line',
    metrics: ['monthlyActiveUsers'],
    refreshInterval: 600000 // 10 minutes
  },
  {
    id: 'pitch-performance',
    title: 'Pitch Performance',
    type: 'chart',
    dataSource: 'pitch_metrics',
    chartType: 'bar',
    metrics: ['pitchesViewedLastMonth', 'averagePitchViews'],
    refreshInterval: 300000 // 5 minutes
  },
  {
    id: 'investment-funnel',
    title: 'Investment Funnel',
    type: 'chart',
    dataSource: 'investment_metrics',
    chartType: 'donut',
    metrics: ['totalInvestmentRequests', 'investmentsCompleted'],
    refreshInterval: 600000 // 10 minutes
  },
  {
    id: 'nda-workflow',
    title: 'NDA Workflow',
    type: 'chart',
    dataSource: 'nda_metrics',
    chartType: 'pie',
    metrics: ['totalNDAsRequested', 'ndaSignedRate'],
    refreshInterval: 300000 // 5 minutes
  }
];

export const CREATOR_DASHBOARD_CONFIG: DashboardWidget[] = [
  {
    id: 'my-pitch-views',
    title: 'My Pitch Views',
    type: 'chart',
    dataSource: 'pitch_metrics',
    chartType: 'line',
    metrics: ['pitchViews'],
    filters: { userType: 'creator' },
    refreshInterval: 180000 // 3 minutes
  },
  {
    id: 'nda-interactions',
    title: 'NDA Interactions',
    type: 'chart',
    dataSource: 'nda_metrics',
    chartType: 'bar',
    metrics: ['ndaRequests', 'ndaSigned'],
    filters: { userType: 'creator' },
    refreshInterval: 300000 // 5 minutes
  }
];

export const INVESTOR_DASHBOARD_CONFIG: DashboardWidget[] = [
  {
    id: 'investment-opportunities',
    title: 'Investment Opportunities',
    type: 'table',
    dataSource: 'pitch_metrics',
    metrics: ['pitchId', 'pitchTitle', 'views', 'investmentPotential'],
    filters: { userType: 'investor' },
    refreshInterval: 180000 // 3 minutes
  },
  {
    id: 'my-investments',
    title: 'My Investments',
    type: 'chart',
    dataSource: 'investment_metrics',
    chartType: 'bar',
    metrics: ['totalInvestments', 'investmentValue'],
    filters: { userType: 'investor' },
    refreshInterval: 300000 // 5 minutes
  }
];

export class DashboardService {
  private static instance: DashboardService;

  private constructor() {}

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  // Get dashboard configuration based on user type
  public getDashboardConfig(userType: 'executive' | 'creator' | 'investor'): DashboardWidget[] {
    switch (userType) {
      case 'executive':
        return EXECUTIVE_DASHBOARD_CONFIG;
      case 'creator':
        return CREATOR_DASHBOARD_CONFIG;
      case 'investor':
        return INVESTOR_DASHBOARD_CONFIG;
      default:
        return [];
    }
  }

  // Generate custom dashboard
  public createCustomDashboard(widgets: DashboardWidget[]): DashboardWidget[] {
    return widgets;
  }
}