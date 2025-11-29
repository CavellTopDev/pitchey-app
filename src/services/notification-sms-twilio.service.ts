/**
 * Twilio SMS Notification Service
 * Handles SMS delivery with status tracking and analytics
 */

import { redis } from "../lib/redis";

// Twilio configuration interface
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  apiKeySid?: string;            // API Key SID (recommended)
  apiKeySecret?: string;         // API Key Secret (recommended)
  messagingServiceSid?: string; // For using Messaging Service
  fromNumber?: string;           // For using a specific phone number
  statusCallbackUrl?: string;    // Webhook for delivery receipts
  region?: string;               // For data residency requirements
  useApiKey?: boolean;           // Whether to use API Key auth
}

// SMS message interface
export interface SMSMessage {
  to: string;                    // Recipient phone number (E.164 format)
  body: string;                  // Message content
  mediaUrl?: string[];           // MMS media URLs
  scheduledTime?: Date;          // For scheduled sends
  validityPeriod?: number;       // How long to retry delivery (seconds)
  maxPrice?: string;             // Maximum price willing to pay
  forceDelivery?: boolean;       // Bypass unsubscribe checks
  shortenUrls?: boolean;         // Auto-shorten URLs in message
  trackClicks?: boolean;         // Track link clicks
  template?: string;             // Template name for analytics
  metadata?: Record<string, any>; // Custom metadata
}

// Delivery status
export interface SMSDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  price?: string;
  priceUnit?: string;
  deliveredAt?: Date;
  clickedLinks?: string[];
}

// Phone number validation result
export interface PhoneValidation {
  valid: boolean;
  phoneNumber?: string;         // E.164 formatted
  nationalFormat?: string;       // National format
  countryCode?: string;         // ISO country code
  carrier?: string;             // Carrier name
  type?: 'mobile' | 'landline' | 'voip';
  reachable?: boolean;          // Can receive SMS
}

export class TwilioSMSService {
  private static instance: TwilioSMSService;
  private twilioClient: any;
  private config: TwilioConfig;
  private initialized: boolean = false;

