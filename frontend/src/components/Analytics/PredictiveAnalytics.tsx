import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ReferenceArea
} from 'recharts';
import {
  TrendingUp, TrendingDown, Brain, Zap, Target, AlertTriangle,
  CheckCircle, Info, Calendar, Clock, DollarSign, Users, Eye,
  Star, Award, Sparkles, Activity, BarChart3, PieChart,
  ArrowUpRight, ArrowDownRight, ChevronRight, RefreshCw,
  Settings, Filter, Download, Share2, Lightbulb, Rocket,
  Shield, Globe, Monitor, Smartphone, Building
} from 'lucide-react';
import { format, addDays, addMonths, addWeeks, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'react-hot-toast';

// Prediction model types
interface PredictionModel {
  id: string;
  name: string;
  description: string;
  accuracy: number;
  confidence: number;
  lastTrained: string;
  features: string[];
  algorithm: 'linear_regression' | 'random_forest' | 'neural_network' | 'arima' | 'prophet';
}

// Forecast data structure
interface ForecastData {
  date: string;
  actual?: number;
  predicted: number;
  lower_bound: number;
  upper_bound: number;
  confidence: number;
  factors: { [key: string]: number };
}

// Anomaly detection
interface Anomaly {
  id: string;
  timestamp: string;
  metric: string;
  value: number;
  expected: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendations: string[];
}

// Business insights
interface BusinessInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'anomaly';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  timeline: string;
  recommendations: string[];
  metrics_affected: string[];
  estimated_value: number;
}

interface PredictiveAnalyticsProps {
  data: any;
  role: string;
  timeRange: string;
}

// ML Models configuration
const PREDICTION_MODELS: PredictionModel[] = [
  {
    id: 'revenue_forecast',
    name: 'Revenue Forecasting',
    description: 'Predicts future revenue based on historical trends and seasonal patterns',
    accuracy: 85.2,
    confidence: 78.9,
    lastTrained: '2024-01-15T10:00:00Z',
    features: ['historical_revenue', 'user_growth', 'seasonality', 'market_trends'],
    algorithm: 'prophet'
  },
  {
    id: 'user_growth',
    name: 'User Growth Prediction',
    description: 'Forecasts user acquisition and retention patterns',
    accuracy: 79.6,
    confidence: 82.1,
    lastTrained: '2024-01-14T15:30:00Z',
    features: ['signup_rate', 'churn_rate', 'engagement', 'marketing_spend'],
    algorithm: 'random_forest'
  },
  {
    id: 'content_performance',
    name: 'Content Performance Predictor',
    description: 'Predicts content engagement and viral potential',
    accuracy: 73.4,
    confidence: 69.8,
    lastTrained: '2024-01-13T09:15:00Z',
    features: ['content_type', 'creator_history', 'timing', 'genre', 'tags'],
    algorithm: 'neural_network'
  },
  {
    id: 'investment_success',
    name: 'Investment Success Predictor',
    description: 'Analyzes project success probability for investors',
    accuracy: 81.7,
    confidence: 76.3,
    lastTrained: '2024-01-12T14:20:00Z',
    features: ['creator_track_record', 'project_category', 'budget', 'team_size'],
    algorithm: 'random_forest'
  },
  {
    id: 'churn_prediction',
    name: 'Churn Risk Assessment',
    description: 'Identifies users at risk of churning',
    accuracy: 88.9,
    confidence: 84.2,
    lastTrained: '2024-01-11T11:45:00Z',
    features: ['activity_level', 'engagement_decline', 'support_tickets', 'subscription_type'],
    algorithm: 'neural_network'
  }
];

