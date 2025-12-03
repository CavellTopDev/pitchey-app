/**
 * Webhook Endpoint List Component
 * Displays and manages webhook endpoints
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/AlertDialog';
import {
  MoreVertical,
  ExternalLink,
  Edit,
  Trash2,
  Play,
  Pause,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TestTube,
  BarChart3,
} from 'lucide-react';
import { WebhookEditModal } from './WebhookEditModal';
import { WebhookTestModal } from './WebhookTestModal';
import { WebhookDeliveryHistory } from './WebhookDeliveryHistory';
import { webhookService } from '../../services/webhook.service';
import { useToast } from '../../hooks/useToast';
import { formatDistanceToNow } from 'date-fns';

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

interface Props {
  endpoints: WebhookEndpoint[];
  onEndpointUpdated: (endpoint: WebhookEndpoint) => void;
  onEndpointDeleted: (endpointId: number) => void;
}

export const WebhookEndpointList: React.FC<Props> = ({
  endpoints,
  onEndpointUpdated,
  onEndpointDeleted,
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookEndpoint | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDeliveryHistory, setShowDeliveryHistory] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);
  const { toast } = useToast();

  const handleToggleEndpoint = async (endpoint: WebhookEndpoint) => {
    try {
      setLoading(endpoint.id);
      
      const response = await webhookService.toggleEndpoint(
        endpoint.id,
        !endpoint.is_active
      );
      
      if (response.success) {
        onEndpointUpdated({
          ...endpoint,
          is_active: !endpoint.is_active,
        });
        
        toast({
          title: 'Success',
          description: `Endpoint ${!endpoint.is_active ? 'activated' : 'deactivated'} successfully`,
          variant: 'default',
        });
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to toggle endpoint:', error);
      toast({
        title: 'Error',
        description: 'Failed to update endpoint status',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteEndpoint = async () => {
    if (!selectedEndpoint) return;

    try {
      const response = await webhookService.deleteEndpoint(selectedEndpoint.id);
      
      if (response.success) {
        onEndpointDeleted(selectedEndpoint.id);
        setShowDeleteDialog(false);
        setSelectedEndpoint(null);
        
        toast({
          title: 'Success',
          description: 'Endpoint deleted successfully',
          variant: 'default',
        });
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to delete endpoint:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete endpoint',
        variant: 'destructive',
      });
    }
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'destructive';
      default: return 'secondary';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4" />;
      case 'unhealthy': return <XCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatEventTypes = (eventTypes: string[]) => {
    if (eventTypes.length <= 3) {
      return eventTypes.join(', ');
    }
    return `${eventTypes.slice(0, 3).join(', ')} +${eventTypes.length - 3} more`;
  };

  const calculateSuccessRate = (stats: any) => {
    if (stats.total_deliveries === 0) return 0;
    return ((stats.successful_deliveries / stats.total_deliveries) * 100).toFixed(1);
  };

  return (
    <div className="space-y-4">
      {endpoints.map((endpoint) => (
        <Card key={endpoint.id}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {endpoint.name}
                  </h3>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={endpoint.is_active ? 'success' : 'secondary'}>
                      {endpoint.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    
                    <Badge variant={getHealthBadgeVariant(endpoint.health_status)}>
                      <div className="flex items-center gap-1">
                        {getHealthIcon(endpoint.health_status)}
                        <span className="capitalize">{endpoint.health_status}</span>
                      </div>
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                  <ExternalLink className="w-4 h-4" />
                  <span className="truncate">{endpoint.url}</span>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Event Types:</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatEventTypes(endpoint.event_types)}
                  </p>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total Deliveries</p>
                    <p className="font-semibold text-gray-900">
                      {endpoint.statistics?.total_deliveries || 0}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600">Success Rate</p>
                    <p className="font-semibold text-gray-900">
                      {calculateSuccessRate(endpoint.statistics)}%
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600">Avg Response</p>
                    <p className="font-semibold text-gray-900">
                      {endpoint.statistics?.average_response_time || 0}ms
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-600">Uptime</p>
                    <p className="font-semibold text-gray-900">
                      {endpoint.statistics?.uptime_percentage || 0}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      Created {formatDistanceToNow(new Date(endpoint.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {endpoint.updated_at !== endpoint.created_at && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        Updated {formatDistanceToNow(new Date(endpoint.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleEndpoint(endpoint)}
                  disabled={loading === endpoint.id}
                  className="flex items-center gap-1"
                >
                  {loading === endpoint.id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600" />
                  ) : endpoint.is_active ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  {endpoint.is_active ? 'Pause' : 'Activate'}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedEndpoint(endpoint);
                        setShowEditModal(true);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Endpoint
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedEndpoint(endpoint);
                        setShowTestModal(true);
                      }}
                    >
                      <TestTube className="w-4 h-4 mr-2" />
                      Test Endpoint
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedEndpoint(endpoint);
                        setShowDeliveryHistory(true);
                      }}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      View Analytics
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedEndpoint(endpoint);
                        setShowDeleteDialog(true);
                      }}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Endpoint
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Edit Modal */}
      {selectedEndpoint && (
        <WebhookEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEndpoint(null);
          }}
          endpoint={selectedEndpoint}
          onEndpointUpdated={(updated) => {
            onEndpointUpdated(updated);
            setShowEditModal(false);
            setSelectedEndpoint(null);
          }}
        />
      )}

      {/* Test Modal */}
      {selectedEndpoint && (
        <WebhookTestModal
          isOpen={showTestModal}
          onClose={() => {
            setShowTestModal(false);
            setSelectedEndpoint(null);
          }}
          endpoint={selectedEndpoint}
        />
      )}

      {/* Delivery History Modal */}
      {selectedEndpoint && (
        <WebhookDeliveryHistory
          isOpen={showDeliveryHistory}
          onClose={() => {
            setShowDeliveryHistory(false);
            setSelectedEndpoint(null);
          }}
          endpoint={selectedEndpoint}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook Endpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the webhook endpoint "{selectedEndpoint?.name}"?
              This action cannot be undone and will stop all webhook deliveries to this endpoint.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEndpoint(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEndpoint}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Endpoint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};