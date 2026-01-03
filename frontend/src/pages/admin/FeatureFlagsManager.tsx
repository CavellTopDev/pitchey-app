/**
import { API_URL } from '../config';
 * Feature Flags Manager Component
 * Admin interface for managing feature flags with real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { 
  Flag,
  Download,
  Upload,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Users,
  Percent,
  ToggleLeft,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Target,
  Zap
} from 'lucide-react';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  strategy: 'boolean' | 'percentage' | 'user_list' | 'ab_test' | 'gradual_rollout';
  value?: any;
  percentage?: number;
  userIds?: string[];
  segments?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface FlagAnalytics {
  evaluations: {
    enabled: number;
    disabled: number;
    total: number;
  };
  trend: Array<{
    date: string;
    enabled: number;
    disabled: number;
  }>;
  performance: {
    avgEvaluationTime: number;
    p95EvaluationTime: number;
  };
}

const FeatureFlagsManager: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [analytics, setAnalytics] = useState<FlagAnalytics | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStrategy, setFilterStrategy] = useState<string>('all');
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Form state for creating/editing flags
  const [formData, setFormData] = useState({
    key: '',
    enabled: false,
    description: '',
    strategy: 'boolean' as FeatureFlag['strategy'],
    percentage: 0,
    userIds: '',
    segments: ''
  });

  // Fetch all feature flags
  const fetchFlags = useCallback(async () => {
    try {
    const response = await fetch(`${API_URL}/api/admin`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to fetch flags');
      
      const data = await response.json();
      setFlags(data);
    } catch (error) {
      console.error('Error fetching flags:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch feature flags',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Setup WebSocket for real-time updates
  useEffect(() => {
    const websocket = new WebSocket(`wss://${window.location.host}/api/feature-flags/ws`);
    
    websocket.onopen = () => {
      websocket.send(JSON.stringify({ type: 'subscribe' }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'flag_updated') {
        fetchFlags(); // Refresh flags on update
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [fetchFlags]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  // Create new feature flag
  const createFlag = async () => {
    try {
      const payload = {
        ...formData,
        userIds: formData.userIds ? formData.userIds.split(',').map(s => s.trim()) : undefined,
        segments: formData.segments ? formData.segments.split(',').map(s => s.trim()) : undefined
      };

    const response = await fetch(`${API_URL}/api/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to create flag');

      toast({
        title: 'Success',
        description: 'Feature flag created successfully'
      });

      setShowCreateDialog(false);
      fetchFlags();
      resetForm();
    } catch (error) {
      console.error('Error creating flag:', error);
      toast({
        title: 'Error',
        description: 'Failed to create feature flag',
        variant: 'destructive'
      });
    }
  };

  // Update existing feature flag
  const updateFlag = async () => {
    if (!selectedFlag) return;

    try {
      const payload = {
        ...formData,
        userIds: formData.userIds ? formData.userIds.split(',').map(s => s.trim()) : undefined,
        segments: formData.segments ? formData.segments.split(',').map(s => s.trim()) : undefined
      };

    const response = await fetch(`${API_URL}/api/admin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to update flag');

      toast({
        title: 'Success',
        description: 'Feature flag updated successfully'
      });

      setShowEditDialog(false);
      fetchFlags();
      resetForm();
    } catch (error) {
      console.error('Error updating flag:', error);
      toast({
        title: 'Error',
        description: 'Failed to update feature flag',
        variant: 'destructive'
      });
    }
  };

  // Delete feature flag
  const deleteFlag = async (key: string) => {
    if (!confirm(`Are you sure you want to delete the feature flag "${key}"?`)) return;

    try {
    const response = await fetch(`${API_URL}/api/admin`, {
      method: 'DELETE',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to delete flag');

      toast({
        title: 'Success',
        description: 'Feature flag deleted successfully'
      });

      fetchFlags();
    } catch (error) {
      console.error('Error deleting flag:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete feature flag',
        variant: 'destructive'
      });
    }
  };

  // Toggle flag enabled status
  const toggleFlag = async (flag: FeatureFlag) => {
    try {
    const response = await fetch(`${API_URL}/api/admin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !flag.enabled }),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to toggle flag');

      toast({
        title: 'Success',
        description: `Feature flag ${!flag.enabled ? 'enabled' : 'disabled'}`
      });

      fetchFlags();
    } catch (error) {
      console.error('Error toggling flag:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle feature flag',
        variant: 'destructive'
      });
    }
  };

  // Fetch flag analytics
  const fetchAnalytics = async (key: string) => {
    try {
    const response = await fetch(`${API_URL}/api/admin`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const data = await response.json();
      setAnalytics(data);
      setShowAnalyticsDialog(true);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch analytics',
        variant: 'destructive'
      });
    }
  };

  // Export feature flags
  const exportFlags = async () => {
    try {
    const response = await fetch(`${API_URL}/api/admin`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to export flags');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'feature-flags.json';
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Feature flags exported successfully'
      });
    } catch (error) {
      console.error('Error exporting flags:', error);
      toast({
        title: 'Error',
        description: 'Failed to export feature flags',
        variant: 'destructive'
      });
    }
  };

  // Import feature flags
  const importFlags = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      
    const response = await fetch(`${API_URL}/api/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: content
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to import flags');

      toast({
        title: 'Success',
        description: 'Feature flags imported successfully'
      });

      fetchFlags();
    } catch (error) {
      console.error('Error importing flags:', error);
      toast({
        title: 'Error',
        description: 'Failed to import feature flags',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      key: '',
      enabled: false,
      description: '',
      strategy: 'boolean',
      percentage: 0,
      userIds: '',
      segments: ''
    });
    setSelectedFlag(null);
  };

  const getStrategyIcon = (strategy: FeatureFlag['strategy']) => {
    switch (strategy) {
      case 'boolean': return <ToggleLeft className="w-4 h-4" />;
      case 'percentage': return <Percent className="w-4 h-4" />;
      case 'user_list': return <Users className="w-4 h-4" />;
      case 'ab_test': return <Target className="w-4 h-4" />;
      case 'gradual_rollout': return <TrendingUp className="w-4 h-4" />;
      default: return <Flag className="w-4 h-4" />;
    }
  };

  const getStrategyColor = (strategy: FeatureFlag['strategy']) => {
    switch (strategy) {
      case 'boolean': return 'bg-blue-500';
      case 'percentage': return 'bg-purple-500';
      case 'user_list': return 'bg-green-500';
      case 'ab_test': return 'bg-orange-500';
      case 'gradual_rollout': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  // Filter flags based on search and strategy
  const filteredFlags = flags.filter(flag => {
    const matchesSearch = flag.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         flag.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStrategy = filterStrategy === 'all' || flag.strategy === filterStrategy;
    return matchesSearch && matchesStrategy;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="w-8 h-8 text-yellow-500" />
            Feature Flags Manager
          </h1>
          <p className="text-gray-600 mt-2">
            Control feature rollouts with confidence
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportFlags}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
          
          <label htmlFor="import-file">
            <Button
              variant="outline"
              as="span"
              className="flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Import
            </Button>
            <input
              id="import-file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={importFlags}
            />
          </label>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Flag
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Feature Flag</DialogTitle>
                <DialogDescription>
                  Define a new feature flag with rollout strategy
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="key">Flag Key</Label>
                  <Input
                    id="key"
                    value={formData.key}
                    onChange={(e) => setFormData({...formData, key: e.target.value})}
                    placeholder="e.g., new_dashboard_ui"
                    pattern="^[a-z0-9_]+$"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Brief description of the feature"
                  />
                </div>

                <div>
                  <Label htmlFor="strategy">Rollout Strategy</Label>
                  <Select
                    value={formData.strategy}
                    onValueChange={(value) => setFormData({...formData, strategy: value as FeatureFlag['strategy']})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boolean">Boolean (On/Off)</SelectItem>
                      <SelectItem value="percentage">Percentage Rollout</SelectItem>
                      <SelectItem value="user_list">User List</SelectItem>
                      <SelectItem value="ab_test">A/B Test</SelectItem>
                      <SelectItem value="gradual_rollout">Gradual Rollout</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.strategy === 'percentage' || formData.strategy === 'gradual_rollout') && (
                  <div>
                    <Label htmlFor="percentage">Percentage</Label>
                    <Input
                      id="percentage"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.percentage}
                      onChange={(e) => setFormData({...formData, percentage: parseInt(e.target.value)})}
                    />
                  </div>
                )}

                {formData.strategy === 'user_list' && (
                  <div>
                    <Label htmlFor="userIds">User IDs (comma-separated)</Label>
                    <Input
                      id="userIds"
                      value={formData.userIds}
                      onChange={(e) => setFormData({...formData, userIds: e.target.value})}
                      placeholder="user1,user2,user3"
                    />
                  </div>
                )}

                {formData.strategy === 'ab_test' && (
                  <div>
                    <Label htmlFor="segments">Segments (comma-separated)</Label>
                    <Input
                      id="segments"
                      value={formData.segments}
                      onChange={(e) => setFormData({...formData, segments: e.target.value})}
                      placeholder="group_a,group_b"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({...formData, enabled: checked})}
                  />
                  <Label htmlFor="enabled">Enable immediately</Label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createFlag}>Create Flag</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search flags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={filterStrategy} onValueChange={setFilterStrategy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Strategies</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="user_list">User List</SelectItem>
                <SelectItem value="ab_test">A/B Test</SelectItem>
                <SelectItem value="gradual_rollout">Gradual Rollout</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Feature Flags</CardTitle>
          <CardDescription>
            {filteredFlags.length} flag{filteredFlags.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Flag Key</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlags.map((flag) => (
                <TableRow key={flag.key}>
                  <TableCell>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => toggleFlag(flag)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {flag.key}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {flag.description}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getStrategyColor(flag.strategy)} text-white`}>
                      <span className="flex items-center gap-1">
                        {getStrategyIcon(flag.strategy)}
                        {flag.strategy.replace('_', ' ')}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {flag.strategy === 'percentage' && `${flag.percentage}%`}
                    {flag.strategy === 'gradual_rollout' && `${flag.percentage}%`}
                    {flag.strategy === 'user_list' && `${flag.userIds?.length || 0} users`}
                    {flag.strategy === 'ab_test' && `${flag.segments?.length || 0} segments`}
                    {flag.strategy === 'boolean' && '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(flag.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fetchAnalytics(flag.key)}
                      >
                        <Activity className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedFlag(flag);
                          setFormData({
                            key: flag.key,
                            enabled: flag.enabled,
                            description: flag.description,
                            strategy: flag.strategy,
                            percentage: flag.percentage || 0,
                            userIds: flag.userIds?.join(',') || '',
                            segments: flag.segments?.join(',') || ''
                          });
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteFlag(flag.key)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Feature Flag</DialogTitle>
            <DialogDescription>
              Update feature flag configuration
            </DialogDescription>
          </DialogHeader>
          
          {/* Same form as create dialog */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="edit-strategy">Rollout Strategy</Label>
              <Select
                value={formData.strategy}
                onValueChange={(value) => setFormData({...formData, strategy: value as FeatureFlag['strategy']})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">Boolean (On/Off)</SelectItem>
                  <SelectItem value="percentage">Percentage Rollout</SelectItem>
                  <SelectItem value="user_list">User List</SelectItem>
                  <SelectItem value="ab_test">A/B Test</SelectItem>
                  <SelectItem value="gradual_rollout">Gradual Rollout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.strategy === 'percentage' || formData.strategy === 'gradual_rollout') && (
              <div>
                <Label htmlFor="edit-percentage">Percentage</Label>
                <Input
                  id="edit-percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.percentage}
                  onChange={(e) => setFormData({...formData, percentage: parseInt(e.target.value)})}
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({...formData, enabled: checked})}
              />
              <Label htmlFor="edit-enabled">Enabled</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={updateFlag}>Update Flag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeatureFlagsManager;