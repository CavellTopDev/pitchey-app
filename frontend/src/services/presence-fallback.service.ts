/**
 * Fallback Presence Service
 * Provides presence detection using HTTP polling when WebSocket is unavailable
 */

import { config } from '../config';

interface PresenceData {
  userId: number;
  username: string;
  status: 'online' | 'away' | 'offline' | 'dnd';
  lastSeen: Date;
  activity?: string;
}

interface PresenceUpdateData {
  status: 'online' | 'away' | 'offline' | 'dnd';
  activity?: string;
}

class PresenceFallbackService {
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 30000; // Poll every 30 seconds
  private readonly HEARTBEAT_INTERVAL = 60000; // Send heartbeat every 60 seconds
  private isPolling = false;
  private subscribers: ((users: PresenceData[]) => void)[] = [];
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private currentStatus: 'online' | 'away' | 'offline' | 'dnd' = 'offline';
  private currentActivity?: string;

  /**
   * Start presence polling and heartbeat
   */
  start(): void {
    if (this.isPolling) {
      console.log('Presence fallback service already running');
      return;
    }

    console.log('Starting presence fallback service with HTTP polling');
    this.isPolling = true;
    this.currentStatus = 'online';

    // Start polling for presence updates
    this.pollInterval = setInterval(() => {
      this.fetchPresence();
    }, this.POLL_INTERVAL);

    // Start heartbeat to maintain presence
    this.startHeartbeat();

    // Initial fetch
    this.fetchPresence();
  }

  /**
   * Stop presence polling and heartbeat
   */
  stop(): void {
    console.log('Stopping presence fallback service');
    this.isPolling = false;
    this.currentStatus = 'offline';

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    // Send offline status before stopping
    this.updatePresence({ status: 'offline' });
  }

  /**
   * Update user presence status
   */
  async updatePresence(data: PresenceUpdateData): Promise<boolean> {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.warn('No auth token available for presence update');
        return false;
      }

    const response = await fetch(`${config.API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error(`Presence update failed: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        this.currentStatus = data.status;
        this.currentActivity = data.activity;
        console.log('Presence updated successfully:', data);
        return true;
      } else {
        console.warn('Presence update failed:', result.message);
        return false;
      }
    } catch (error) {
      console.error('Error updating presence:', error);
      return false;
    }
  }

  /**
   * Fetch current online users
   */
  async fetchPresence(): Promise<PresenceData[]> {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        // Not authenticated, return empty list
        return [];
      }

    const response = await fetch(`${config.API_URL}/api/endpoint`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error(`Presence fetch failed: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        const users = (result.data.users || []).map((user: any) => ({
          ...user,
          lastSeen: new Date(user.lastSeen),
        }));

        // Notify subscribers
        this.subscribers.forEach(callback => {
          try {
            callback(users);
          } catch (error) {
            console.error('Error in presence subscriber:', error);
          }
        });

        return users;
      } else {
        console.warn('Invalid presence response:', result);
        return [];
      }
    } catch (error) {
      console.error('Error fetching presence:', error);
      return [];
    }
  }

  /**
   * Subscribe to presence updates
   */
  subscribe(callback: (users: PresenceData[]) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Start heartbeat to maintain online status
   */
  private startHeartbeat(): void {
    const sendHeartbeat = async () => {
      if (this.isPolling && this.currentStatus !== 'offline') {
        await this.updatePresence({ 
          status: this.currentStatus, 
          activity: this.currentActivity 
        });
      }

      // Schedule next heartbeat
      this.heartbeatTimeout = setTimeout(sendHeartbeat, this.HEARTBEAT_INTERVAL);
    };

    sendHeartbeat();
  }

  /**
   * Get current status
   */
  getCurrentStatus(): { status: string; activity?: string } {
    return {
      status: this.currentStatus,
      activity: this.currentActivity,
    };
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.isPolling;
  }

  /**
   * Test WebSocket availability
   */
  async testWebSocketAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        return { available: false, error: 'Not authenticated' };
      }

    const response = await fetch(`${config.API_URL}/api/endpoint`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error(`WebSocket test failed: ${response.status}`);
      }

      const result = await response.json();
      return {
        available: result.websocketAvailable === true,
        error: result.websocketAvailable ? undefined : result.error,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const presenceFallbackService = new PresenceFallbackService();

export default presenceFallbackService;