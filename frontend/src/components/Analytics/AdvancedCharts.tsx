import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ComposedChart, ReferenceLine, Brush, FunnelChart, Funnel, LabelList
} from 'recharts';
import {
  TrendingUp, TrendingDown, BarChart3, PieChart as PieIcon, Activity,
  Zap, Target, Clock, ArrowUpRight, ArrowDownRight, Filter, Settings,
  Maximize2, Download, RefreshCw, Calendar, Eye, Users, DollarSign,
  Star, Globe, Monitor, Smartphone, Play, Heart, MessageSquare,
  AlertTriangle, CheckCircle, Layers, Grid, Sparkles, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

// Color schemes for different chart types
const COLOR_SCHEMES = {
  primary: ['#3b82f6', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'],
  success: ['#10b981', '#059669', '#047857', '#065f46', '#064e3b'],
  warning: ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'],
  danger: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'],
  info: ['#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'],
  purple: ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'],
  gradient: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe']
};

// Chart type definitions
type ChartType = 'line' | 'area' | 'bar' | 'pie' | 'scatter' | 'radar' | 'funnel' | 'composed';

interface ChartConfig {
  type: ChartType;
  title: string;
  description?: string;
  dataKey: string;
  xAxisKey?: string;
  yAxisKey?: string;
  colorScheme: keyof typeof COLOR_SCHEMES;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  showBrush?: boolean;
  animate?: boolean;
  size: 'sm' | 'md' | 'lg' | 'xl';
  filters?: string[];
  groupBy?: string;
}

interface AdvancedChartsProps {
  data: any;
  config: any;
  timeRange: string;
  customDateRange: { start: string; end: string };
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center space-x-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">
              {formatter ? formatter(entry.value, entry.name) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Format numbers for display
const formatNumber = (num: number, type: string = 'default'): string => {
  if (type === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }
  
  if (type === 'percentage') {
    return `${(num * 100).toFixed(1)}%`;
  }
  
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Chart size configurations
const CHART_SIZES = {
  sm: { width: '100%', height: 200 },
  md: { width: '100%', height: 300 },
  lg: { width: '100%', height: 400 },
  xl: { width: '100%', height: 500 }
};

export default function AdvancedCharts({ data, config, timeRange, customDateRange }: AdvancedChartsProps) {
  const [activeCharts, setActiveCharts] = useState<string[]>([]);
  const [selectedChart, setSelectedChart] = useState<ChartConfig | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [chartConfigs, setChartConfigs] = useState<ChartConfig[]>([]);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  
  // Initialize chart configurations based on role and data
  useEffect(() => {
    const configs: ChartConfig[] = [
      // Overview Charts
      {
        type: 'line',
        title: 'Views Over Time',
        description: 'Daily view trends and patterns',
        dataKey: 'trends.daily',
        xAxisKey: 'date',
        yAxisKey: 'views',
        colorScheme: 'primary',
        size: 'lg',
        showGrid: true,
        showLegend: true,
        showBrush: true,
        animate: true
      },
      {
        type: 'area',
        title: 'Engagement Trends',
        description: 'User engagement over time',
        dataKey: 'trends.daily',
        xAxisKey: 'date',
        yAxisKey: 'engagement',
        colorScheme: 'success',
        size: 'lg',
        showGrid: true,
        animate: true
      },
      {
        type: 'bar',
        title: 'Revenue by Period',
        description: 'Revenue breakdown by time period',
        dataKey: 'trends.daily',
        xAxisKey: 'date',
        yAxisKey: 'revenue',
        colorScheme: 'warning',
        size: 'lg',
        showGrid: true
      },
      {
        type: 'pie',
        title: 'Device Distribution',
        description: 'User devices breakdown',
        dataKey: 'technology.devices',
        colorScheme: 'info',
        size: 'md',
        showLegend: true
      },
      {
        type: 'bar',
        title: 'Geographic Performance',
        description: 'Performance by country',
        dataKey: 'geography.countries',
        xAxisKey: 'country',
        yAxisKey: 'users',
        colorScheme: 'purple',
        size: 'lg',
        showGrid: true
      },
      {
        type: 'line',
        title: 'Performance Metrics',
        description: 'System performance over time',
        dataKey: 'performance.pageLoadTimes',
        xAxisKey: 'page',
        yAxisKey: 'avgLoadTime',
        colorScheme: 'danger',
        size: 'md',
        showGrid: true
      },
      {
        type: 'funnel',
        title: 'Conversion Funnel',
        description: 'User journey conversion rates',
        dataKey: 'funnel',
        colorScheme: 'gradient',
        size: 'lg'
      },
      {
        type: 'radar',
        title: 'Platform Health',
        description: 'Multi-dimensional platform metrics',
        dataKey: 'health',
        colorScheme: 'info',
        size: 'md'
      }
    ];
    
    setChartConfigs(configs);
    setActiveCharts(configs.slice(0, 4).map((_, i) => i.toString()));
  }, []);
  
  // Process data for charts
  const processedData = useMemo(() => {
    if (!data) return {};
    
    return {
      trends: data.trends?.daily || [],
      devices: data.technology?.devices?.map((d: any) => ({
        name: d.type,
        value: d.percentage,
        users: Math.round(data.overview?.totalViews * (d.percentage / 100))
      })) || [],
      countries: data.geography?.countries || [],
      performance: data.performance?.pageLoadTimes || [],
      funnel: [
        { name: 'Visitors', value: data.overview?.uniqueVisitors || 0, percentage: 100 },
        { name: 'Engaged', value: Math.round((data.overview?.uniqueVisitors || 0) * 0.65), percentage: 65 },
        { name: 'Interested', value: Math.round((data.overview?.uniqueVisitors || 0) * 0.25), percentage: 25 },
        { name: 'Converted', value: Math.round((data.overview?.uniqueVisitors || 0) * 0.08), percentage: 8 }
      ],
      health: [
        { metric: 'Performance', value: 85, fullMark: 100 },
        { metric: 'Reliability', value: 95, fullMark: 100 },
        { metric: 'Security', value: 90, fullMark: 100 },
        { metric: 'User Experience', value: 88, fullMark: 100 },
        { metric: 'Scalability', value: 82, fullMark: 100 }
      ]
    };
  }, [data]);
  
  // Render individual chart
  const renderChart = (chartConfig: ChartConfig, index: number) => {
    const chartData = getChartData(chartConfig, processedData);
    const colors = COLOR_SCHEMES[chartConfig.colorScheme];
    const size = CHART_SIZES[chartConfig.size];
    
    if (!chartData || chartData.length === 0) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No data available</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
        {/* Chart Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{chartConfig.title}</h3>
              {chartConfig.description && (
                <p className="text-sm text-gray-600">{chartConfig.description}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedChart(chartConfig)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="View details"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => downloadChart(chartConfig, index)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleFullscreen(chartConfig)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Chart Content */}
        <div className="p-4">
          <ResponsiveContainer width={size.width} height={size.height}>
            {renderChartByType(chartConfig, chartData, colors)}
          </ResponsiveContainer>
        </div>
        
        {/* Chart Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Last updated: {format(new Date(), 'MMM d, HH:mm')}</span>
            <div className="flex items-center space-x-4">
              <span>Data points: {Array.isArray(chartData) ? chartData.length : 0}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                isRealtimeChart(chartConfig) 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {isRealtimeChart(chartConfig) ? 'Live' : 'Historical'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Get chart data based on configuration
  const getChartData = (chartConfig: ChartConfig, processedData: any) => {
    const keys = chartConfig.dataKey.split('.');
    let data = processedData;
    
    for (const key of keys) {
      data = data?.[key];
    }
    
    return data || [];
  };
  
  // Render chart by type
  const renderChartByType = (chartConfig: ChartConfig, chartData: any[], colors: string[]) => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };
    
    switch (chartConfig.type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {chartConfig.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis 
              dataKey={chartConfig.xAxisKey}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                if (chartConfig.xAxisKey === 'date') {
                  return format(parseISO(value), 'MMM d');
                }
                return value;
              }}
            />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatNumber(value)} />
            {chartConfig.showTooltip && (
              <Tooltip 
                content={<CustomTooltip formatter={(value: number) => formatNumber(value)} />}
              />
            )}
            {chartConfig.showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey={chartConfig.yAxisKey}
              stroke={colors[0]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              animationDuration={chartConfig.animate ? 1000 : 0}
            />
            {chartConfig.showBrush && <Brush />}
          </LineChart>
        );
        
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {chartConfig.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis 
              dataKey={chartConfig.xAxisKey}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                if (chartConfig.xAxisKey === 'date') {
                  return format(parseISO(value), 'MMM d');
                }
                return value;
              }}
            />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatNumber(value, 'percentage')} />
            {chartConfig.showTooltip && (
              <Tooltip 
                content={<CustomTooltip formatter={(value: number) => formatNumber(value, 'percentage')} />}
              />
            )}
            <Area
              type="monotone"
              dataKey={chartConfig.yAxisKey}
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.3}
              animationDuration={chartConfig.animate ? 1000 : 0}
            />
          </AreaChart>
        );
        
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {chartConfig.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis 
              dataKey={chartConfig.xAxisKey}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatNumber(value)} />
            {chartConfig.showTooltip && (
              <Tooltip 
                content={<CustomTooltip formatter={(value: number) => formatNumber(value)} />}
              />
            )}
            <Bar
              dataKey={chartConfig.yAxisKey}
              fill={colors[0]}
              radius={[4, 4, 0, 0]}
              animationDuration={chartConfig.animate ? 1000 : 0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        );
        
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              animationDuration={chartConfig.animate ? 1000 : 0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            {chartConfig.showTooltip && <Tooltip />}
            {chartConfig.showLegend && <Legend />}
          </PieChart>
        );
        
      case 'radar':
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              tickCount={5}
            />
            <Radar
              name="Score"
              dataKey="value"
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            {chartConfig.showTooltip && <Tooltip />}
          </RadarChart>
        );
        
      case 'funnel':
        return (
          <FunnelChart>
            <Tooltip />
            <Funnel
              dataKey="value"
              data={chartData}
              isAnimationActive={chartConfig.animate}
              animationDuration={1000}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
              <LabelList dataKey="name" position="center" fill="#fff" stroke="none" fontSize={14} />
            </Funnel>
          </FunnelChart>
        );
        
      default:
        return null;
    }
  };
  
  // Helper functions
  const isRealtimeChart = (chartConfig: ChartConfig): boolean => {
    return ['views', 'engagement', 'activeUsers'].some(key => 
      chartConfig.dataKey.includes(key)
    );
  };
  
  const downloadChart = async (chartConfig: ChartConfig, index: number) => {
    // Implementation would convert chart to image and download
    toast.success(`Downloading ${chartConfig.title}...`);
  };
  
  const toggleFullscreen = (chartConfig: ChartConfig) => {
    setSelectedChart(chartConfig);
    setIsFullscreen(true);
  };
  
  const toggleChart = (index: string) => {
    setActiveCharts(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Interactive Charts</h2>
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
            <button className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
        
        {/* Chart Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {chartConfigs.map((chart, index) => {
            const isActive = activeCharts.includes(index.toString());
            return (
              <button
                key={index}
                onClick={() => toggleChart(index.toString())}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">{chart.title}</div>
                <div className="text-xs text-gray-500 mt-1">{chart.type}</div>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeCharts.map(chartIndex => {
          const index = parseInt(chartIndex);
          const chartConfig = chartConfigs[index];
          if (!chartConfig) return null;
          
          return (
            <div key={chartIndex} className="chart-container">
              {renderChart(chartConfig, index)}
            </div>
          );
        })}
      </div>
      
      {/* Fullscreen Modal */}
      {isFullscreen && selectedChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div ref={fullscreenRef} className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{selectedChart.title}</h2>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div style={{ width: '100%', height: '600px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {renderChartByType(
                    { ...selectedChart, size: 'xl' },
                    getChartData(selectedChart, processedData),
                    COLOR_SCHEMES[selectedChart.colorScheme]
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}