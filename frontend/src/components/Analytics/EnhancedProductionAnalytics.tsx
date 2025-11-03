import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Layers, 
  PieChart, 
  Users, 
  Shield, 
  Building2,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Zap,
  BarChart3
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { PerformanceChart } from './PerformanceChart';
import { AnalyticsExport } from './AnalyticsExport';
import { analyticsService, TimeRange } from '../../services/analytics.service';
import { 
  LineChart, 
  BarChart, 
  PieChart as PieChartComponent, 
  ChartContainer,
  MultiLineChart,
  AreaChart,
  StackedBarChart
} from './AnalyticsCharts';

interface ProductionAnalyticsProps {
  productionPerformance?: {
    totalPitches: number;
    totalRevenue: number;
    activeProjects: number;
    ndaSignedCount: number;
    averageProjectBudget: number;
    creatorInteractions: number;
  };
}

interface ProductionAnalyticsData {
  kpis: {
    activeProjects: number;
    totalBudget: number;
    avgProjectCost: number;
    completionRate: number;
    partnerships: number;
    monthlyRevenue: number;
    crewUtilization: number;
    onTimeDelivery: number;
    costVariance: number;
    clientSatisfaction: number;
  };
  changes: {
    projectsChange: number;
    budgetChange: number;
    costChange: number;
    completionChange: number;
    partnershipsChange: number;
    revenueChange: number;
    utilizationChange: number;
    deliveryChange: number;
    varianceChange: number;
    satisfactionChange: number;
  };
  charts: {
    projectPipeline: { stage: string; count: number; budget: number }[];
    budgetUtilization: { date: string; value: number }[];
    partnershipGrowth: { date: string; value: number }[];
    revenueProjections: { date: string; value: number }[];
    genreDistribution: { genre: string; projects: number; budget: number }[];
    monthlyMetrics: { month: string; projects: number; revenue: number; costs: number }[];
    projectTimelines: { project: string; planned: number; actual: number; status: string }[];
    resourceAllocation: { resource: string; allocated: number; utilized: number }[];
  };
}

export const EnhancedProductionAnalytics: React.FC<ProductionAnalyticsProps> = ({ 
  productionPerformance 
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [analyticsData, setAnalyticsData] = useState<ProductionAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
    
    // Set up auto-refresh every 5 minutes if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchAnalyticsData, 5 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Map time range to preset
      const preset: TimeRange['preset'] = timeRange === '7d' ? 'week' : 
                                         timeRange === '30d' ? 'month' :
                                         timeRange === '90d' ? 'quarter' : 'year';
      
      const [dashboardMetrics] = await Promise.all([
        analyticsService.getDashboardMetrics({ preset })
      ]);

      // Transform the data (using mock data for production-specific metrics)
      const transformedData: ProductionAnalyticsData = getMockData();
      setAnalyticsData(transformedData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setAnalyticsData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const getMockData = (): ProductionAnalyticsData => ({
    kpis: {
      activeProjects: 8,
      totalBudget: 15000000,
      avgProjectCost: 1875000,
      completionRate: 87,
      partnerships: 24,
      monthlyRevenue: 850000,
      crewUtilization: 82,
      onTimeDelivery: 75,
      costVariance: -5.2,
      clientSatisfaction: 4.6,
    },
    changes: {
      projectsChange: 33,
      budgetChange: 22,
      costChange: -5,
      completionChange: 8,
      partnershipsChange: 20,
      revenueChange: 15,
      utilizationChange: 3,
      deliveryChange: -2,
      varianceChange: 1.5,
      satisfactionChange: 0.2,
    },
    charts: {
      projectPipeline: [
        { stage: 'Development', count: 12, budget: 2400000 },
        { stage: 'Pre-Production', count: 8, budget: 3200000 },
        { stage: 'Production', count: 5, budget: 6500000 },
        { stage: 'Post-Production', count: 3, budget: 2100000 },
        { stage: 'Distribution', count: 2, budget: 800000 },
      ],
      budgetUtilization: Array.from({ length: 12 }, (_, i) => ({
        date: new Date(2024, i, 1).toISOString().split('T')[0],
        value: 70 + Math.floor(Math.random() * 25) + i * 0.5,
      })),
      partnershipGrowth: Array.from({ length: 12 }, (_, i) => ({
        date: new Date(2024, i, 1).toISOString().split('T')[0],
        value: 15 + i * 2 + Math.floor(Math.random() * 3),
      })),
      revenueProjections: Array.from({ length: 12 }, (_, i) => ({
        date: new Date(2024, i, 1).toISOString().split('T')[0],
        value: 600000 + i * 25000 + Math.floor(Math.random() * 100000),
      })),
      genreDistribution: [
        { genre: 'Action', projects: 8, budget: 4200000 },
        { genre: 'Drama', projects: 6, budget: 2800000 },
        { genre: 'Comedy', projects: 5, budget: 2100000 },
        { genre: 'Thriller', projects: 4, budget: 3100000 },
        { genre: 'Sci-Fi', projects: 3, budget: 2800000 },
        { genre: 'Documentary', projects: 4, budget: 1200000 },
      ],
      monthlyMetrics: Array.from({ length: 12 }, (_, i) => ({
        month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
        projects: Math.floor(Math.random() * 3) + 2,
        revenue: Math.floor(Math.random() * 200000) + 650000,
        costs: Math.floor(Math.random() * 150000) + 450000,
      })),
      projectTimelines: [
        { project: 'The Last Symphony', planned: 120, actual: 115, status: 'Completed' },
        { project: 'Digital Rebellion', planned: 90, actual: 105, status: 'In Progress' },
        { project: 'Ocean\'s Secret', planned: 75, actual: 78, status: 'Completed' },
        { project: 'Time Traveler\'s Dilemma', planned: 100, actual: 0, status: 'Pre-Production' },
        { project: 'The Forgotten City', planned: 85, actual: 92, status: 'Post-Production' },
        { project: 'Midnight Protocol', planned: 110, actual: 88, status: 'In Progress' },
      ],
      resourceAllocation: [
        { resource: 'Directors', allocated: 12, utilized: 10 },
        { resource: 'Producers', utilized: 8, allocated: 10 },
        { resource: 'Cinematographers', allocated: 15, utilized: 12 },
        { resource: 'Editors', allocated: 8, utilized: 7 },
        { resource: 'Sound Engineers', allocated: 6, utilized: 5 },
        { resource: 'VFX Artists', allocated: 20, utilized: 18 },
      ]
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center text-gray-500 py-8">
        Failed to load analytics data. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Production Analytics Dashboard</h2>
            <p className="text-gray-600">Monitor project pipeline, costs, and operational efficiency</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              <span>Auto Refresh</span>
            </button>
            
            <TimeRangeFilter 
              onChange={(range) => setTimeRange(range)}
              defaultRange="30d"
            />
            
            <AnalyticsExport 
              data={analyticsData}
              title="Production Analytics"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Active Projects"
          value={analyticsData.kpis.activeProjects}
          change={analyticsData.changes.projectsChange}
          icon={<Building2 className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Total Budget"
          value={analyticsData.kpis.totalBudget}
          change={analyticsData.changes.budgetChange}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
          variant="success"
          format="currency"
        />
        <AnalyticCard 
          title="Completion Rate"
          value={analyticsData.kpis.completionRate}
          change={analyticsData.changes.completionChange}
          icon={<CheckCircle className="w-5 h-5 text-purple-500" />}
          variant="primary"
          format="percentage"
        />
        <AnalyticCard 
          title="Monthly Revenue"
          value={analyticsData.kpis.monthlyRevenue}
          change={analyticsData.changes.revenueChange}
          icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
          variant="warning"
          format="currency"
        />
        <AnalyticCard 
          title="Partnerships"
          value={analyticsData.kpis.partnerships}
          change={analyticsData.changes.partnershipsChange}
          icon={<Users className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
        />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Avg Project Cost"
          value={analyticsData.kpis.avgProjectCost}
          change={analyticsData.changes.costChange}
          icon={<PieChart className="w-5 h-5 text-cyan-500" />}
          variant="success"
          format="currency"
        />
        <AnalyticCard 
          title="Crew Utilization"
          value={analyticsData.kpis.crewUtilization}
          change={analyticsData.changes.utilizationChange}
          icon={<Zap className="w-5 h-5 text-yellow-500" />}
          variant="warning"
          format="percentage"
        />
        <AnalyticCard 
          title="On-Time Delivery"
          value={analyticsData.kpis.onTimeDelivery}
          change={analyticsData.changes.deliveryChange}
          icon={<Clock className="w-5 h-5 text-teal-500" />}
          variant="success"
          format="percentage"
        />
        <AnalyticCard 
          title="Cost Variance"
          value={analyticsData.kpis.costVariance.toFixed(1)}
          change={analyticsData.changes.varianceChange}
          icon={<BarChart3 className="w-5 h-5 text-red-500" />}
          variant="danger"
          format="percentage"
        />
        <AnalyticCard 
          title="Client Satisfaction"
          value={analyticsData.kpis.clientSatisfaction.toFixed(1)}
          change={analyticsData.changes.satisfactionChange}
          icon={<Shield className="w-5 h-5 text-green-500" />}
          variant="success"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Pipeline */}
        <ChartContainer title="Project Pipeline by Stage">
          <BarChart
            data={analyticsData.charts.projectPipeline.map(item => ({
              category: item.stage,
              value: item.count
            }))}
            title="Number of Projects"
            height={300}
          />
        </ChartContainer>

        {/* Budget Utilization */}
        <ChartContainer title="Budget Utilization Trends">
          <AreaChart
            data={analyticsData.charts.budgetUtilization}
            title="Utilization (%)"
            color="#F59E0B"
            height={300}
          />
        </ChartContainer>

        {/* Genre Distribution */}
        <ChartContainer title="Projects by Genre">
          <PieChartComponent
            data={analyticsData.charts.genreDistribution.map(item => ({
              category: item.genre,
              value: item.projects
            }))}
            title="Project Distribution"
            type="doughnut"
            height={300}
          />
        </ChartContainer>

        {/* Revenue Projections */}
        <ChartContainer title="Revenue Projections">
          <LineChart
            data={analyticsData.charts.revenueProjections}
            title="Projected Revenue ($)"
            color="#10B981"
            height={300}
          />
        </ChartContainer>

        {/* Partnership Growth */}
        <ChartContainer title="Partnership Growth">
          <AreaChart
            data={analyticsData.charts.partnershipGrowth}
            title="Active Partnerships"
            color="#8B5CF6"
            height={300}
          />
        </ChartContainer>

        {/* Resource Utilization */}
        <ChartContainer title="Resource Utilization">
          <MultiLineChart
            datasets={[
              {
                label: 'Allocated',
                data: analyticsData.charts.resourceAllocation.map(item => ({
                  date: item.resource,
                  value: item.allocated
                })),
                color: '#3B82F6'
              },
              {
                label: 'Utilized',
                data: analyticsData.charts.resourceAllocation.map(item => ({
                  date: item.resource,
                  value: item.utilized
                })),
                color: '#EF4444'
              }
            ]}
            height={300}
          />
        </ChartContainer>
      </div>

      {/* Monthly Performance Overview */}
      <ChartContainer title="Monthly Financial Performance">
        <StackedBarChart
          data={analyticsData.charts.monthlyMetrics.map(item => ({
            category: item.month,
            values: [
              { label: 'Revenue', value: item.revenue / 1000 },
              { label: 'Costs', value: item.costs / 1000 }
            ]
          }))}
          height={350}
        />
      </ChartContainer>

      {/* Project Timelines */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Project Timeline Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-3 text-gray-600">Project</th>
                <th className="pb-3 text-gray-600">Planned (Days)</th>
                <th className="pb-3 text-gray-600">Actual (Days)</th>
                <th className="pb-3 text-gray-600">Variance</th>
                <th className="pb-3 text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="space-y-2">
              {analyticsData.charts.projectTimelines.map((project, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-3 font-medium text-gray-900">{project.project}</td>
                  <td className="py-3 text-gray-600">{project.planned}</td>
                  <td className="py-3 text-gray-600">{project.actual || 'TBD'}</td>
                  <td className={`py-3 font-medium ${
                    project.actual === 0 ? 'text-gray-400' :
                    project.actual <= project.planned ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {project.actual === 0 ? '-' : 
                     project.actual <= project.planned ? 
                     `${project.planned - project.actual} days early` : 
                     `${project.actual - project.planned} days late`}
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      project.status === 'Post-Production' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operational Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Health</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pipeline Status</span>
              <span className="font-semibold text-green-600">Healthy</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Budget Control</span>
              <span className="font-semibold text-green-600">On Track</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Resource Efficiency</span>
              <span className="font-semibold text-yellow-600">Good</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Quality Control</span>
              <span className="font-semibold text-green-600">Excellent</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Factors</h3>
          <div className="space-y-3">
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">3 projects at risk of delays</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <p className="text-sm text-red-800">Budget overrun on 1 project</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">Resource shortage in VFX</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Opportunities</h3>
          <div className="space-y-3">
            <div className="border-l-4 border-green-500 pl-3">
              <p className="text-sm text-gray-700">Increase crew utilization by 15%</p>
            </div>
            <div className="border-l-4 border-blue-500 pl-3">
              <p className="text-sm text-gray-700">Streamline post-production workflow</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-3">
              <p className="text-sm text-gray-700">Expand documentary portfolio</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedProductionAnalytics;