import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { getWsUrl } from '../config';
import type { 
  IntelligenceUpdate, 
  MarketNewsUpdate, 
  TrendAlert, 
  OpportunityUpdate, 
  CompetitiveChange, 
  EnrichmentComplete 
} from '../types/websocket';

interface UseIntelligenceWebSocketProps {
  onMarketNews?: (news: MarketNewsUpdate) => void;
  onTrendAlert?: (trend: TrendAlert) => void;
  onOpportunityUpdate?: (opportunity: OpportunityUpdate) => void;
  onCompetitiveChange?: (change: CompetitiveChange) => void;
  onEnrichmentComplete?: (enrichment: EnrichmentComplete) => void;
  autoSubscribe?: boolean;
}

interface IntelligenceWebSocketState {
  isConnected: boolean;
  lastUpdate: Date | null;
  updateCount: number;
  errors: string[];
}

export function useIntelligenceWebSocket({
  onMarketNews,
  onTrendAlert,
  onOpportunityUpdate,
  onCompetitiveChange,
  onEnrichmentComplete,
  autoSubscribe = true
}: UseIntelligenceWebSocketProps = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<IntelligenceWebSocketState>({
    isConnected: false,
    lastUpdate: null,
    updateCount: 0,
    errors: []
  });

  const handlersRef = useRef({
    onMarketNews,
    onTrendAlert,
    onOpportunityUpdate,
    onCompetitiveChange,
    onEnrichmentComplete
  });

  // Update refs when handlers change
  useEffect(() => {
    handlersRef.current = {
      onMarketNews,
      onTrendAlert,
      onOpportunityUpdate,
      onCompetitiveChange,
      onEnrichmentComplete
    };
  }, [onMarketNews, onTrendAlert, onOpportunityUpdate, onCompetitiveChange, onEnrichmentComplete]);

  // Intelligence message handler
  const handleIntelligenceMessage = useCallback((message: any) => {
    // Handle different message types from the intelligence WebSocket
    switch (message.type) {
      case 'intelligence_update':
        // Handle real-time intelligence updates
        const update: IntelligenceUpdate = message.data;
        break;
      case 'intelligence_subscribed':
        return;
      case 'intelligence_unsubscribed':
        return;
      case 'intelligence_error':
        console.error('Intelligence WebSocket error:', message.data);
        setState(prev => ({
          ...prev,
          errors: [...prev.errors.slice(-4), message.data.error || 'Unknown intelligence error']
        }));
        return;
      case 'pong':
        // Handle ping/pong for connection health
        return;
      default:
        console.warn('Unknown intelligence message type:', message.type);
        return;
    }

    if (message.type !== 'intelligence_update') return;

    const update: IntelligenceUpdate = message.data;
    
    setState(prev => ({
      ...prev,
      lastUpdate: new Date(),
      updateCount: prev.updateCount + 1
    }));

    try {
      switch (update.type) {
        case 'market_news':
          handlersRef.current.onMarketNews?.(update.data as MarketNewsUpdate);
          break;
        case 'trend_alert':
          handlersRef.current.onTrendAlert?.(update.data as TrendAlert);
          break;
        case 'opportunity_discovered':
          handlersRef.current.onOpportunityUpdate?.(update.data as OpportunityUpdate);
          break;
        case 'competitive_change':
          handlersRef.current.onCompetitiveChange?.(update.data as CompetitiveChange);
          break;
        case 'enrichment_complete':
          handlersRef.current.onEnrichmentComplete?.(update.data as EnrichmentComplete);
          break;
        default:
          console.warn('Unknown intelligence update type:', update.type);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        errors: [...prev.errors.slice(-4), errorMessage] // Keep last 5 errors
      }));
      console.error('Error handling intelligence update:', error);
    }
  }, []);

  // Connect to intelligence WebSocket
  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = getWsUrl();
      const intelligenceWsUrl = `${wsUrl}/ws/intelligence`;
      
      
      const ws = new WebSocket(intelligenceWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setState(prev => ({ ...prev, isConnected: true, errors: [] }));
        
        // Auto-subscribe if enabled
        if (autoSubscribe) {
          setTimeout(() => {
            subscribeToIntelligence();
          }, 100);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleIntelligenceMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setState(prev => ({ ...prev, isConnected: false }));
        wsRef.current = null;
        
        // Attempt to reconnect after a delay
        if (!event.wasClean) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('Intelligence WebSocket error:', error);
        setState(prev => ({
          ...prev,
          errors: [...prev.errors.slice(-4), 'WebSocket connection error']
        }));
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setState(prev => ({
        ...prev,
        errors: [...prev.errors.slice(-4), 'Failed to create WebSocket connection']
      }));
    }
  }, [autoSubscribe]);

  // Send message via WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }
  }, []);

  // Subscribe to intelligence updates
  const subscribeToIntelligence = useCallback((categories?: string[]) => {
    return sendMessage({
      type: 'subscribe_intelligence',
      data: { categories: categories || ['market', 'trends', 'opportunities', 'competitive', 'enrichment'] }
    });
  }, [sendMessage]);

  // Unsubscribe from intelligence updates
  const unsubscribeFromIntelligence = useCallback(() => {
    return sendMessage({
      type: 'unsubscribe_intelligence',
      data: {}
    });
  }, [sendMessage]);

  // Request specific intelligence data
  const requestIntelligenceData = useCallback((type: string, params?: any) => {
    return sendMessage({
      type: 'request_intelligence',
      data: { type, params }
    });
  }, [sendMessage]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: [] }));
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Update connection state
  useEffect(() => {
    setState(prev => ({ ...prev, isConnected }));
  }, [isConnected]);

  return {
    // Connection state
    isConnected: state.isConnected,
    lastUpdate: state.lastUpdate,
    updateCount: state.updateCount,
    errors: state.errors,
    
    // Actions
    subscribeToIntelligence,
    unsubscribeFromIntelligence,
    requestIntelligenceData,
    clearErrors,
    
    // Convenience methods
    requestMarketNews: () => requestIntelligenceData('market_news'),
    requestTrends: () => requestIntelligenceData('trends'),
    requestOpportunities: () => requestIntelligenceData('opportunities'),
    requestCompetitiveAnalysis: () => requestIntelligenceData('competitive_analysis'),
    requestEnrichment: (pitchId: number) => requestIntelligenceData('enrichment', { pitchId })
  };
}