export default function PredictiveAnalytics({ data, role, timeRange }: PredictiveAnalyticsProps) {
  const [selectedModel, setSelectedModel] = useState<string>('revenue_forecast');
  const [forecastPeriod, setForecastPeriod] = useState<number>(30); // days
  const [confidenceLevel, setConfidenceLevel] = useState<number>(80);
  const [loading, setLoading] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  
  // Generated forecasts and predictions
  const [forecasts, setForecasts] = useState<Record<string, ForecastData[]>>({});
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  
  // Filter models by role
  const availableModels = useMemo(() => {
    const roleModels = {
      creator: ['revenue_forecast', 'content_performance', 'user_growth'],
      investor: ['investment_success', 'revenue_forecast', 'user_growth'],
      production: ['revenue_forecast', 'content_performance', 'investment_success'],
      admin: PREDICTION_MODELS.map(m => m.id)
    };
    
    return PREDICTION_MODELS.filter(model => 
      roleModels[role as keyof typeof roleModels]?.includes(model.id)
    );
  }, [role]);
  
  // Generate mock forecast data
  const generateForecastData = (modelId: string, days: number): ForecastData[] => {
    const baseValue = {
      revenue_forecast: 50000,
      user_growth: 1000,
      content_performance: 10000,
      investment_success: 75,
      churn_prediction: 5
    }[modelId] || 1000;
    
    const variance = baseValue * 0.1;
    const trend = {
      revenue_forecast: 1.02,
      user_growth: 1.015,
      content_performance: 1.01,
      investment_success: 1.005,
      churn_prediction: 0.995
    }[modelId] || 1.01;
    
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(new Date(), i + 1);
      const trendValue = baseValue * Math.pow(trend, i);
      const noise = (Math.random() - 0.5) * variance;
      const predicted = trendValue + noise;
      
      return {
        date: format(date, 'yyyy-MM-dd'),
        predicted: Math.max(0, predicted),
        lower_bound: Math.max(0, predicted - variance),
        upper_bound: predicted + variance,
        confidence: Math.random() * 20 + 70, // 70-90% confidence
        factors: {
          trend: trend > 1 ? (trend - 1) * 100 : (1 - trend) * -100,
          seasonality: Math.sin(i * Math.PI / 30) * 5,
          noise: (noise / variance) * 10
        }
      };
    });
  };
  
  // Generate mock anomalies
  const generateAnomalies = (): Anomaly[] => {
    const anomalyTypes = [
      {
        metric: 'User Registration',
        value: 1250,
        expected: 800,
        severity: 'high' as const,
        description: 'Unusual spike in user registrations detected',
        recommendations: [
          'Investigate traffic sources',
          'Monitor server capacity',
          'Verify data quality'
        ]
      },
      {
        metric: 'Revenue',
        value: 42000,
        expected: 48000,
        severity: 'medium' as const,
        description: 'Revenue below expected range',
        recommendations: [
          'Review recent pricing changes',
          'Analyze customer feedback',
          'Check payment processing issues'
        ]
      },
      {
        metric: 'Engagement Rate',
        value: 0.18,
        expected: 0.25,
        severity: 'medium' as const,
        description: 'Engagement rate declining',
        recommendations: [
          'Review recent content changes',
          'Analyze user behavior patterns',
          'Consider A/B testing new features'
        ]
      }
    ];
    
    return anomalyTypes.map((anomaly, index) => ({
      id: `anomaly_${index}`,
      timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      ...anomaly
    }));
  };
  
  // Generate business insights
  const generateInsights = (): BusinessInsight[] => {
    const insightTemplates = [
      {
        type: 'opportunity' as const,
        title: 'Peak Engagement Window Identified',
        description: 'Data shows 35% higher engagement between 2-4 PM on weekdays',
        impact: 'high' as const,
        confidence: 87.5,
        timeline: 'Immediate',
        recommendations: [
          'Schedule important content releases during peak hours',
          'Increase social media activity in this window',
          'Target marketing campaigns for 1-3 PM'
        ],
        metrics_affected: ['engagement_rate', 'conversion_rate', 'user_retention'],
        estimated_value: 25000
      },
      {
        type: 'risk' as const,
        title: 'Potential Churn Risk in Q2',
        description: 'Model predicts 15% increase in churn risk for users inactive >7 days',
        impact: 'high' as const,
        confidence: 82.1,
        timeline: '2-3 months',
        recommendations: [
          'Implement re-engagement email campaigns',
          'Create personalized content recommendations',
          'Offer limited-time incentives for inactive users'
        ],
        metrics_affected: ['churn_rate', 'user_retention', 'lifetime_value'],
        estimated_value: -45000
      },
      {
        type: 'trend' as const,
        title: 'Mobile Usage Growth Accelerating',
        description: 'Mobile traffic growing 25% month-over-month, will exceed desktop by Q3',
        impact: 'medium' as const,
        confidence: 91.3,
        timeline: '3-6 months',
        recommendations: [
          'Prioritize mobile UI/UX improvements',
          'Optimize mobile page load speeds',
          'Consider mobile-first content strategy'
        ],
        metrics_affected: ['mobile_engagement', 'page_load_time', 'conversion_rate'],
        estimated_value: 15000
      },
      {
        type: 'opportunity' as const,
        title: 'Genre Diversification Opportunity',
        description: 'Documentary category shows 40% higher investment success rate',
        impact: 'medium' as const,
        confidence: 76.8,
        timeline: '1-2 months',
        recommendations: [
          'Encourage more documentary submissions',
          'Create documentary-specific marketing campaigns',
          'Partner with documentary film festivals'
        ],
        metrics_affected: ['investment_success_rate', 'portfolio_diversity', 'revenue'],
        estimated_value: 35000
      }
    ];
    
    return insightTemplates.map((insight, index) => ({
      ...insight,
      id: `insight_${index}`
    }));
  };
  
  // Load predictions when model or period changes
  useEffect(() => {
    setLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const forecastData = generateForecastData(selectedModel, forecastPeriod);
      setForecasts(prev => ({ ...prev, [selectedModel]: forecastData }));
      
      if (showAnomalies) {
        setAnomalies(generateAnomalies());
      }
      
      if (showInsights) {
        setInsights(generateInsights());
      }
      
      setLoading(false);
    }, 1000);
  }, [selectedModel, forecastPeriod, showAnomalies, showInsights]);
  
  const selectedModelDetails = PREDICTION_MODELS.find(m => m.id === selectedModel);
  const currentForecast = forecasts[selectedModel] || [];
  
  // Format value based on model type
  const formatValue = (value: number, modelId: string): string => {
    switch (modelId) {
      case 'revenue_forecast':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0
        }).format(value);
      case 'user_growth':
        return value.toLocaleString();
      case 'content_performance':
        return value.toLocaleString();
      case 'investment_success':
        return `${value.toFixed(1)}%`;
      case 'churn_prediction':
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };
  
  // Get trend direction and color
  const getTrendInfo = (forecast: ForecastData[]) => {
    if (forecast.length < 2) return { direction: 'stable', color: 'text-gray-600', icon: TrendingUp };
    
    const start = forecast[0].predicted;
    const end = forecast[forecast.length - 1].predicted;
    const change = ((end - start) / start) * 100;
    
    if (change > 5) {
      return { direction: 'up', color: 'text-green-600', icon: TrendingUp, change };
    } else if (change < -5) {
      return { direction: 'down', color: 'text-red-600', icon: TrendingDown, change };
    } else {
      return { direction: 'stable', color: 'text-gray-600', icon: TrendingUp, change };
    }
  };
  
  const trendInfo = getTrendInfo(currentForecast);
  const TrendIcon = trendInfo.icon;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Predictive Analytics</h2>
              <p className="text-gray-600">AI-powered forecasting and business insights</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-purple-700">Powered by ML</span>
          </div>
        </div>
      </div>
      
      {/* Model Selection and Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prediction Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} (Accuracy: {model.accuracy}%)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forecast Period
            </label>
            <select
              value={forecastPeriod}
              onChange={(e) => setForecastPeriod(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={7}>7 days</option>
              <option value={14}>2 weeks</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>6 months</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Level
            </label>
            <select
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={70}>70%</option>
              <option value={80}>80%</option>
              <option value={90}>90%</option>
              <option value={95}>95%</option>
            </select>
          </div>
        </div>
        
        {/* Model Details */}
        {selectedModelDetails && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{selectedModelDetails.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{selectedModelDetails.description}</p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span>Algorithm: {selectedModelDetails.algorithm}</span>
                  <span>Features: {selectedModelDetails.features.length}</span>
                  <span>Last trained: {format(new Date(selectedModelDetails.lastTrained), 'MMM d, yyyy')}</span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{selectedModelDetails.accuracy}%</div>
                  <div className="text-xs text-gray-500">Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{selectedModelDetails.confidence}%</div>
                  <div className="text-xs text-gray-500">Confidence</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Forecast Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Forecast Visualization</h3>
            <p className="text-sm text-gray-600">
              {forecastPeriod} day forecast with {confidenceLevel}% confidence interval
            </p>
          </div>
          
          {!loading && currentForecast.length > 0 && (
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 ${trendInfo.color}`}>
                <TrendIcon className="w-5 h-5" />
                <span className="font-medium">
                  {Math.abs(trendInfo.change || 0).toFixed(1)}% {trendInfo.direction}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Predicted: {formatValue(currentForecast[currentForecast.length - 1]?.predicted || 0, selectedModel)}
              </div>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Generating predictions...</p>
            </div>
          </div>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={currentForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatValue(value, selectedModel)}
                />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                  formatter={(value: number) => [formatValue(value, selectedModel), '']}
                />
                <Legend />
                
                {/* Confidence interval area */}
                <Area 
                  type="monotone" 
                  dataKey="upper_bound" 
                  stackId="confidence"
                  stroke="none" 
                  fill="#3b82f6" 
                  fillOpacity={0.1}
                  name="Upper bound"
                />
                <Area 
                  type="monotone" 
                  dataKey="lower_bound" 
                  stackId="confidence"
                  stroke="none" 
                  fill="#ffffff" 
                  fillOpacity={1}
                  name="Lower bound"
                />
                
                {/* Main prediction line */}
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Predicted"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      
      {/* Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anomalies */}
        {showAnomalies && anomalies.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Anomaly Detection</h3>
              <span className="text-sm text-gray-500">{anomalies.length} detected</span>
            </div>
            
            <div className="space-y-4">
              {anomalies.map((anomaly) => {
                const severityColors = {
                  low: 'border-blue-200 bg-blue-50',
                  medium: 'border-yellow-200 bg-yellow-50',
                  high: 'border-orange-200 bg-orange-50',
                  critical: 'border-red-200 bg-red-50'
                };
                
                const severityIcons = {
                  low: Info,
                  medium: AlertTriangle,
                  high: AlertTriangle,
                  critical: AlertTriangle
                };
                
                const SeverityIcon = severityIcons[anomaly.severity];
                
                return (
                  <div key={anomaly.id} className={`p-4 border rounded-lg ${severityColors[anomaly.severity]}`}>
                    <div className="flex items-start space-x-3">
                      <SeverityIcon className="w-5 h-5 text-gray-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{anomaly.metric}</span>
                          <span className="text-sm text-gray-500 capitalize">{anomaly.severity}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{anomaly.description}</p>
                        <div className="text-sm text-gray-600 mb-3">
                          Actual: <span className="font-medium">{formatValue(anomaly.value, selectedModel)}</span> | 
                          Expected: <span className="font-medium">{formatValue(anomaly.expected, selectedModel)}</span>
                        </div>
                        <div className="space-y-1">
                          {anomaly.recommendations.slice(0, 2).map((rec, index) => (
                            <div key={index} className="text-xs text-gray-600 flex items-center space-x-1">
                              <ChevronRight className="w-3 h-3" />
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Business Insights */}
        {showInsights && insights.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Business Insights</h3>
              <span className="text-sm text-gray-500">{insights.length} insights</span>
            </div>
            
            <div className="space-y-4">
              {insights.map((insight) => {
                const typeColors = {
                  opportunity: 'border-green-200 bg-green-50',
                  risk: 'border-red-200 bg-red-50',
                  trend: 'border-blue-200 bg-blue-50',
                  anomaly: 'border-yellow-200 bg-yellow-50'
                };
                
                const typeIcons = {
                  opportunity: Rocket,
                  risk: Shield,
                  trend: TrendingUp,
                  anomaly: Zap
                };
                
                const TypeIcon = typeIcons[insight.type];
                
                return (
                  <div key={insight.id} className={`p-4 border rounded-lg ${typeColors[insight.type]}`}>
                    <div className="flex items-start space-x-3">
                      <TypeIcon className="w-5 h-5 text-gray-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{insight.title}</span>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span className="capitalize">{insight.impact} impact</span>
                            <span>•</span>
                            <span>{insight.confidence}% confidence</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                        <div className="flex items-center justify-between mb-3 text-sm">
                          <span className="text-gray-600">Timeline: {insight.timeline}</span>
                          <span className="font-medium text-gray-900">
                            {formatValue(Math.abs(insight.estimated_value), 'revenue_forecast')} impact
                          </span>
                        </div>
                        <div className="space-y-1">
                          {insight.recommendations.slice(0, 2).map((rec, index) => (
                            <div key={index} className="text-xs text-gray-600 flex items-center space-x-1">
                              <Lightbulb className="w-3 h-3" />
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Feature Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showAnomalies}
              onChange={(e) => setShowAnomalies(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Anomaly Detection</span>
              <p className="text-sm text-gray-600">Detect unusual patterns and outliers</p>
            </div>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showInsights}
              onChange={(e) => setShowInsights(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Business Insights</span>
              <p className="text-sm text-gray-600">AI-generated recommendations</p>
            </div>
          </label>
          
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Predictions</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}