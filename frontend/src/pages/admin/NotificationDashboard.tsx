/**
 * Real-time Notification Dashboard
 * Live metrics, analytics, and system monitoring
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, RadarChart, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  Activity, AlertCircle, Bell, CheckCircle,
  Clock, Mail, MessageSquare, Send, Smartphone,
  TrendingDown, TrendingUp, Users, Zap,
  RefreshCw, Download, Filter, Calendar
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useWebSocket } from '../../hooks/useWebSocket';

interface DashboardMetrics {
  realtime: {
    activeUsers: number;
    notificationsPerMinute: number;
    queueSize: number;
    processingRate: number;
    errorRate: number;
    avgDeliveryTime: number;
  };
  totals: {
    sent: number;
    delivered: number;
    read: number;
    clicked: number;
    failed: number;
  };
  rates: {
    delivery: number;
    read: number;
    click: number;
    bounce: number;
  };
  channels: Array<{
    name: string;
    sent: number;
    delivered: number;
    failed: number;
    performance: number;
  }>;
  types: Array<{
    type: string;
    count: number;
    readRate: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  hourlyActivity: Array<{
    hour: string;
    notifications: number;
    delivered: number;
    read: number;
  }>;
  topUsers: Array<{
    id: number;
    name: string;
    count: number;
    engagement: number;
  }>;
  experiments: Array<{
    id: string;
    name: string;
    status: 'active' | 'completed';
    variantA: number;
    variantB: number;
    winner: string | null;
    confidence: number;
  }>;
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    latency: number;
    queueBacklog: number;
    errorCount: number;
  };
}

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
const REFRESH_INTERVALS = [
  { value: 5000, label: '5 seconds' },
  { value: 10000, label: '10 seconds' },
  { value: 30000, label: '30 seconds' },
  { value: 60000, label: '1 minute' }
];

export const NotificationDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const intervalRef = useRef<NodeJS.Timeout>();
  const { sendMessage, lastMessage } = useWebSocket();

  // Fetch dashboard metrics
  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('token');
    const response = await fetch(`${config.API_URL}/api/admin`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  // WebSocket real-time updates
  useEffect(() => {
    if (lastMessage) {
      const update = JSON.parse(lastMessage.data);
      if (update.type === 'metrics_update') {
        setMetrics(prev => ({
          ...prev!,
          realtime: update.data.realtime
        }));
      }
    }
  }, [lastMessage]);

  // Auto-refresh
  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMetrics, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeRange, refreshInterval, autoRefresh, selectedChannel]);

  // Subscribe to real-time updates
  useEffect(() => {
    sendMessage({
      type: 'subscribe',
      channel: 'notification_metrics'
    });

    return () => {
      sendMessage({
        type: 'unsubscribe',
        channel: 'notification_metrics'
      });
    };
  }, [sendMessage]);

  // Export metrics
  const exportMetrics = () => {
    const csv = convertToCSV(metrics);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-metrics-${Date.now()}.csv`;
    a.click();
  };

  const convertToCSV = (data: any) => {
    // Convert metrics to CSV format
    return 'Metric,Value\n' + Object.entries(data.totals)
      .map(([key, value]) => `${key},${value}`)
      .join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || 'No metrics available'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notification Dashboard</h1>
          <p className="text-gray-600">Real-time monitoring and analytics</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select 
            value={refreshInterval.toString()} 
            onValueChange={(v) => setRefreshInterval(parseInt(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REFRESH_INTERVALS.map(interval => (
                <SelectItem key={interval.value} value={interval.value.toString()}>
                  {interval.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="icon"
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </Button>

          <Button variant="outline" onClick={exportMetrics} size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* System Health Alert */}
      {metrics.systemHealth.status !== 'healthy' && (
        <Alert className={
          metrics.systemHealth.status === 'critical' ? 'border-red-500' : 'border-yellow-500'
        }>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            System Status: {metrics.systemHealth.status.toUpperCase()} - 
            {metrics.systemHealth.errorCount} errors in the last hour
          </AlertDescription>
        </Alert>
      )}

      {/* Real-time Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.realtime.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Currently online</p>
            <div className="mt-2">
              <Progress value={Math.min(metrics.realtime.activeUsers / 100 * 10, 100)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Notifications/min</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.realtime.notificationsPerMinute}</div>
            <p className="text-xs text-muted-foreground">Current throughput</p>
            <div className="flex items-center mt-2 text-sm">
              {metrics.realtime.notificationsPerMinute > 50 ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span>Queue: {metrics.realtime.queueSize}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics.rates.delivery * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
            <div className="mt-2">
              <Progress value={metrics.rates.delivery * 100} className="bg-green-100" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.realtime.avgDeliveryTime}ms</div>
            <p className="text-xs text-muted-foreground">Processing latency</p>
            <Badge 
              variant={metrics.realtime.avgDeliveryTime < 100 ? "success" : "warning"}
              className="mt-2"
            >
              {metrics.realtime.avgDeliveryTime < 100 ? 'Optimal' : 'Degraded'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="experiments">A/B Tests</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Hourly Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Hourly Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics.hourlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="notifications" stackId="1" stroke="#6366f1" fill="#6366f1" />
                    <Area type="monotone" dataKey="delivered" stackId="1" stroke="#10b981" fill="#10b981" />
                    <Area type="monotone" dataKey="read" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Notification Types Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Notification Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics.types}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, count }) => `${type}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {metrics.types.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    <span>Sent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{metrics.totals.sent}</span>
                    <Progress value={100} className="w-32" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <span>Delivered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{metrics.totals.delivered}</span>
                    <Progress value={metrics.rates.delivery * 100} className="w-32" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Read</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{metrics.totals.read}</span>
                    <Progress value={metrics.rates.read * 100} className="w-32" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Clicked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{metrics.totals.clicked}</span>
                    <Progress value={metrics.rates.click * 100} className="w-32" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Channel Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={metrics.channels}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" fill="#6366f1" />
                  <Bar dataKey="delivered" fill="#10b981" />
                  <Bar dataKey="failed" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metrics.channels.map(channel => (
              <Card key={channel.name}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {channel.name === 'in_app' && <Bell className="inline h-4 w-4 mr-2" />}
                    {channel.name === 'email' && <Mail className="inline h-4 w-4 mr-2" />}
                    {channel.name === 'push' && <Smartphone className="inline h-4 w-4 mr-2" />}
                    {channel.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Performance</span>
                      <span className="font-bold">{channel.performance.toFixed(1)}%</span>
                    </div>
                    <Progress value={channel.performance} />
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div>
                        <div className="font-bold">{channel.sent}</div>
                        <div className="text-muted-foreground">Sent</div>
                      </div>
                      <div>
                        <div className="font-bold text-green-600">{channel.delivered}</div>
                        <div className="text-muted-foreground">Delivered</div>
                      </div>
                      <div>
                        <div className="font-bold text-red-600">{channel.failed}</div>
                        <div className="text-muted-foreground">Failed</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          {/* Top Users */}
          <Card>
            <CardHeader>
              <CardTitle>Most Engaged Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.topUsers.map((user, index) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{index + 1}</Badge>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.count} notifications
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{user.engagement}%</div>
                      <div className="text-xs text-muted-foreground">Engagement</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Engagement Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={metrics.types}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="type" />
                  <PolarRadiusAxis />
                  <Radar name="Read Rate" dataKey="readRate" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="experiments" className="space-y-4">
          {metrics.experiments.map(experiment => (
            <Card key={experiment.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{experiment.name}</span>
                  <Badge variant={experiment.status === 'active' ? 'default' : 'secondary'}>
                    {experiment.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-lg border ${
                      experiment.winner === 'A' ? 'bg-green-50 border-green-500' : ''
                    }`}>
                      <div className="text-sm font-medium">Variant A</div>
                      <div className="text-2xl font-bold">{experiment.variantA}%</div>
                    </div>
                    <div className={`p-4 rounded-lg border ${
                      experiment.winner === 'B' ? 'bg-green-50 border-green-500' : ''
                    }`}>
                      <div className="text-sm font-medium">Variant B</div>
                      <div className="text-2xl font-bold">{experiment.variantB}%</div>
                    </div>
                  </div>
                  {experiment.winner && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Winner: Variant {experiment.winner} with {experiment.confidence}% confidence
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <Badge variant={
                      metrics.systemHealth.status === 'healthy' ? 'success' :
                      metrics.systemHealth.status === 'degraded' ? 'warning' : 'destructive'
                    }>
                      {metrics.systemHealth.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Uptime</span>
                    <span className="font-mono">{metrics.systemHealth.uptime}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Latency</span>
                    <span className="font-mono">{metrics.systemHealth.latency}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Queue Backlog</span>
                    <span className="font-mono">{metrics.systemHealth.queueBacklog}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Errors (1h)</span>
                    <span className="font-mono text-red-600">{metrics.systemHealth.errorCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Rate Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={metrics.hourlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="errorRate" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Queue Processing</span>
                    <span className="text-sm font-medium">
                      {metrics.realtime.processingRate} msg/sec
                    </span>
                  </div>
                  <Progress value={Math.min(metrics.realtime.processingRate / 100 * 10, 100)} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Delivery Success</span>
                    <span className="text-sm font-medium">
                      {(metrics.rates.delivery * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={metrics.rates.delivery * 100} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Error Rate</span>
                    <span className="text-sm font-medium">
                      {metrics.realtime.errorRate.toFixed(2)}%
                    </span>
                  </div>
                  <Progress 
                    value={metrics.realtime.errorRate} 
                    className={metrics.realtime.errorRate > 5 ? 'bg-red-100' : ''}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};