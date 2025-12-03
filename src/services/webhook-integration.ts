/**
 * Webhook System Integration
 * Integrates the webhook system into the existing Pitchey platform
 */

import { WebhookEventPublisher } from './webhook-event-publisher.service';
import { addWebhookRoutes } from './webhook-routes.service';

// Initialize webhook event publisher
let webhookPublisher: WebhookEventPublisher | null = null;

function getWebhookPublisher(): WebhookEventPublisher {
  if (!webhookPublisher) {
    webhookPublisher = new WebhookEventPublisher(
      process.env.DATABASE_URL || '',
      process.env.REDIS_URL
    );
  }
  return webhookPublisher;
}

// ============================================================================
// INTEGRATION HELPERS FOR EXISTING SERVICES
// ============================================================================

/**
 * Publish user events from auth service
 */
export const webhookUserEvents = {
  created: (userData: any, triggeredBy?: number) => 
    getWebhookPublisher().publishUserEvent('user.created', userData.id, userData, triggeredBy),
  
  updated: (userData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishUserEvent('user.updated', userData.id, userData, triggeredBy),
  
  verified: (userData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishUserEvent('user.verified', userData.id, userData, triggeredBy),
  
  login: (userData: any) =>
    getWebhookPublisher().publishUserEvent('user.login', userData.id, userData, userData.id),
  
  logout: (userData: any) =>
    getWebhookPublisher().publishUserEvent('user.logout', userData.id, userData, userData.id),
};

/**
 * Publish pitch events from pitch service
 */
export const webhookPitchEvents = {
  created: (pitchData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishPitchEvent('pitch.created', pitchData.id, pitchData, triggeredBy),
  
  updated: (pitchData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishPitchEvent('pitch.updated', pitchData.id, pitchData, triggeredBy),
  
  published: (pitchData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishPitchEvent('pitch.published', pitchData.id, pitchData, triggeredBy),
  
  viewed: (pitchData: any, viewerId?: number) =>
    getWebhookPublisher().publishPitchEvent('pitch.viewed', pitchData.id, pitchData, viewerId),
  
  liked: (pitchData: any, likerId?: number) =>
    getWebhookPublisher().publishPitchEvent('pitch.liked', pitchData.id, pitchData, likerId),
};

/**
 * Publish NDA events from NDA service
 */
export const webhookNDAEvents = {
  requested: (ndaData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishNDAEvent('nda.requested', ndaData.id, ndaData, triggeredBy),
  
  signed: (ndaData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishNDAEvent('nda.signed', ndaData.id, ndaData, triggeredBy),
  
  approved: (ndaData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishNDAEvent('nda.approved', ndaData.id, ndaData, triggeredBy),
  
  rejected: (ndaData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishNDAEvent('nda.rejected', ndaData.id, ndaData, triggeredBy),
};

/**
 * Publish investment events from investment service
 */
export const webhookInvestmentEvents = {
  created: (investmentData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishInvestmentEvent('investment.created', investmentData.id, investmentData, triggeredBy),
  
  approved: (investmentData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishInvestmentEvent('investment.approved', investmentData.id, investmentData, triggeredBy),
  
  funded: (investmentData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishInvestmentEvent('investment.funded', investmentData.id, investmentData, triggeredBy),
};

/**
 * Publish message events from messaging service
 */
export const webhookMessageEvents = {
  sent: (messageData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishMessageEvent('message.sent', messageData.id, messageData, triggeredBy),
  
  read: (messageData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishMessageEvent('message.read', messageData.id, messageData, triggeredBy),
};

/**
 * Publish payment events from payment service
 */
export const webhookPaymentEvents = {
  succeeded: (paymentData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishPaymentEvent('payment.succeeded', paymentData.id, paymentData, triggeredBy),
  
  failed: (paymentData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishPaymentEvent('payment.failed', paymentData.id, paymentData, triggeredBy),
  
  subscriptionCreated: (subscriptionData: any, triggeredBy?: number) =>
    getWebhookPublisher().publishPaymentEvent('subscription.created', subscriptionData.id, subscriptionData, triggeredBy),
};

// ============================================================================
// WORKER INTEGRATION
// ============================================================================

/**
 * Enhance existing worker with webhook functionality
 */
export function enhanceWorkerWithWebhooks(
  existingHandler: (request: Request, env: any) => Promise<Response>
) {
  return addWebhookRoutes(existingHandler);
}

/**
 * Initialize webhook system for worker environment
 */
export function initializeWebhookSystem(env: any) {
  if (env.DATABASE_URL) {
    webhookPublisher = new WebhookEventPublisher(
      env.DATABASE_URL,
      env.REDIS_URL
    );
  }
}

/**
 * Cleanup webhook system resources
 */
export function cleanupWebhookSystem() {
  if (webhookPublisher) {
    webhookPublisher.cleanup();
    webhookPublisher = null;
  }
}

// ============================================================================
// INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example integration with existing auth service
 */
export function integrateWithAuthService(authService: any) {
  const originalRegister = authService.register;
  const originalLogin = authService.login;
  const originalVerifyEmail = authService.verifyEmail;

  // Enhance register method
  authService.register = async function(userData: any) {
    const result = await originalRegister.call(this, userData);
    
    if (result.success && result.user) {
      // Publish user created event
      await webhookUserEvents.created(result.user);
    }
    
    return result;
  };

  // Enhance login method
  authService.login = async function(credentials: any) {
    const result = await originalLogin.call(this, credentials);
    
    if (result.success && result.user) {
      // Publish user login event
      await webhookUserEvents.login(result.user);
    }
    
    return result;
  };

  // Enhance email verification
  authService.verifyEmail = async function(token: string) {
    const result = await originalVerifyEmail.call(this, token);
    
    if (result.success && result.user) {
      // Publish user verified event
      await webhookUserEvents.verified(result.user);
    }
    
    return result;
  };

  return authService;
}

/**
 * Example integration with pitch service
 */
export function integrateWithPitchService(pitchService: any) {
  const originalCreatePitch = pitchService.createPitch;
  const originalUpdatePitch = pitchService.updatePitch;
  const originalPublishPitch = pitchService.publishPitch;

  // Enhance create pitch method
  pitchService.createPitch = async function(pitchData: any, userId: number) {
    const result = await originalCreatePitch.call(this, pitchData, userId);
    
    if (result.success && result.pitch) {
      // Publish pitch created event
      await webhookPitchEvents.created(result.pitch, userId);
    }
    
    return result;
  };

  // Enhance update pitch method
  pitchService.updatePitch = async function(pitchId: number, updates: any, userId: number) {
    const result = await originalUpdatePitch.call(this, pitchId, updates, userId);
    
    if (result.success && result.pitch) {
      // Publish pitch updated event
      await webhookPitchEvents.updated(result.pitch, userId);
    }
    
    return result;
  };

  // Enhance publish pitch method
  pitchService.publishPitch = async function(pitchId: number, userId: number) {
    const result = await originalPublishPitch.call(this, pitchId, userId);
    
    if (result.success && result.pitch) {
      // Publish pitch published event
      await webhookPitchEvents.published(result.pitch, userId);
    }
    
    return result;
  };

  return pitchService;
}

/**
 * Example integration with investment service
 */
export function integrateWithInvestmentService(investmentService: any) {
  const originalCreateInvestment = investmentService.createInvestment;
  const originalApproveInvestment = investmentService.approveInvestment;

  // Enhance create investment method
  investmentService.createInvestment = async function(investmentData: any, userId: number) {
    const result = await originalCreateInvestment.call(this, investmentData, userId);
    
    if (result.success && result.investment) {
      // Publish investment created event
      await webhookInvestmentEvents.created(result.investment, userId);
    }
    
    return result;
  };

  // Enhance approve investment method
  investmentService.approveInvestment = async function(investmentId: number, userId: number) {
    const result = await originalApproveInvestment.call(this, investmentId, userId);
    
    if (result.success && result.investment) {
      // Publish investment approved event
      await webhookInvestmentEvents.approved(result.investment, userId);
    }
    
    return result;
  };

  return investmentService;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Batch publish events for bulk operations
 */
export async function publishBatchEvents(events: Array<{
  type: string;
  data: any;
  triggeredBy?: number;
}>) {
  const batchInput = {
    events: events.map(event => ({
      eventType: event.type,
      payload: event.data,
    })),
    triggeredBy: events[0]?.triggeredBy,
    source: 'batch_operation',
  };

  return await getWebhookPublisher().publishBatchEvents(batchInput);
}

/**
 * Create real-time event stream for WebSocket connections
 */
export async function createEventStream(
  eventTypes: string[],
  callback: (event: any) => void
): Promise<() => void> {
  const patterns = eventTypes.map(type => ({
    eventType: type,
  }));

  return await getWebhookPublisher().streamEvents(patterns, callback);
}

/**
 * Get webhook system health status
 */
export function getWebhookSystemHealth() {
  return {
    initialized: !!webhookPublisher,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
}

export default {
  userEvents: webhookUserEvents,
  pitchEvents: webhookPitchEvents,
  ndaEvents: webhookNDAEvents,
  investmentEvents: webhookInvestmentEvents,
  messageEvents: webhookMessageEvents,
  paymentEvents: webhookPaymentEvents,
  enhanceWorkerWithWebhooks,
  initializeWebhookSystem,
  cleanupWebhookSystem,
  integrateWithAuthService,
  integrateWithPitchService,
  integrateWithInvestmentService,
  publishBatchEvents,
  createEventStream,
  getWebhookSystemHealth,
};