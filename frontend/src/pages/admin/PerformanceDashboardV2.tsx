/**
 * Enhanced Performance Dashboard with Real Metrics Integration
 * Connects to backend monitoring endpoints for live data
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
  Activity, Database, Server, Users, Clock, TrendingUp,
  AlertTriangle, CheckCircle, XCircle, Zap, HardDrive,
  Cpu, Globe, Shield, DollarSign, RefreshCw, Download,
  Settings, Bell, Eye, Wifi, WifiOff
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { metricsService, PerformanceMetrics, SystemHealth } from '@/services/metrics.service';

const PerformanceDashboardV2: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [alerts, setAlerts] = useState<any[]>([]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      const [perfMetrics, systemHealth] = await Promise.all([
        metricsService.getPerformanceMetrics(),
        metricsService.getSystemHealth()
      ]);
      
      setMetrics(perfMetrics);
      setHealth(systemHealth);
      
      // Check for alerts
      checkForAlerts(perfMetrics, systemHealth);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch metrics',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check for alerts based on thresholds
  const checkForAlerts = (metrics: PerformanceMetrics, health: SystemHealth) => {
    const newAlerts = [];
    
    // Response time alert
    if (metrics.responseTime.p95 > 1000) {
      newAlerts.push({
        type: 'warning',
        title: 'High Response Time',
        message: `P95 response time is ${metrics.responseTime.p95}ms`
      });
    }
    
    // Error rate alert
    if (metrics.errorRate.current > 5) {
      newAlerts.push({
        type: 'danger',
        title: 'High Error Rate',
        message: `Error rate is ${metrics.errorRate.current}%`
      });
    }
    
    // System health alert
    if (health.overall !== 'healthy') {
      newAlerts.push({
        type: 'warning',
        title: 'System Degraded',
        message: `System status: ${health.overall}`
      });
    }
    
    setAlerts(newAlerts);
  };

  // Setup auto-refresh
  useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, autoRefresh, refreshInterval]);

  // Setup WebSocket connection
  useEffect(() => {
    metricsService.connectWebSocket();
    
    const unsubscribePerf = metricsService.subscribe('performance', (data) => {
      setMetrics(data);
      setIsConnected(true);
    });
    
    const unsubscribeHealth = metricsService.subscribe('health', (data) => {
      setHealth(data);
    });
    
    return () => {
      unsubscribePerf();
      unsubscribeHealth();
      metricsService.disconnect();
    };
  }, []);

  // Export metrics
  const exportMetrics = async () => {
    try {
      const blob = await metricsService.exportMetricsCSV(timeRange);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metrics-${timeRange}-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: 'Metrics exported successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export metrics',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'unhealthy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Performance Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Real-time monitoring and analytics
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <Badge className={isConnected ? 'bg-green-500' : 'bg-gray-500'}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 mr-1" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 mr-1" />
                Offline
              </>
            )}
          </Badge>

          {/* Time Range */}
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          {/* Auto Refresh */}
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh">Auto Refresh</Label>
          </div>

          {/* Export */}
          <Button onClick={exportMetrics} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          {/* Settings */}
          <Button variant="outline" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert key={index} variant={alert.type === 'danger' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Health Status Cards */}
      {health && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Overall Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {getStatusIcon(health.overall)}
                <span className="text-2xl font-bold capitalize">{health.overall}</span>
              </div>
            </CardContent>
          </Card>

          {Object.entries(health.services).map(([service, status]) => (
            <Card key={service}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize">{service}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {getStatusIcon(status.status)}
                  <span className="text-sm">{status.latency || 'N/A'}</span>
                </div>
                {status.error && (
                  <p className="text-xs text-red-500 mt-1">{status.error}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Metrics */}
      {metrics && (
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.responseTime.current}ms</div>
                  <p className="text-xs text-muted-foreground">
                    P95: {metrics.responseTime.p95}ms
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Throughput</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.throughput.rps} req/s</div>
                  <p className="text-xs text-muted-foreground">
                    Total: {metrics.throughput.current.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.errorRate.current}%</div>
                  <p className="text-xs text-muted-foreground">
                    4xx: {metrics.errorRate.rate4xx}% | 5xx: {metrics.errorRate.rate5xx}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.cache.hitRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    Memory: {metrics.cache.memory}MB
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Response Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Response Time Trend</CardTitle>
                <CardDescription>Percentile response times over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.responseTime.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#8884d8" name="Response Time (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Throughput Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Throughput</CardTitle>
                <CardDescription>Requests per second</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics.throughput.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#82ca9d" fill="#82ca9d" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            {/* Latency Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Latency Distribution</CardTitle>
                <CardDescription>Response time percentiles</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { percentile: 'P50', value: metrics.responseTime.p50 },
                      { percentile: 'P95', value: metrics.responseTime.p95 },
                      { percentile: 'P99', value: metrics.responseTime.p99 }
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="percentile" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Query Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.database.queryTime}ms</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Connections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.database.connections}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Slow Queries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.database.slowQueries}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Database Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.database.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#ffc658" name="Query Time (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cache" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cache Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Hit Rate</span>
                      <span className="font-bold">{metrics.cache.hitRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Miss Rate</span>
                      <span className="font-bold">{metrics.cache.missRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Evictions</span>
                      <span className="font-bold">{metrics.cache.evictions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Memory Usage</span>
                      <span className="font-bold">{metrics.cache.memory}MB</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cache Hit/Miss Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Hits', value: metrics.cache.hitRate },
                          { name: 'Misses', value: metrics.cache.missRate }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#82ca9d" />
                        <Cell fill="#ff8042" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Rate Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.errorRate.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#ef4444" name="Error Rate (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Error Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>4xx Errors</span>
                      <Badge variant="secondary">{metrics.errorRate.rate4xx}%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>5xx Errors</span>
                      <Badge variant="destructive">{metrics.errorRate.rate5xx}%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <div className="grid grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">CPU Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.system.cpuUsage}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Memory</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.system.memoryUsage}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Disk</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.system.diskUsage}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Network In</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.system.networkIn} MB/s</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Network Out</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.system.networkOut} MB/s</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart
                    data={[
                      { metric: 'CPU', value: metrics.system.cpuUsage },
                      { metric: 'Memory', value: metrics.system.memoryUsage },
                      { metric: 'Disk', value: metrics.system.diskUsage },
                      { metric: 'Network In', value: metrics.system.networkIn * 10 },
                      { metric: 'Network Out', value: metrics.system.networkOut * 10 }
                    ]}
                  >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Usage" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default PerformanceDashboardV2;