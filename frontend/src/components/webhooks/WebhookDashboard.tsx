/**
 * Webhook Dashboard Component
 * Main dashboard for managing webhook endpoints and monitoring deliveries
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { AlertCircle, Plus, Settings, BarChart3, Shield, Zap } from 'lucide-react';
import { WebhookEndpointList } from './WebhookEndpointList';
import { WebhookCreateModal } from './WebhookCreateModal';
import { WebhookAnalytics } from './WebhookAnalytics';
import { WebhookSecurityPanel } from './WebhookSecurityPanel';
import { WebhookTemplatesPanel } from './WebhookTemplatesPanel';
import { webhookService } from '../../services/webhook.service';
import { useToast } from '../../hooks/useToast';

interface WebhookEndpoint {
  id: number;
  name: string;
  url: string;
  is_active: boolean;
  event_types: string[];
  health_status: string;
  statistics: {
    total_deliveries: number;
    successful_deliveries: number;
    failed_deliveries: number;
    average_response_time: number;
    uptime_percentage: number;
  };
  created_at: string;
  updated_at: string;
}

interface DashboardStats {
  total_endpoints: number;
  active_endpoints: number;
  total_deliveries_today: number;
  success_rate: number;
  average_response_time: number;
  failed_deliveries_today: number;
}

export const WebhookDashboard: React.FC = () => {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('endpoints');
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load endpoints
      const endpointsResponse = await webhookService.listEndpoints();
      if (endpointsResponse.success) {
        setEndpoints(endpointsResponse.data || []);
      }

      // Calculate dashboard stats
      const dashboardStats = calculateDashboardStats(endpointsResponse.data || []);
      setStats(dashboardStats);
      
    } catch (error) {
      console.error('Failed to load webhook dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load webhook dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboardStats = (endpoints: WebhookEndpoint[]): DashboardStats => {
    const activeEndpoints = endpoints.filter(e => e.is_active);
    
    const totalDeliveries = endpoints.reduce((sum, e) => sum + (e.statistics?.total_deliveries || 0), 0);
    const successfulDeliveries = endpoints.reduce((sum, e) => sum + (e.statistics?.successful_deliveries || 0), 0);
    const failedDeliveries = endpoints.reduce((sum, e) => sum + (e.statistics?.failed_deliveries || 0), 0);
    const avgResponseTimes = endpoints
      .map(e => e.statistics?.average_response_time || 0)
      .filter(t => t > 0);
    
    const averageResponseTime = avgResponseTimes.length > 0
      ? avgResponseTimes.reduce((sum, t) => sum + t, 0) / avgResponseTimes.length
      : 0;
    
    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    return {
      total_endpoints: endpoints.length,
      active_endpoints: activeEndpoints.length,
      total_deliveries_today: totalDeliveries, // This would be filtered by today in a real implementation
      success_rate: successRate,
      average_response_time: averageResponseTime,
      failed_deliveries_today: failedDeliveries, // This would be filtered by today in a real implementation
    };
  };

  const handleEndpointCreated = (newEndpoint: WebhookEndpoint) => {
    setEndpoints(prev => [newEndpoint, ...prev]);
    setShowCreateModal(false);
    loadDashboardData(); // Reload to update stats
  };

  const handleEndpointUpdated = (updatedEndpoint: WebhookEndpoint) => {
    setEndpoints(prev => 
      prev.map(e => e.id === updatedEndpoint.id ? updatedEndpoint : e)
    );
    loadDashboardData(); // Reload to update stats
  };

  const handleEndpointDeleted = (endpointId: number) => {
    setEndpoints(prev => prev.filter(e => e.id !== endpointId));
    loadDashboardData(); // Reload to update stats
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Webhooks Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Manage your webhook endpoints and monitor real-time integrations
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Endpoint
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Endpoints</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_endpoints}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Settings className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {stats.active_endpoints} active
                </span>
                <Badge variant={stats.active_endpoints > 0 ? 'success' : 'secondary'}>
                  {stats.active_endpoints > 0 ? 'Running' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.success_rate.toFixed(1)}%
                  </p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-sm text-gray-600">
                  {stats.total_deliveries_today} deliveries today
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.average_response_time.toFixed(0)}ms
                  </p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-2">
                <Badge variant={stats.average_response_time < 1000 ? 'success' : 'warning'}>
                  {stats.average_response_time < 1000 ? 'Fast' : 'Slow'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Deliveries</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.failed_deliveries_today}
                  </p>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="mt-2">
                <Badge variant={stats.failed_deliveries_today === 0 ? 'success' : 'destructive'}>
                  {stats.failed_deliveries_today === 0 ? 'No Issues' : 'Attention Needed'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Webhook Endpoints
              </CardTitle>
            </CardHeader>
            <CardContent>
              {endpoints.length === 0 ? (
                <div className="text-center py-12">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No webhook endpoints yet
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Get started by creating your first webhook endpoint to receive real-time updates.
                  </p>
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Endpoint
                  </Button>
                </div>
              ) : (
                <WebhookEndpointList
                  endpoints={endpoints}
                  onEndpointUpdated={handleEndpointUpdated}
                  onEndpointDeleted={handleEndpointDeleted}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <WebhookAnalytics endpoints={endpoints} />
        </TabsContent>

        <TabsContent value="security">
          <WebhookSecurityPanel endpoints={endpoints} />
        </TabsContent>

        <TabsContent value="templates">
          <WebhookTemplatesPanel onEndpointCreated={handleEndpointCreated} />
        </TabsContent>
      </Tabs>

      {/* Create Modal */}
      <WebhookCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onEndpointCreated={handleEndpointCreated}
      />
    </div>
  );
};