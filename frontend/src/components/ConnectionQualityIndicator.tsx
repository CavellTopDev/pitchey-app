import React from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import type { ConnectionQuality } from '../types/websocket';

interface ConnectionQualityIndicatorProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export function ConnectionQualityIndicator({
  className = '',
  showDetails = false,
  compact = false
}: ConnectionQualityIndicatorProps) {
  const { 
    connectionStatus, 
    connectionQuality, 
    isConnected, 
    isReconnecting,
    retryCount,
    manualReconnect 
  } = useWebSocket();

  const getQualityColor = (strength: ConnectionQuality['strength']) => {
    switch (strength) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-blue-500';
      case 'fair':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getQualityIcon = (strength: ConnectionQuality['strength']) => {
    switch (strength) {
      case 'excellent':
        return '📶'; // Full signal
      case 'good':
        return '📶'; // Good signal
      case 'fair':
        return '📊'; // Medium signal
      case 'poor':
        return '📵'; // Poor signal
      default:
        return '❌'; // No signal
    }
  };

  const getStatusText = () => {
    if (!isConnected) {
      if (isReconnecting) {
        return `Reconnecting... (${retryCount}/10)`;
      }
      return 'Disconnected';
    }
    
    if (connectionQuality.strength === 'excellent') {
      return 'Excellent connection';
    } else if (connectionQuality.strength === 'good') {
      return 'Good connection';
    } else if (connectionQuality.strength === 'fair') {
      return 'Fair connection';
    } else {
      return 'Poor connection';
    }
  };

  const formatLatency = (latency: number | null) => {
    if (latency === null) return 'N/A';
    return `${Math.round(latency)}ms`;
  };

  const formatSuccessRate = (rate: number) => {
    return `${Math.round(rate)}%`;
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="text-sm">
          {getQualityIcon(connectionQuality.strength)}
        </span>
        <span className={`text-xs ${getQualityColor(connectionQuality.strength)}`}>
          {connectionQuality.strength}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        <span className="text-lg">
          {getQualityIcon(connectionQuality.strength)}
        </span>
        <span className={`text-sm font-medium ${getQualityColor(connectionQuality.strength)}`}>
          {getStatusText()}
        </span>
      </div>
      
      {showDetails && (
        <div className="text-xs text-gray-500 ml-2">
          <div>Latency: {formatLatency(connectionQuality.latency)}</div>
          <div>Success: {formatSuccessRate(connectionQuality.successRate)}</div>
          {connectionQuality.consecutiveFailures > 0 && (
            <div className="text-red-500">
              Failures: {connectionQuality.consecutiveFailures}
            </div>
          )}
        </div>
      )}
      
      {!isConnected && !isReconnecting && (
        <button
          onClick={manualReconnect}
          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}

interface ConnectionStatusBannerProps {
  className?: string;
}

export function ConnectionStatusBanner({ className = '' }: ConnectionStatusBannerProps) {
  const { 
    connectionStatus,
    connectionQuality, 
    isConnected, 
    isReconnecting,
    retryCount,
    manualReconnect 
  } = useWebSocket();

  // Only show banner for poor connections or disconnected state
  if (isConnected && connectionQuality.strength !== 'poor') {
    return null;
  }

  return (
    <div className={`bg-yellow-50 border-l-4 border-yellow-400 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-xl">⚠️</span>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-800">
              {!isConnected ? (
                isReconnecting ? (
                  <>
                    Connection lost. Attempting to reconnect... 
                    <span className="font-medium">({retryCount}/10)</span>
                  </>
                ) : (
                  'Connection lost. Real-time features are disabled.'
                )
              ) : (
                'Poor connection quality detected. Some features may be slow.'
              )}
            </p>
            {connectionStatus.error && (
              <p className="text-xs text-yellow-700 mt-1">
                {connectionStatus.error}
              </p>
            )}
          </div>
        </div>
        
        {!isConnected && !isReconnecting && (
          <div className="flex-shrink-0">
            <button
              onClick={manualReconnect}
              className="bg-yellow-500 text-white text-xs px-3 py-1 rounded hover:bg-yellow-600 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConnectionQualityIndicator;