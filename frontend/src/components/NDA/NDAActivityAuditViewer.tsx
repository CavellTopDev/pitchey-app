/**
 * NDA Activity Audit Viewer Component
 * Displays comprehensive audit trail for NDA activities with filtering and export capabilities
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Calendar, Filter, Download, Eye, Search, AlertTriangle, Shield, User, Clock } from 'lucide-react';
import { useNDAService } from '../../hooks/useNDAService';

// Audit log interfaces
interface AuditLogEntry {
  id: number;
  userId?: number;
  eventType: string;
  eventCategory: 'nda' | 'security' | 'auth' | 'admin' | 'data';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  entityType?: string;
  entityId?: number;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  location?: {
    country?: string;
    city?: string;
    region?: string;
  };
  changes?: Array<{
    field: string;
    oldValue?: any;
    newValue?: any;
  }>;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface AuditLogResponse {
  logs: AuditLogEntry[];
  totalCount: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}

interface AuditStatistics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsByRisk: Record<string, number>;
  topUsers: Array<{ userId: number; eventCount: number }>;
  recentHighRiskEvents: AuditLogEntry[];
}

interface NDAActivityAuditViewerProps {
  userId?: number;
  userRole?: string;
  entityType?: string;
  entityId?: number;
  className?: string;
}

export default function NDAActivityAuditViewer({
  userId,
  userRole,
  entityType,
  entityId,
  className = ''
}: NDAActivityAuditViewerProps) {
  // State for audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    eventTypes: [] as string[],
    eventCategories: [] as string[],
    riskLevels: [] as string[],
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
    limit: 50,
    offset: 0
  });

  // View state
  const [viewMode, setViewMode] = useState<'logs' | 'statistics'>('logs');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const ndaService = useNDAService();

  // Event type options for filtering
  const eventTypeOptions = [
    'nda_request_created', 'nda_request_approved', 'nda_request_rejected',
    'nda_signed', 'nda_revoked', 'nda_expired',
    'nda_template_created', 'nda_template_updated', 'nda_template_deleted',
    'nda_bulk_action', 'nda_export', 'nda_document_accessed'
  ];

  const riskLevelOptions = ['low', 'medium', 'high', 'critical'];
  const categoryOptions = ['nda', 'security', 'auth', 'admin', 'data'];

  // Load audit logs
  const loadAuditLogs = async () => {
    if (!ndaService) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: filters.limit.toString(),
        offset: filters.offset.toString()
      });

      if (userId) params.append('userId', userId.toString());
      if (filters.eventTypes.length > 0) params.append('eventTypes', filters.eventTypes.join(','));
      if (filters.eventCategories.length > 0) params.append('eventCategories', filters.eventCategories.join(','));
      if (filters.riskLevels.length > 0) params.append('riskLevels', filters.riskLevels.join(','));
      if (entityType) params.append('entityType', entityType);
      if (entityId) params.append('entityId', entityId.toString());
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await fetch(`/api/audit/logs?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to load audit logs');
      }

      const data: { success: boolean; data: AuditLogResponse } = await response.json();
      
      if (data.success) {
        setAuditLogs(data.data.logs);
        setTotalCount(data.data.totalCount);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load audit statistics
  const loadStatistics = async () => {
    if (!ndaService || userRole !== 'admin') return;

    try {
      const response = await fetch('/api/audit/statistics?timeframe=30d', {
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to load audit statistics');
      }

      const data: { success: boolean; data: AuditStatistics } = await response.json();
      
      if (data.success) {
        setStatistics(data.data);
      }
    } catch (error) {
      console.error('Error loading audit statistics:', error);
    }
  };

  // Export audit logs
  const exportAuditLogs = async () => {
    if (!ndaService || userRole !== 'admin') return;

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId.toString());
      if (filters.eventTypes.length > 0) params.append('eventTypes', filters.eventTypes.join(','));
      if (filters.eventCategories.length > 0) params.append('eventCategories', filters.eventCategories.join(','));
      if (filters.riskLevels.length > 0) params.append('riskLevels', filters.riskLevels.join(','));
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await fetch(`/api/audit/logs/export?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      // Download the CSV file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
    }
  };

  // Filter audit logs based on search term
  const filteredLogs = useMemo(() => {
    if (!filters.searchTerm.trim()) return auditLogs;
    
    const searchLower = filters.searchTerm.toLowerCase();
    return auditLogs.filter(log => 
      log.description.toLowerCase().includes(searchLower) ||
      log.eventType.toLowerCase().includes(searchLower) ||
      log.ipAddress?.toLowerCase().includes(searchLower) ||
      (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchLower))
    );
  }, [auditLogs, filters.searchTerm]);

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get risk level badge color
  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-red-400 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // Get risk level icon
  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <Shield className="h-4 w-4" />;
      case 'low':
      default:
        return <User className="h-4 w-4" />;
    }
  };

  // Toggle log expansion
  const toggleLogExpansion = (logId: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // Load data on mount and filter changes
  useEffect(() => {
    loadAuditLogs();
    if (viewMode === 'statistics') {
      loadStatistics();
    }
  }, [filters, viewMode]);

  if (!ndaService) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-gray-500">
          NDA service not available
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">NDA Activity Audit Trail</h2>
          <p className="text-gray-600">Comprehensive audit trail for all NDA-related activities</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'logs' ? 'default' : 'outline'}
            onClick={() => setViewMode('logs')}
          >
            <Eye className="h-4 w-4 mr-2" />
            Audit Logs
          </Button>
          {userRole === 'admin' && (
            <Button
              variant={viewMode === 'statistics' ? 'default' : 'outline'}
              onClick={() => setViewMode('statistics')}
            >
              <Shield className="h-4 w-4 mr-2" />
              Statistics
            </Button>
          )}
          {userRole === 'admin' && (
            <Button onClick={exportAuditLogs} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {viewMode === 'logs' && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search logs..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Risk Level</label>
              <Select
                value={filters.riskLevels[0] || ''}
                onValueChange={(value) => setFilters(prev => ({
                  ...prev,
                  riskLevels: value ? [value] : []
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All risk levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All risk levels</SelectItem>
                  {riskLevelOptions.map(level => (
                    <SelectItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Select
                value={filters.eventCategories[0] || ''}
                onValueChange={(value) => setFilters(prev => ({
                  ...prev,
                  eventCategories: value ? [value] : []
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categoryOptions.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">From Date</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">To Date</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => setFilters({
                  eventTypes: [],
                  eventCategories: [],
                  riskLevels: [],
                  dateFrom: '',
                  dateTo: '',
                  searchTerm: '',
                  limit: 50,
                  offset: 0
                })}
                variant="outline"
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Content */}
      {viewMode === 'logs' ? (
        <Card className="p-6">
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex justify-between items-center border-b pb-4">
              <div className="text-sm text-gray-600">
                Showing {filteredLogs.length} of {totalCount} audit logs
              </div>
              {loading && (
                <div className="text-sm text-blue-600">Loading...</div>
              )}
            </div>

            {/* Audit Logs */}
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={getRiskBadgeColor(log.riskLevel)}>
                          {getRiskIcon(log.riskLevel)}
                          <span className="ml-1">{log.riskLevel.toUpperCase()}</span>
                        </Badge>
                        <Badge variant="outline">
                          {log.eventCategory.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {log.eventType.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>

                      <p className="text-sm mb-2">{log.description}</p>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {log.userId && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            User ID: {log.userId}
                          </span>
                        )}
                        {log.ipAddress && (
                          <span>IP: {log.ipAddress}</span>
                        )}
                        {log.entityType && log.entityId && (
                          <span>{log.entityType.toUpperCase()} ID: {log.entityId}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLogExpansion(log.id)}
                    >
                      {expandedLogs.has(log.id) ? 'Less' : 'More'}
                    </Button>
                  </div>

                  {/* Expanded details */}
                  {expandedLogs.has(log.id) && (
                    <div className="mt-4 pt-4 border-t bg-gray-50 rounded p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {log.sessionId && (
                          <div>
                            <strong>Session ID:</strong> {log.sessionId}
                          </div>
                        )}
                        {log.userAgent && (
                          <div>
                            <strong>User Agent:</strong> {log.userAgent}
                          </div>
                        )}
                        {log.location && (
                          <div>
                            <strong>Location:</strong> {`${log.location.city || ''}, ${log.location.region || ''}, ${log.location.country || ''}`}
                          </div>
                        )}
                        {log.changes && log.changes.length > 0 && (
                          <div className="md:col-span-2">
                            <strong>Changes:</strong>
                            <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto">
                              {JSON.stringify(log.changes, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="md:col-span-2">
                            <strong>Metadata:</strong>
                            <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filteredLogs.length === 0 && !loading && (
                <div className="text-center text-gray-500 py-8">
                  No audit logs found matching the current filters.
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalCount > filters.limit && (
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Page {Math.floor(filters.offset / filters.limit) + 1} of {Math.ceil(totalCount / filters.limit)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.offset === 0}
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      offset: Math.max(0, prev.offset - prev.limit)
                    }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.offset + filters.limit >= totalCount}
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      offset: prev.offset + prev.limit
                    }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
        /* Statistics View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statistics && (
            <>
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Overview</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Events:</span>
                    <span className="font-semibold">{statistics.totalEvents}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Events by Category</h3>
                <div className="space-y-2">
                  {Object.entries(statistics.eventsByCategory).map(([category, count]) => (
                    <div key={category} className="flex justify-between">
                      <span className="capitalize">{category}:</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Events by Risk Level</h3>
                <div className="space-y-2">
                  {Object.entries(statistics.eventsByRisk).map(([risk, count]) => (
                    <div key={risk} className="flex justify-between">
                      <Badge className={getRiskBadgeColor(risk)}>
                        {risk.charAt(0).toUpperCase() + risk.slice(1)}
                      </Badge>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {statistics.recentHighRiskEvents.length > 0 && (
                <Card className="p-6 md:col-span-2 lg:col-span-3">
                  <h3 className="text-lg font-semibold mb-4">Recent High-Risk Events</h3>
                  <div className="space-y-2">
                    {statistics.recentHighRiskEvents.slice(0, 10).map((event) => (
                      <div key={event.id} className="flex justify-between items-center p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge className={getRiskBadgeColor(event.riskLevel)}>
                            {event.riskLevel.toUpperCase()}
                          </Badge>
                          <span className="text-sm">{event.description}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}