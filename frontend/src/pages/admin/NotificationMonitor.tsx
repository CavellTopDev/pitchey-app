import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { config } from '../../config';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface NotificationMetrics {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  byChannel: {
    email: number;
    sms: number;
    push: number;
    inApp: number;
    webhook: number;
  };
  byTemplate: Record<string, number>;
  hourlyStats: Array<{
    hour: string;
    count: number;
  }>;
  deliveryRate: number;
  avgDeliveryTime: number;
}

interface WebSocketMetrics {
  activeConnections: number;
  totalConnections: number;
  messagesSent: number;
  messagesReceived: number;
  rooms: Array<{
    id: string;
    connections: number;
    messages: number;
  }>;
  connectionsByUserType: {
    creator: number;
    investor: number;
    production: number;
  };
}

interface RateLimitMetrics {
  requests: number;
  limited: number;
  bypassed: number;
  byTier: {
    basic: { requests: number; limited: number };
    premium: { requests: number; limited: number };
    enterprise: { requests: number; limited: number };
  };
}

export const NotificationMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [wsMetrics, setWsMetrics] = useState<WebSocketMetrics | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');

  // Fetch notification metrics
  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('authToken');
    const response = await fetch(`${config.API_URL}/api/admin`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch notification metrics:', error);
    }
  };

  // Fetch WebSocket metrics
  const fetchWebSocketMetrics = async () => {
    try {
      const token = localStorage.getItem('authToken');
    const response = await fetch(`${config.API_URL}/api/admin`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        const data = await response.json();
        setWsMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch WebSocket metrics:', error);
    }
  };

  // Fetch rate limit metrics
  const fetchRateLimitMetrics = async () => {
    try {
      const token = localStorage.getItem('authToken');
    const response = await fetch(`${config.API_URL}/api/admin`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        const data = await response.json();
        setRateLimits(data);
      }
    } catch (error) {
      console.error('Failed to fetch rate limit metrics:', error);
    }
  };

  // Fetch all metrics
  const fetchAllMetrics = async () => {
    setLoading(true);
    await Promise.all([
      fetchMetrics(),
      fetchWebSocketMetrics(),
      fetchRateLimitMetrics()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchAllMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Chart configurations
  const deliveryChartData = {
    labels: ['Sent', 'Delivered', 'Failed', 'Pending'],
    datasets: [{
      data: [
        metrics?.sent || 0,
        metrics?.delivered || 0,
        metrics?.failed || 0,
        metrics?.pending || 0
      ],
      backgroundColor: [
        '#3B82F6', // Blue
        '#10B981', // Green
        '#EF4444', // Red
        '#F59E0B'  // Amber
      ]
    }]
  };

  const channelChartData = {
    labels: ['Email', 'SMS', 'Push', 'In-App', 'Webhook'],
    datasets: [{
      label: 'Messages by Channel',
      data: [
        metrics?.byChannel.email || 0,
        metrics?.byChannel.sms || 0,
        metrics?.byChannel.push || 0,
        metrics?.byChannel.inApp || 0,
        metrics?.byChannel.webhook || 0
      ],
      backgroundColor: '#6366F1'
    }]
  };

  const hourlyChartData = {
    labels: metrics?.hourlyStats?.map(s => s.hour) || [],
    datasets: [{
      label: 'Notifications per Hour',
      data: metrics?.hourlyStats?.map(s => s.count) || [],
      borderColor: '#8B5CF6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: true
    }]
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Notification System Monitor
            </h1>
            <div className="flex items-center gap-4">
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="autoRefresh">Auto Refresh</label>
              </div>
              
              <button
                onClick={fetchAllMetrics}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Refresh Now
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Notifications</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {metrics?.total?.toLocaleString() || 0}
            </p>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-green-600">↑ 12%</span>
              <span className="text-gray-500 ml-2">from last period</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Delivery Rate</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {metrics?.deliveryRate?.toFixed(1) || 0}%
            </p>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${metrics?.deliveryRate || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Active WebSockets</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {wsMetrics?.activeConnections || 0}
            </p>
            <div className="mt-4 text-sm text-gray-500">
              {wsMetrics?.totalConnections || 0} total connections
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Rate Limited</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {rateLimits?.limited || 0}
            </p>
            <div className="mt-4 text-sm text-gray-500">
              {rateLimits?.requests || 0} total requests
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Delivery Status
            </h3>
            <Doughnut data={deliveryChartData} />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              By Channel
            </h3>
            <Bar data={channelChartData} />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              WebSocket Connections
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Creators</span>
                <span className="font-medium">
                  {wsMetrics?.connectionsByUserType?.creator || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Investors</span>
                <span className="font-medium">
                  {wsMetrics?.connectionsByUserType?.investor || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Production</span>
                <span className="font-medium">
                  {wsMetrics?.connectionsByUserType?.production || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Hourly Activity
            </h3>
            <Line data={hourlyChartData} />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Rate Limits by Tier
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Basic</span>
                  <span className="text-sm text-gray-500">
                    {rateLimits?.byTier?.basic?.limited || 0} / {rateLimits?.byTier?.basic?.requests || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ 
                      width: `${
                        ((rateLimits?.byTier?.basic?.requests || 0) - (rateLimits?.byTier?.basic?.limited || 0)) / 
                        (rateLimits?.byTier?.basic?.requests || 1) * 100
                      }%` 
                    }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Premium</span>
                  <span className="text-sm text-gray-500">
                    {rateLimits?.byTier?.premium?.limited || 0} / {rateLimits?.byTier?.premium?.requests || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full"
                    style={{ 
                      width: `${
                        ((rateLimits?.byTier?.premium?.requests || 0) - (rateLimits?.byTier?.premium?.limited || 0)) / 
                        (rateLimits?.byTier?.premium?.requests || 1) * 100
                      }%` 
                    }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Enterprise</span>
                  <span className="text-sm text-gray-500">
                    {rateLimits?.byTier?.enterprise?.limited || 0} / {rateLimits?.byTier?.enterprise?.requests || 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ 
                      width: `${
                        ((rateLimits?.byTier?.enterprise?.requests || 0) - (rateLimits?.byTier?.enterprise?.limited || 0)) / 
                        (rateLimits?.byTier?.enterprise?.requests || 1) * 100
                      }%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* WebSocket Rooms Table */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Active WebSocket Rooms
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Connections
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Messages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {wsMetrics?.rooms?.map((room) => (
                  <tr key={room.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {room.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {room.connections}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {room.messages}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            System Health
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Notification Service</p>
                <p className="text-lg font-medium text-green-800">Operational</p>
              </div>
              <div className="text-green-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">WebSocket Service</p>
                <p className="text-lg font-medium text-green-800">Operational</p>
              </div>
              <div className="text-green-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Rate Limiting</p>
                <p className="text-lg font-medium text-yellow-800">Active</p>
              </div>
              <div className="text-yellow-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};