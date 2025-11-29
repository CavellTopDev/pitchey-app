/**
 * Twilio Webhook Routes
 * Handles SMS delivery status callbacks and opt-outs
 */

import { Hono } from "hono";
import { twilioSMSService } from "../services/notification-sms-twilio.service";
import { redis } from "../lib/redis";
import crypto from "crypto";

const twilioWebhookRoutes = new Hono();

// Twilio webhook authentication middleware
const validateTwilioRequest = async (c: any, next: any) => {
  const signature = c.req.header('X-Twilio-Signature');
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!signature || !authToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get the full URL
  const url = `${c.req.url}`;
  
  // Get all POST parameters
  const body = await c.req.parseBody();
  
  // Sort parameters alphabetically and concatenate
  const params = Object.keys(body)
    .sort()
    .map(key => `${key}${body[key]}`)
    .join('');
  
  // Calculate expected signature
  const data = url + params;
  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(data)
    .digest('base64');
  
  // Compare signatures
  if (signature !== expectedSignature) {
    console.warn('Invalid Twilio webhook signature');
    return c.json({ error: 'Invalid signature' }, 401);
  }
  
  await next();
};

// SMS status callback
twilioWebhookRoutes.post("/webhooks/twilio/status", validateTwilioRequest, async (c) => {
  try {
    const body = await c.req.parseBody();
    
    // Handle the status update
    await twilioSMSService.handleWebhook(body);
    
    // Log the status change
    console.log(`SMS ${body.MessageSid}: ${body.MessageStatus}`);
    
    // Track specific events
    if (body.MessageStatus === 'delivered') {
      await redis?.incr('sms:metrics:delivered');
      
      // Update delivery timestamp
      const cached = await redis?.get(`sms:${body.MessageSid}`);
      if (cached) {
        const data = JSON.parse(cached as string);
        await redis?.setex(
          `sms:${body.MessageSid}`,
          86400,
          JSON.stringify({
            ...data,
            deliveredAt: new Date().toISOString(),
            status: 'delivered'
          })
        );
      }
    } else if (body.MessageStatus === 'undelivered' || body.MessageStatus === 'failed') {
      await redis?.incr('sms:metrics:failed');
      
      // Track error reason
      if (body.ErrorCode) {
        await redis?.incr(`sms:errors:${body.ErrorCode}`);
      }
    }
    
    return c.text('OK', 200);
  } catch (error) {
    console.error('Twilio status webhook error:', error);
    return c.text('Error', 500);
  }
});

// Incoming SMS (for opt-outs and commands)
twilioWebhookRoutes.post("/webhooks/twilio/incoming", validateTwilioRequest, async (c) => {
  try {
    const body = await c.req.parseBody();
    const from = body.From;
    const messageBody = (body.Body || '').toLowerCase().trim();
    
    console.log(`Incoming SMS from ${from}: ${messageBody}`);
    
    // Handle opt-out keywords
    const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'quit', 'end'];
    if (optOutKeywords.includes(messageBody)) {
      await twilioSMSService.addOptOut(from);
      
      // Send confirmation
      await twilioSMSService.sendSMS({
        to: from,
        body: 'You have been unsubscribed from Pitchey SMS notifications. Reply START to resubscribe.',
        forceDelivery: true // Bypass opt-out check for confirmation
      });
      
      console.log(`User ${from} opted out of SMS`);
      return c.text('OK', 200);
    }
    
    // Handle opt-in keywords
    const optInKeywords = ['start', 'subscribe', 'yes', 'unstop'];
    if (optInKeywords.includes(messageBody)) {
      await twilioSMSService.removeOptOut(from);
      
      // Send confirmation
      await twilioSMSService.sendSMS({
        to: from,
        body: 'Welcome back! You are now subscribed to Pitchey SMS notifications. Reply STOP to unsubscribe.',
        forceDelivery: true
      });
      
      console.log(`User ${from} opted in to SMS`);
      return c.text('OK', 200);
    }
    
    // Handle help keyword
    if (messageBody === 'help' || messageBody === 'info') {
      await twilioSMSService.sendSMS({
        to: from,
        body: 'Pitchey SMS: Reply STOP to unsubscribe, START to subscribe, or visit pitchey.com/help for assistance.',
        forceDelivery: true
      });
      return c.text('OK', 200);
    }
    
    // Handle verification codes
    if (messageBody.match(/^\d{6}$/)) {
      // This is likely a verification code response
      // Store it for verification
      await redis?.setex(
        `verify:sms:${from}`,
        300, // 5 minutes
        messageBody
      );
      
      console.log(`Verification code ${messageBody} received from ${from}`);
      return c.text('OK', 200);
    }
    
    // Default response for unrecognized messages
    await twilioSMSService.sendSMS({
      to: from,
      body: 'Sorry, we didn\'t understand that message. Reply HELP for options or visit pitchey.com',
      forceDelivery: true
    });
    
    return c.text('OK', 200);
  } catch (error) {
    console.error('Twilio incoming webhook error:', error);
    return c.text('Error', 500);
  }
});

// Click tracking webhook (for shortened URLs)
twilioWebhookRoutes.get("/s/:shortId", async (c) => {
  try {
    const shortId = c.req.param('shortId');
    
    // Get original URL from Redis
    const data = await redis?.get(`url:${shortId}`);
    if (!data) {
      return c.redirect('https://pitchey.com');
    }
    
    const { original, clicks } = JSON.parse(data as string);
    
    // Increment click count
    await redis?.setex(
      `url:${shortId}`,
      30 * 24 * 60 * 60,
      JSON.stringify({ original, clicks: clicks + 1 })
    );
    
    // Track click analytics
    await redis?.incr('sms:metrics:clicks');
    
    // Get user info from query params if available
    const userId = c.req.query('u');
    const campaign = c.req.query('c');
    
    if (userId) {
      await redis?.incr(`sms:user:${userId}:clicks`);
    }
    
    if (campaign) {
      await redis?.incr(`sms:campaign:${campaign}:clicks`);
    }
    
    // Redirect to original URL
    return c.redirect(original);
  } catch (error) {
    console.error('URL redirect error:', error);
    return c.redirect('https://pitchey.com');
  }
});

// Get SMS analytics endpoint
twilioWebhookRoutes.get("/api/sms/analytics", async (c) => {
  try {
    const timeRange = c.req.query('timeRange') || '24h';
    const analytics = await twilioSMSService.getAnalytics(timeRange as any);
    
    return c.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('SMS analytics error:', error);
    return c.json({
      success: false,
      error: 'Failed to get SMS analytics'
    }, 500);
  }
});

// Test SMS endpoint (for development)
twilioWebhookRoutes.post("/api/sms/test", async (c) => {
  try {
    const body = await c.req.json();
    const { to, message, template } = body;
    
    if (!to || !message) {
      return c.json({
        success: false,
        error: 'Missing required fields: to, message'
      }, 400);
    }
    
    // Validate phone number
    const validation = await twilioSMSService.validatePhoneNumber(to);
    if (!validation.valid) {
      return c.json({
        success: false,
        error: 'Invalid phone number format'
      }, 400);
    }
    
    // Send test SMS
    const result = await twilioSMSService.sendSMS({
      to: validation.phoneNumber!,
      body: message,
      template: template || 'test'
    });
    
    return c.json(result);
  } catch (error: any) {
    console.error('Test SMS error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

// Bulk SMS status check
twilioWebhookRoutes.post("/api/sms/status/bulk", async (c) => {
  try {
    const { messageIds } = await c.req.json();
    
    if (!Array.isArray(messageIds)) {
      return c.json({
        success: false,
        error: 'messageIds must be an array'
      }, 400);
    }
    
    const statuses = await Promise.all(
      messageIds.map(id => twilioSMSService.getDeliveryStatus(id))
    );
    
    return c.json({
      success: true,
      data: statuses.reduce((acc, status, index) => {
        acc[messageIds[index]] = status;
        return acc;
      }, {} as any)
    });
  } catch (error: any) {
    console.error('Bulk status check error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

export { twilioWebhookRoutes };