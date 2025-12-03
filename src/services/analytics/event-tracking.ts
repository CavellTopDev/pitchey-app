import { v4 as uuidv4 } from 'uuid';

// Enum for event categories
export enum EventCategory {
  USER_INTERACTION = 'user_interaction',
  PITCH_LIFECYCLE = 'pitch_lifecycle',
  NDA_WORKFLOW = 'nda_workflow',
  INVESTMENT = 'investment',
  AUTHENTICATION = 'authentication'
}

// Enum for event types within categories
export enum EventType {
  // User Interaction
  PAGE_VIEW = 'page_view',
  BUTTON_CLICK = 'button_click',
  FORM_INTERACTION = 'form_interaction',

  // Pitch Lifecycle
  PITCH_CREATED = 'pitch_created',
  PITCH_VIEWED = 'pitch_viewed',
  PITCH_EDITED = 'pitch_edited',
  PITCH_SHARED = 'pitch_shared',

  // NDA Workflow
  NDA_REQUESTED = 'nda_requested',
  NDA_SIGNED = 'nda_signed',
  NDA_REJECTED = 'nda_rejected',

  // Investment
  INVESTMENT_INITIATED = 'investment_initiated',
  INVESTMENT_COMPLETED = 'investment_completed',
  INVESTMENT_REJECTED = 'investment_rejected',

  // Authentication
  LOGIN = 'login',
  LOGOUT = 'logout',
  SIGNUP = 'signup'
}

// Interface for event tracking
export interface AnalyticsEvent {
  id: string;
  timestamp: number;
  userId?: string;
  userType?: 'creator' | 'investor' | 'production';
  category: EventCategory;
  type: EventType;
  properties: Record<string, any>;
}

// Analytics tracking service
export class AnalyticsService {
  private static instance: AnalyticsService;
  private eventBuffer: AnalyticsEvent[] = [];
  private MAX_BUFFER_SIZE = 50;

  private constructor() {}

  // Singleton pattern
  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // Track an event
  public trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): void {
    const analyticsEvent: AnalyticsEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...event
    };

    // Add to buffer
    this.eventBuffer.push(analyticsEvent);

    // Flush buffer if it reaches max size
    if (this.eventBuffer.length >= this.MAX_BUFFER_SIZE) {
      this.flushEvents();
    }
  }

  // Flush events to storage or external analytics service
  private async flushEvents(): Promise<void> {
    try {
      // TODO: Implement actual event storage/transmission
      // Options:
      // 1. Send to external analytics service (e.g., Segment, Mixpanel)
      // 2. Store in database
      // 3. Send to data warehouse
      console.log(`Flushing ${this.eventBuffer.length} events`);
      
      // Clear buffer after processing
      this.eventBuffer = [];
    } catch (error) {
      console.error('Failed to flush events', error);
    }
  }

  // Manual flush method (can be called periodically or on app close)
  public async forceFlush(): Promise<void> {
    if (this.eventBuffer.length > 0) {
      await this.flushEvents();
    }
  }
}

// Helper function for tracking page views
export function trackPageView(path: string, userId?: string, userType?: 'creator' | 'investor' | 'production') {
  const analyticsService = AnalyticsService.getInstance();
  analyticsService.trackEvent({
    category: EventCategory.USER_INTERACTION,
    type: EventType.PAGE_VIEW,
    userId,
    userType,
    properties: { path }
  });
}