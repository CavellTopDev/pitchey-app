/**
 * Intelligence WebSocket Service
 * Handles real-time intelligence updates via WebSocket connections
 */

import type { Environment } from '../types/environment';
import { intelligenceCacheService } from './intelligence-cache.service';
import { marketIntelligenceService } from './market-intelligence.service';
import { industryEnrichmentService } from './industry-enrichment.service';
import { contentDiscoveryService } from './content-discovery.service';
import { competitiveAnalysisService } from './competitive-analysis.service';

interface WebSocketClient {
  id: string;
  websocket: WebSocket;
  subscriptions: Set<string>;
  lastActivity: Date;
  userId?: number;
}

interface IntelligenceUpdate {
  type: 'market_news' | 'trend_alert' | 'opportunity_discovered' | 'competitive_change' | 'enrichment_complete';
  data: any;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  category?: 'market' | 'trends' | 'opportunities' | 'competitive' | 'enrichment';
}

class IntelligenceWebSocketService {
  private clients: Map<string, WebSocketClient> = new Map();
  private updateQueue: IntelligenceUpdate[] = [];
  private isProcessingQueue = false;

  constructor(private env: Environment) {}

  /**
   * Register a new WebSocket client for intelligence updates
   */
  registerClient(clientId: string, websocket: WebSocket, userId?: number): void {
    const client: WebSocketClient = {
      id: clientId,
      websocket,
      subscriptions: new Set(),
      lastActivity: new Date(),
      userId
    };

    this.clients.set(clientId, client);
    
    console.log(`Intelligence WebSocket client registered: ${clientId}`);

    // Setup WebSocket event handlers
    websocket.addEventListener('message', (event) => {
      this.handleClientMessage(clientId, event.data);
    });

    websocket.addEventListener('close', () => {
      this.removeClient(clientId);
    });

    websocket.addEventListener('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.removeClient(clientId);
    });
  }

  /**
   * Remove a WebSocket client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.websocket.close();
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.clients.delete(clientId);
      console.log(`Intelligence WebSocket client removed: ${clientId}`);
    }
  }

  /**
   * Handle messages from WebSocket clients
   */
  private async handleClientMessage(clientId: string, message: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe_intelligence':
          await this.handleSubscribe(clientId, data.data?.categories || ['market', 'trends', 'opportunities', 'competitive']);
          break;
        case 'unsubscribe_intelligence':
          await this.handleUnsubscribe(clientId);
          break;
        case 'request_intelligence':
          await this.handleIntelligenceRequest(clientId, data.data);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        default:
          console.warn(`Unknown message type from client ${clientId}:`, data.type);
      }
    } catch (error) {
      console.error(`Error handling message from client ${clientId}:`, error);
    }
  }

  /**
   * Subscribe client to intelligence updates
   */
  private async handleSubscribe(clientId: string, categories: string[]): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Add subscriptions
    categories.forEach(category => client.subscriptions.add(category));

    // Send confirmation
    this.sendToClient(clientId, {
      type: 'intelligence_subscribed',
      data: { categories: Array.from(client.subscriptions) },
      timestamp: new Date().toISOString()
    });

    console.log(`Client ${clientId} subscribed to intelligence categories:`, categories);
  }

  /**
   * Unsubscribe client from intelligence updates
   */
  private async handleUnsubscribe(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.clear();

    this.sendToClient(clientId, {
      type: 'intelligence_unsubscribed',
      timestamp: new Date().toISOString()
    });

    console.log(`Client ${clientId} unsubscribed from intelligence updates`);
  }

  /**
   * Handle specific intelligence data requests
   */
  private async handleIntelligenceRequest(clientId: string, requestData: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      let responseData: any = null;

      switch (requestData.type) {
        case 'market_news':
          const marketData = await marketIntelligenceService.gatherMarketIntelligence(this.env);
          responseData = {
            type: 'market_news_response',
            data: marketData.news.slice(0, 5), // Send latest 5 news items
            timestamp: new Date().toISOString()
          };
          break;

        case 'trends':
          const trendsData = await marketIntelligenceService.analyzeTrends(this.env);
          responseData = {
            type: 'trends_response',
            data: trendsData,
            timestamp: new Date().toISOString()
          };
          break;

        case 'opportunities':
          const opportunitiesData = await marketIntelligenceService.identifyOpportunities(this.env);
          responseData = {
            type: 'opportunities_response',
            data: opportunitiesData,
            timestamp: new Date().toISOString()
          };
          break;

        case 'competitive_analysis':
          const competitiveData = await competitiveAnalysisService.analyzeCompetitors(this.env);
          responseData = {
            type: 'competitive_response',
            data: competitiveData,
            timestamp: new Date().toISOString()
          };
          break;

        case 'enrichment':
          if (requestData.params?.pitchId) {
            const enrichmentData = await industryEnrichmentService.enrichPitchData(
              requestData.params.pitchId,
              this.env
            );
            responseData = {
              type: 'enrichment_response',
              data: enrichmentData,
              timestamp: new Date().toISOString()
            };
          }
          break;

        default:
          console.warn(`Unknown intelligence request type: ${requestData.type}`);
          return;
      }

      if (responseData) {
        this.sendToClient(clientId, responseData);
      }
    } catch (error) {
      console.error(`Error handling intelligence request for client ${clientId}:`, error);
      
      this.sendToClient(clientId, {
        type: 'intelligence_error',
        data: { 
          error: 'Failed to fetch intelligence data',
          requestType: requestData.type 
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      if (client.websocket.readyState === WebSocket.OPEN) {
        client.websocket.send(JSON.stringify(message));
        return true;
      } else {
        console.warn(`Cannot send to client ${clientId}: WebSocket not open`);
        this.removeClient(clientId);
        return false;
      }
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Broadcast intelligence update to subscribed clients
   */
  broadcastIntelligenceUpdate(update: IntelligenceUpdate): void {
    let sentCount = 0;
    
    for (const [clientId, client] of this.clients) {
      // Check if client is subscribed to this category
      if (update.category && !client.subscriptions.has(update.category)) {
        continue;
      }

      const success = this.sendToClient(clientId, {
        type: 'intelligence_update',
        data: update,
        timestamp: new Date().toISOString()
      });

      if (success) {
        sentCount++;
      }
    }

    console.log(`Intelligence update broadcasted to ${sentCount} client(s):`, update.type);
  }

  /**
   * Simulate real-time intelligence updates
   */
  async startIntelligenceSimulation(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    // Simulate market news updates every 2-3 minutes
    setInterval(() => {
      if (this.clients.size > 0) {
        this.simulateMarketNewsUpdate();
      }
    }, 2 * 60 * 1000 + Math.random() * 60 * 1000);

    // Simulate trend alerts every 5-10 minutes
    setInterval(() => {
      if (this.clients.size > 0) {
        this.simulateTrendAlert();
      }
    }, 5 * 60 * 1000 + Math.random() * 5 * 60 * 1000);

    // Simulate opportunity discoveries every 10-15 minutes
    setInterval(() => {
      if (this.clients.size > 0) {
        this.simulateOpportunityDiscovery();
      }
    }, 10 * 60 * 1000 + Math.random() * 5 * 60 * 1000);

    // Simulate competitive changes every 15-30 minutes
    setInterval(() => {
      if (this.clients.size > 0) {
        this.simulateCompetitiveChange();
      }
    }, 15 * 60 * 1000 + Math.random() * 15 * 60 * 1000);

    console.log('Intelligence WebSocket simulation started');
  }

  /**
   * Simulate market news update
   */
  private simulateMarketNewsUpdate(): void {
    const newsItems = [
      {
        headline: "Netflix Announces $2B Investment in Original Content",
        summary: "Streaming giant doubles down on exclusive programming with focus on international markets",
        source: "Variety",
        impact: "positive" as const,
        relevanceScore: 85
      },
      {
        headline: "Horror Genre Shows 40% Growth in Q4 Viewership",
        summary: "Horror content continues to dominate streaming platforms with record-breaking engagement",
        source: "The Hollywood Reporter",
        impact: "positive" as const,
        relevanceScore: 78
      },
      {
        headline: "Major Studio Cuts Production Budget by 15%",
        summary: "Economic pressures force reduction in mid-budget film productions across major studios",
        source: "Deadline",
        impact: "negative" as const,
        relevanceScore: 72
      }
    ];

    const randomNews = newsItems[Math.floor(Math.random() * newsItems.length)];
    
    const update: IntelligenceUpdate = {
      type: 'market_news',
      data: {
        id: `news_${Date.now()}`,
        ...randomNews,
        tags: ['streaming', 'investment', 'content'],
        publishedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      priority: 'normal',
      category: 'market'
    };

    this.broadcastIntelligenceUpdate(update);
  }

  /**
   * Simulate trend alert
   */
  private simulateTrendAlert(): void {
    const trends = [
      {
        name: "AI-Generated Content",
        type: "technology",
        direction: "rising" as const,
        strength: 85,
        confidence: 90,
        description: "AI tools are revolutionizing content creation workflows"
      },
      {
        name: "Documentary Series",
        type: "genre",
        direction: "rising" as const,
        strength: 72,
        confidence: 85,
        description: "Long-form documentary content gaining popularity on streaming platforms"
      },
      {
        name: "Traditional TV Advertising",
        type: "demographic",
        direction: "declining" as const,
        strength: 68,
        confidence: 80,
        description: "Shift from traditional advertising to digital and streaming platforms"
      }
    ];

    const randomTrend = trends[Math.floor(Math.random() * trends.length)];
    
    const update: IntelligenceUpdate = {
      type: 'trend_alert',
      data: {
        id: `trend_${Date.now()}`,
        ...randomTrend,
        timeframe: "Next 6 months",
        impact: "Significant impact on content strategy and audience engagement"
      },
      timestamp: new Date().toISOString(),
      priority: 'high',
      category: 'trends'
    };

    this.broadcastIntelligenceUpdate(update);
  }

  /**
   * Simulate opportunity discovery
   */
  private simulateOpportunityDiscovery(): void {
    const opportunities = [
      {
        title: "Underserved Asian-American Horror Market",
        type: "market_gap",
        description: "Growing demand for culturally specific horror content with minimal competition",
        confidence: 82,
        potentialValue: 2500000,
        competitionLevel: "low" as const
      },
      {
        title: "Low-Budget Thriller Sweet Spot",
        type: "budget_sweet_spot",
        description: "Optimal budget range of $500K-$1M showing highest ROI for thriller content",
        confidence: 78,
        potentialValue: 1800000,
        competitionLevel: "medium" as const
      }
    ];

    const randomOpportunity = opportunities[Math.floor(Math.random() * opportunities.length)];
    
    const update: IntelligenceUpdate = {
      type: 'opportunity_discovered',
      data: {
        id: `opportunity_${Date.now()}`,
        ...randomOpportunity,
        timeToAct: "3-6 months",
        requirements: ["Strong script", "Diverse cast", "Experienced director"]
      },
      timestamp: new Date().toISOString(),
      priority: 'high',
      category: 'opportunities'
    };

    this.broadcastIntelligenceUpdate(update);
  }

  /**
   * Simulate competitive change
   */
  private simulateCompetitiveChange(): void {
    const competitors = ['Slated', 'Stage32', 'SeedSpark', 'FilmHub'];
    const changeTypes = ['feature_added', 'pricing_changed', 'strategy_shift'] as const;
    
    const randomCompetitor = competitors[Math.floor(Math.random() * competitors.length)];
    const randomChangeType = changeTypes[Math.floor(Math.random() * changeTypes.length)];
    
    const changes = {
      feature_added: {
        description: `${randomCompetitor} launches AI-powered pitch analytics tool`,
        impact: "medium" as const,
        recommendation: "Consider developing similar analytics capabilities"
      },
      pricing_changed: {
        description: `${randomCompetitor} reduces subscription fees by 20%`,
        impact: "high" as const,
        recommendation: "Review pricing strategy and value proposition"
      },
      strategy_shift: {
        description: `${randomCompetitor} pivots to focus exclusively on documentary content`,
        impact: "low" as const,
        recommendation: "Monitor for potential market segment opportunities"
      }
    };

    const change = changes[randomChangeType];
    
    const update: IntelligenceUpdate = {
      type: 'competitive_change',
      data: {
        competitorId: randomCompetitor.toLowerCase(),
        competitorName: randomCompetitor,
        changeType: randomChangeType,
        ...change,
        actionRequired: change.impact === 'high'
      },
      timestamp: new Date().toISOString(),
      priority: change.impact === 'high' ? 'high' : 'normal',
      category: 'competitive'
    };

    this.broadcastIntelligenceUpdate(update);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Clean up inactive clients
   */
  cleanupInactiveClients(): void {
    const timeout = 10 * 60 * 1000; // 10 minutes
    const now = new Date();
    
    for (const [clientId, client] of this.clients) {
      if (now.getTime() - client.lastActivity.getTime() > timeout) {
        console.log(`Removing inactive client: ${clientId}`);
        this.removeClient(clientId);
      }
    }
  }
}

// Export singleton instance
let intelligenceWebSocketServiceInstance: IntelligenceWebSocketService | null = null;

export function getIntelligenceWebSocketService(env: Environment): IntelligenceWebSocketService {
  if (!intelligenceWebSocketServiceInstance) {
    intelligenceWebSocketServiceInstance = new IntelligenceWebSocketService(env);
  }
  return intelligenceWebSocketServiceInstance;
}

export { IntelligenceWebSocketService };