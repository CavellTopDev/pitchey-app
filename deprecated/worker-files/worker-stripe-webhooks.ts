// Cloudflare Worker for Stripe Webhook Processing
// Handles Stripe webhooks at the edge for improved reliability and performance

import Stripe from "stripe";

export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  API_URL: string;
  // Cloudflare KV for webhook deduplication
  WEBHOOK_CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only handle POST requests to webhook endpoint
    if (request.method !== 'POST' || !new URL(request.url).pathname.endsWith('/webhook')) {
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    try {
      // Initialize Stripe
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-06-20'
      });

      // Get raw body and signature
      const body = await request.text();
      const signature = request.headers.get('stripe-signature');

      if (!signature) {
        console.error('Missing Stripe signature');
        return new Response('Missing signature', { 
          status: 400,
          headers: corsHeaders 
        });
      }

      // Verify webhook signature
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return new Response('Invalid signature', { 
          status: 400,
          headers: corsHeaders 
        });
      }

      // Check for duplicate webhooks using KV
      const eventId = event.id;
      const existingEvent = await env.WEBHOOK_CACHE.get(eventId);
      
      if (existingEvent) {
        console.log(`Duplicate webhook ignored: ${eventId}`);
        return new Response('OK', { 
          status: 200,
          headers: corsHeaders 
        });
      }

      // Store event ID to prevent duplicates (expires in 24 hours)
      await env.WEBHOOK_CACHE.put(eventId, 'processed', { expirationTtl: 86400 });

      // Process critical events at the edge
      const criticalEvents = [
        'customer.subscription.created',
        'customer.subscription.updated', 
        'customer.subscription.deleted',
        'invoice.payment_succeeded',
        'invoice.payment_failed'
      ];

      if (criticalEvents.includes(event.type)) {
        try {
          await processCriticalEvent(event, env);
        } catch (error) {
          console.error('Error processing critical event:', error);
          // Continue to forward to backend for retry
        }
      }

      // Forward to backend for full processing
      const backendResponse = await fetch(`${env.API_URL}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature,
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || 'unknown',
          'X-Processed-By': 'cloudflare-worker'
        },
        body: body
      });

      if (!backendResponse.ok) {
        console.error('Backend webhook processing failed:', backendResponse.status);
        
        // For payment failures, we might want to retry
        if (event.type === 'invoice.payment_failed') {
          // Could implement retry logic here
          console.log('Payment failed event - consider retry logic');
        }
      }

      return new Response('OK', { 
        status: 200,
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Webhook processing error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders 
      });
    }
  },
};

// Process critical subscription events at the edge
async function processCriticalEvent(event: Stripe.Event, env: Env) {
  switch (event.type) {
    case 'customer.subscription.deleted':
      // Immediately revoke access
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;
      
      if (userId) {
        // Could use KV to store user access revocation
        await env.WEBHOOK_CACHE.put(`user:${userId}:access`, 'revoked', { expirationTtl: 3600 });
        console.log(`Access revoked for user ${userId}`);
      }
      break;

    case 'invoice.payment_failed':
      // Log payment failure for monitoring
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Payment failed for invoice ${invoice.id}`);
      
      // Could implement immediate notification logic
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      // Update access permissions
      const updatedSubscription = event.data.object as Stripe.Subscription;
      const updatedUserId = updatedSubscription.metadata.userId;
      
      if (updatedUserId) {
        await env.WEBHOOK_CACHE.put(`user:${updatedUserId}:access`, 'granted', { expirationTtl: 3600 });
        console.log(`Access granted for user ${updatedUserId}`);
      }
      break;
  }
}

// Helper function to get user access status (can be used by other parts of the app)
export async function getUserAccessStatus(userId: string, env: Env): Promise<'granted' | 'revoked' | 'unknown'> {
  const status = await env.WEBHOOK_CACHE.get(`user:${userId}:access`);
  return status as 'granted' | 'revoked' | 'unknown' || 'unknown';
}