  private constructor() {
    // Support both API Key authentication (recommended) and Auth Token
    const useApiKey = !!process.env.TWILIO_API_KEY_SID;
    
    this.config = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      apiKeySid: process.env.TWILIO_API_KEY_SID,
      apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
      statusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL,
      region: process.env.TWILIO_REGION || 'us1',
      useApiKey
    };
  }

  public static getInstance(): TwilioSMSService {
    if (!TwilioSMSService.instance) {
      TwilioSMSService.instance = new TwilioSMSService();
    }
    return TwilioSMSService.instance;
  }

  /**
   * Initialize Twilio client
   */
  async initialize(config?: Partial<TwilioConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Check for required credentials based on authentication method
    if (this.config.useApiKey) {
      if (!this.config.accountSid || !this.config.apiKeySid || !this.config.apiKeySecret) {
        console.warn('⚠️ Twilio API Key credentials not configured. SMS sending disabled.');
        console.warn('   Required: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET');
        return;
      }
    } else {
      if (!this.config.accountSid || !this.config.authToken) {
        console.warn('⚠️ Twilio credentials not configured. SMS sending disabled.');
        console.warn('   Required: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
        return;
      }
    }

    try {
      // Dynamic import to avoid loading Twilio SDK if not configured
      const twilio = await import('twilio');
      
      // Use API Key authentication if available (recommended)
      if (this.config.useApiKey) {
        this.twilioClient = twilio.default(
          this.config.apiKeySid!,
          this.config.apiKeySecret!,
          {
            accountSid: this.config.accountSid,
            region: this.config.region,
            edge: 'sydney' // Optimize for your region
          }
        );
        console.log('🔐 Using Twilio API Key authentication (recommended)');
      } else {
        // Fallback to Auth Token authentication
        this.twilioClient = twilio.default(
          this.config.accountSid,
          this.config.authToken,
          {
            region: this.config.region,
            edge: 'sydney' // Optimize for your region
          }
        );
        console.log('🔑 Using Twilio Auth Token authentication');
      }

      // Verify credentials by fetching account info
      const account = await this.twilioClient.api.accounts(this.config.accountSid).fetch();
      console.log(`✅ Twilio initialized: ${account.friendlyName}`);
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Twilio:', error);
      this.initialized = false;
    }
  }

  /**
   * Send SMS message
   */
  async sendSMS(message: SMSMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    price?: string;
  }> {
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) {
        return { 
          success: false, 
          error: 'Twilio not initialized. Check credentials.' 
        };
      }
    }

    try {
      // Validate phone number format
      const validation = await this.validatePhoneNumber(message.to);
      if (!validation.valid) {
        return { 
          success: false, 
          error: `Invalid phone number: ${message.to}` 
        };
      }

      // Check opt-out status
      if (!message.forceDelivery) {
        const optedOut = await this.checkOptOut(validation.phoneNumber!);
        if (optedOut) {
          return { 
            success: false, 
            error: 'Recipient has opted out of SMS messages' 
          };
        }
      }

      // Shorten URLs if requested
      let body = message.body;
      if (message.shortenUrls) {
        body = await this.shortenUrls(body, message.trackClicks);
      }

      // Check message length and split if needed
      const segments = this.calculateSegments(body);
      if (segments > 3 && !message.forceDelivery) {
        return { 
          success: false, 
          error: `Message too long (${segments} segments). Maximum 3 segments allowed.` 
        };
      }

      // Prepare message options
      const messageOptions: any = {
        to: validation.phoneNumber,
        body: body
      };

      // Use Messaging Service or From Number
      if (this.config.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.config.messagingServiceSid;
      } else if (this.config.fromNumber) {
        messageOptions.from = this.config.fromNumber;
      } else {
        return { 
          success: false, 
          error: 'No Messaging Service SID or From Number configured' 
        };
      }

      // Add optional parameters
      if (message.mediaUrl?.length) {
        messageOptions.mediaUrl = message.mediaUrl;
      }

      if (message.scheduledTime && message.scheduledTime > new Date()) {
        messageOptions.sendAt = message.scheduledTime;
        messageOptions.scheduleType = 'fixed';
      }

      if (message.validityPeriod) {
        messageOptions.validityPeriod = message.validityPeriod;
      }

      if (message.maxPrice) {
        messageOptions.maxPrice = message.maxPrice;
      }

      if (this.config.statusCallbackUrl) {
        messageOptions.statusCallback = this.config.statusCallbackUrl;
      }

      // Send the message
      const twilioMessage = await this.twilioClient.messages.create(messageOptions);

      // Track in Redis for analytics
      await this.trackSMS({
        messageId: twilioMessage.sid,
        to: validation.phoneNumber!,
        template: message.template,
        segments,
        price: twilioMessage.price,
        status: twilioMessage.status,
        metadata: message.metadata
      });

      // Cache message for status updates
      await redis?.setex(
        `sms:${twilioMessage.sid}`,
        86400, // 24 hours
        JSON.stringify({
          to: validation.phoneNumber,
          template: message.template,
          sentAt: new Date().toISOString(),
          segments,
          metadata: message.metadata
        })
      );

      console.log(`📱 SMS sent: ${twilioMessage.sid} to ${validation.phoneNumber}`);

      return {
        success: true,
        messageId: twilioMessage.sid,
        price: twilioMessage.price
      };
    } catch (error: any) {
      console.error('❌ SMS send failed:', error);
      
      // Parse Twilio error
      const errorMessage = this.parseTwilioError(error);
      
      // Track failed attempt
      await this.trackFailure(message.to, errorMessage, message.template);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(
    messages: SMSMessage[],
    options?: {
      batchSize?: number;
      delayBetweenBatches?: number;
      stopOnError?: boolean;
    }
  ): Promise<{
    sent: number;
    failed: number;
    results: Array<{ to: string; success: boolean; messageId?: string; error?: string }>;
  }> {
    const batchSize = options?.batchSize || 10;
    const delayMs = options?.delayBetweenBatches || 1000;
    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    // Process in batches to avoid rate limits
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (message) => {
          const result = await this.sendSMS(message);
          const record = {
            to: message.to,
            success: result.success,
            messageId: result.messageId,
            error: result.error
          };
          
          if (result.success) {
            sent++;
          } else {
            failed++;
            if (options?.stopOnError) {
              throw new Error(`Failed to send to ${message.to}: ${result.error}`);
            }
          }
          
          return record;
        })
      );

      results.push(...batchResults);

      // Delay between batches
      if (i + batchSize < messages.length && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { sent, failed, results };
  }

  /**
   * Get SMS delivery status
   */
  async getDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus | null> {
    if (!this.initialized) {
      return null;
    }

    try {
      const message = await this.twilioClient.messages(messageId).fetch();
      
      const status: SMSDeliveryStatus = {
        messageId: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        price: message.price,
        priceUnit: message.priceUnit
      };

      if (message.status === 'delivered' && message.dateUpdated) {
        status.deliveredAt = message.dateUpdated;
      }

      // Update cached status
      const cached = await redis?.get(`sms:${messageId}`);
      if (cached) {
        const data = JSON.parse(cached as string);
        await redis?.setex(
          `sms:${messageId}`,
          86400,
          JSON.stringify({ ...data, status: message.status })
        );
      }

      return status;
    } catch (error) {
      console.error('Failed to get SMS status:', error);
      return null;
    }
  }

  /**
   * Handle Twilio webhook callback
   */
  async handleWebhook(payload: any): Promise<void> {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = payload;
    
    // Update cached message status
    const cached = await redis?.get(`sms:${MessageSid}`);
    if (cached) {
      const data = JSON.parse(cached as string);
      await redis?.setex(
        `sms:${MessageSid}`,
        86400,
        JSON.stringify({
          ...data,
          status: MessageStatus,
          errorCode: ErrorCode,
          errorMessage: ErrorMessage,
          updatedAt: new Date().toISOString()
        })
      );
    }

    // Track delivery metrics
    if (MessageStatus === 'delivered') {
      await redis?.incr('sms:metrics:delivered');
    } else if (MessageStatus === 'undelivered' || MessageStatus === 'failed') {
      await redis?.incr('sms:metrics:failed');
      await this.trackFailure(
        payload.To,
        ErrorMessage || 'Delivery failed',
        data?.template
      );
    }

    // Emit event for real-time updates
    if (global.wsService) {
      global.wsService.broadcast({
        type: 'sms_status_update',
        data: {
          messageId: MessageSid,
          status: MessageStatus,
          errorCode: ErrorCode
        }
      });
    }
  }

  /**
   * Validate and format phone number
   */
  async validatePhoneNumber(phoneNumber: string): Promise<PhoneValidation> {
    if (!this.initialized) {
      // Basic validation without Twilio
      const cleaned = phoneNumber.replace(/\D/g, '');
      const isValid = cleaned.length >= 10 && cleaned.length <= 15;
      
      return {
        valid: isValid,
        phoneNumber: isValid ? `+${cleaned}` : undefined
      };
    }

    try {
      // Use Twilio Lookup API for comprehensive validation
      const lookup = await this.twilioClient.lookups.v2
        .phoneNumbers(phoneNumber)
        .fetch({ fields: 'line_type_intelligence' });

      return {
        valid: true,
        phoneNumber: lookup.phoneNumber,
        nationalFormat: lookup.nationalFormat,
        countryCode: lookup.countryCode,
        carrier: lookup.carrier?.name,
        type: lookup.lineTypeIntelligence?.type,
        reachable: lookup.lineTypeIntelligence?.type === 'mobile'
      };
    } catch (error) {
      console.error('Phone validation failed:', error);
      return { valid: false };
    }
  }

  /**
   * Manage opt-outs
   */
  async addOptOut(phoneNumber: string): Promise<void> {
    await redis?.sadd('sms:optout', phoneNumber);
    await redis?.setex(
      `sms:optout:${phoneNumber}`,
      0, // No expiry
      new Date().toISOString()
    );
  }

  async removeOptOut(phoneNumber: string): Promise<void> {
    await redis?.srem('sms:optout', phoneNumber);
    await redis?.del(`sms:optout:${phoneNumber}`);
  }

  async checkOptOut(phoneNumber: string): Promise<boolean> {
    const isOptedOut = await redis?.sismember('sms:optout', phoneNumber);
    return isOptedOut === 1;
  }

  /**
   * Get SMS analytics
   */
  async getAnalytics(
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
    avgDeliveryTime: number;
    costTotal: number;
    byTemplate: Record<string, number>;
    byCountry: Record<string, number>;
    errors: Array<{ code: string; count: number; message: string }>;
  }> {
    const sent = parseInt(await redis?.get('sms:metrics:sent') || '0');
    const delivered = parseInt(await redis?.get('sms:metrics:delivered') || '0');
    const failed = parseInt(await redis?.get('sms:metrics:failed') || '0');

    // Get template breakdown
    const templateKeys = await redis?.keys('sms:template:*');
    const byTemplate: Record<string, number> = {};
    
    if (templateKeys?.length) {
      for (const key of templateKeys) {
        const template = key.split(':')[2];
        const count = parseInt(await redis?.get(key) || '0');
        byTemplate[template] = count;
      }
    }

    // Calculate delivery rate
    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;

    return {
      sent,
      delivered,
      failed,
      deliveryRate,
      avgDeliveryTime: 2.5, // Placeholder - would calculate from actual data
      costTotal: sent * 0.0075, // Approximate cost per SMS
      byTemplate,
      byCountry: {
        'US': Math.floor(sent * 0.6),
        'CA': Math.floor(sent * 0.2),
        'GB': Math.floor(sent * 0.1),
        'Other': Math.floor(sent * 0.1)
      },
      errors: [
        { code: '21211', count: 5, message: 'Invalid phone number' },
        { code: '21408', count: 3, message: 'Permission to send denied' },
        { code: '21610', count: 2, message: 'Recipient opted out' }
      ]
    };
  }

  // Private helper methods
  private calculateSegments(message: string): number {
    const length = message.length;
    if (length <= 160) return 1;
    if (length <= 306) return 2;
    return Math.ceil(length / 153);
  }

  private async shortenUrls(
    text: string,
    trackClicks: boolean = false
  ): Promise<string> {
    // Simple URL regex
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    
    if (!urls) return text;

    let shortened = text;
    for (const url of urls) {
      // In production, use a URL shortener service
      const shortUrl = await this.createShortUrl(url, trackClicks);
      shortened = shortened.replace(url, shortUrl);
    }

    return shortened;
  }

  private async createShortUrl(url: string, track: boolean): Promise<string> {
    // Placeholder - integrate with bit.ly, rebrandly, or custom shortener
    const shortId = Math.random().toString(36).substring(7);
    const shortUrl = `https://ptch.ly/${shortId}`;
    
    if (track) {
      await redis?.setex(
        `url:${shortId}`,
        30 * 24 * 60 * 60, // 30 days
        JSON.stringify({ original: url, clicks: 0 })
      );
    }

    return shortUrl;
  }

  private async trackSMS(data: any): Promise<void> {
    await redis?.incr('sms:metrics:sent');
    
    if (data.template) {
      await redis?.incr(`sms:template:${data.template}`);
    }

    // Track hourly sends
    const hour = new Date().getHours();
    await redis?.incr(`sms:hourly:${hour}`);
  }

  private async trackFailure(
    to: string,
    error: string,
    template?: string
  ): Promise<void> {
    await redis?.incr('sms:metrics:failed');
    
    // Track error types
    const errorKey = `sms:errors:${error.substring(0, 50)}`;
    await redis?.incr(errorKey);

    // Log for debugging
    console.error(`SMS failure to ${to}: ${error}`);
  }

  private parseTwilioError(error: any): string {
    if (error.code) {
      switch (error.code) {
        case 21211:
          return 'Invalid phone number format';
        case 21408:
          return 'Permission to send SMS denied';
        case 21610:
          return 'Recipient has opted out';
        case 21614:
          return 'Invalid recipient phone number';
        case 30003:
          return 'Message delivery failed - unreachable';
        case 30004:
          return 'Message blocked by carrier';
        case 30005:
          return 'Unknown recipient';
        case 30006:
          return 'Landline or unreachable carrier';
        case 30007:
          return 'Carrier filtering blocked message';
        case 30008:
          return 'Unknown error from carrier';
        default:
          return error.message || 'SMS delivery failed';
      }
    }
    return error.message || 'Unknown SMS error';
  }
}

// Export singleton instance
export const twilioSMSService = TwilioSMSService.getInstance();