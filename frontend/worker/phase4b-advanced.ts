import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import { Env } from './index';

// JWT verification function
async function verifyJWT(token: string, secret: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expectedSignature = new Uint8Array(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(char => char.charCodeAt(0))
  );
  
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    expectedSignature,
    encoder.encode(data)
  );
  
  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }
  
  return JSON.parse(atob(payload));
}

async function getUserFromAuth(request: Request, env: Env): Promise<{ id: number; userType: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  try {
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    return { id: payload.id, userType: payload.userType };
  } catch {
    return null;
  }
}

export function setupPhase4BEndpoints(
  request: Request,
  env: Env,
  sql: ReturnType<typeof neon>,
  redis: Redis | null,
  url: URL,
  corsHeaders: Record<string, string>
): Response | null {

  // ============= PAYMENT INTEGRATION =============

  // Setup payment method
  if (url.pathname === '/api/payments/setup' && request.method === 'POST') {
    return handleSetupPaymentMethod(request, env, sql, corsHeaders);
  }

  // Process payment
  if (url.pathname === '/api/payments/process' && request.method === 'POST') {
    return handleProcessPayment(request, env, sql, redis, corsHeaders);
  }

  // Subscription management
  if (url.pathname === '/api/payments/subscriptions' && request.method === 'GET') {
    return handleGetSubscriptions(request, env, sql, corsHeaders);
  }

  // Create subscription
  if (url.pathname === '/api/payments/subscriptions' && request.method === 'POST') {
    return handleCreateSubscription(request, env, sql, corsHeaders);
  }

  // Cancel subscription
  if (url.pathname.match(/^\/api\/payments\/subscriptions\/\w+\/cancel$/) && request.method === 'POST') {
    const subscriptionId = url.pathname.split('/')[4];
    return handleCancelSubscription(request, subscriptionId, env, sql, corsHeaders);
  }

  // Invoice generation
  if (url.pathname === '/api/payments/invoices' && request.method === 'GET') {
    return handleGetInvoices(request, env, sql, url, corsHeaders);
  }

  // Generate invoice
  if (url.pathname === '/api/payments/invoices' && request.method === 'POST') {
    return handleGenerateInvoice(request, env, sql, corsHeaders);
  }

  // Process refund
  if (url.pathname === '/api/payments/refunds' && request.method === 'POST') {
    return handleProcessRefund(request, env, sql, corsHeaders);
  }

  // Payment webhooks
  if (url.pathname === '/api/payments/webhooks' && request.method === 'POST') {
    return handlePaymentWebhook(request, env, sql, corsHeaders);
  }

  // Manage credit cards
  if (url.pathname === '/api/payments/cards' && request.method === 'GET') {
    return handleGetPaymentMethods(request, env, sql, corsHeaders);
  }

  // Add payment method
  if (url.pathname === '/api/payments/cards' && request.method === 'POST') {
    return handleAddPaymentMethod(request, env, sql, corsHeaders);
  }

  // Escrow services
  if (url.pathname === '/api/payments/escrow' && request.method === 'POST') {
    return handleCreateEscrow(request, env, sql, corsHeaders);
  }

  // ============= MEDIA STREAMING & CDN =============

  // Stream video
  if (url.pathname.match(/^\/api\/media\/stream\/\d+$/) && request.method === 'GET') {
    const mediaId = url.pathname.split('/')[4];
    return handleStreamMedia(request, mediaId, env, sql, corsHeaders);
  }

  // Generate thumbnail
  if (url.pathname === '/api/media/thumbnail' && request.method === 'POST') {
    return handleGenerateThumbnail(request, env, sql, corsHeaders);
  }

  // Video transcoding
  if (url.pathname === '/api/media/transcode' && request.method === 'POST') {
    return handleTranscodeVideo(request, env, sql, redis, corsHeaders);
  }

  // Subtitle management
  if (url.pathname.match(/^\/api\/media\/\d+\/subtitles$/) && request.method === 'GET') {
    const mediaId = url.pathname.split('/')[3];
    return handleGetSubtitles(request, mediaId, sql, corsHeaders);
  }

  // Upload subtitles
  if (url.pathname.match(/^\/api\/media\/\d+\/subtitles$/) && request.method === 'POST') {
    const mediaId = url.pathname.split('/')[3];
    return handleUploadSubtitles(request, mediaId, env, sql, corsHeaders);
  }

  // Media consumption analytics
  if (url.pathname.match(/^\/api\/media\/\d+\/analytics$/) && request.method === 'GET') {
    const mediaId = url.pathname.split('/')[3];
    return handleMediaAnalytics(request, mediaId, sql, corsHeaders);
  }

  // CDN cache purging
  if (url.pathname === '/api/cdn/purge' && request.method === 'POST') {
    return handlePurgeCache(request, env, corsHeaders);
  }

  // Watermark media
  if (url.pathname === '/api/media/watermark' && request.method === 'POST') {
    return handleWatermarkMedia(request, env, sql, corsHeaders);
  }

  // File compression
  if (url.pathname === '/api/media/compress' && request.method === 'POST') {
    return handleCompressFile(request, env, sql, corsHeaders);
  }

  // Generate preview
  if (url.pathname === '/api/media/preview' && request.method === 'POST') {
    return handleGeneratePreview(request, env, sql, corsHeaders);
  }

  // ============= ADVANCED ANALYTICS =============

  // User engagement metrics
  if (url.pathname === '/api/analytics/engagement' && request.method === 'GET') {
    return handleEngagementMetrics(request, env, sql, url, corsHeaders);
  }

  // Conversion funnel analysis
  if (url.pathname === '/api/analytics/conversion' && request.method === 'GET') {
    return handleConversionAnalysis(request, env, sql, url, corsHeaders);
  }

  // Cohort analysis
  if (url.pathname === '/api/analytics/cohort' && request.method === 'GET') {
    return handleCohortAnalysis(request, env, sql, url, corsHeaders);
  }

  // Revenue analytics
  if (url.pathname === '/api/analytics/revenue' && request.method === 'GET') {
    return handleRevenueAnalytics(request, env, sql, url, corsHeaders);
  }

  // Geographic distribution
  if (url.pathname === '/api/analytics/geographic' && request.method === 'GET') {
    return handleGeographicAnalytics(request, sql, url, corsHeaders);
  }

  // Device and browser statistics
  if (url.pathname === '/api/analytics/device' && request.method === 'GET') {
    return handleDeviceAnalytics(request, sql, url, corsHeaders);
  }

  // Platform performance metrics
  if (url.pathname === '/api/analytics/performance' && request.method === 'GET') {
    return handlePerformanceMetrics(request, env, sql, url, corsHeaders);
  }

  // ML-powered predictions
  if (url.pathname === '/api/analytics/predictions' && request.method === 'GET') {
    return handlePredictiveAnalytics(request, env, sql, url, corsHeaders);
  }

  // Custom metric tracking
  if (url.pathname === '/api/analytics/custom' && request.method === 'POST') {
    return handleCustomMetrics(request, env, sql, corsHeaders);
  }

  // Real-time dashboard data
  if (url.pathname === '/api/analytics/real-time' && request.method === 'GET') {
    return handleRealTimeAnalytics(request, env, sql, redis, corsHeaders);
  }

  // Scheduled reports
  if (url.pathname === '/api/analytics/export/scheduled' && request.method === 'GET') {
    return handleScheduledReports(request, env, sql, corsHeaders);
  }

  // Performance alerting
  if (url.pathname === '/api/analytics/alerts' && request.method === 'GET') {
    return handlePerformanceAlerts(request, env, sql, corsHeaders);
  }

  return null;
}

// ============= PAYMENT IMPLEMENTATIONS =============

async function handleSetupPaymentMethod(
  request: Request,
  env: Env,
  sql: any,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json() as {
      type: 'card' | 'bank' | 'paypal';
      details: any;
    };

    // Mock implementation for demo - adapts to existing schema
    const mockStripeId = 'pm_mock_' + Date.now();
    const mockCustomerId = 'cus_mock_' + user.id;
    
    const paymentMethod = await sql`
      INSERT INTO payment_methods (
        user_id, 
        stripe_payment_method_id, 
        stripe_customer_id, 
        type, 
        card_brand, 
        card_last4, 
        card_exp_month, 
        card_exp_year,
        is_default
      )
      VALUES (
        ${user.id}, 
        ${mockStripeId}, 
        ${mockCustomerId}, 
        ${body.type}, 
        'visa', 
        '4242', 
        12, 
        2025,
        false
      )
      RETURNING *
    `;

    return new Response(JSON.stringify({
      success: true,
      paymentMethod: {
        id: paymentMethod[0].id,
        type: paymentMethod[0].type,
        last4: paymentMethod[0].card_last4,
        brand: paymentMethod[0].card_brand,
        expiryMonth: paymentMethod[0].card_exp_month,
        expiryYear: paymentMethod[0].card_exp_year,
        isDefault: paymentMethod[0].is_default
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to setup payment method'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleProcessPayment(
  request: Request,
  env: Env,
  sql: any,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json() as {
      amount: number;
      currency: string;
      paymentMethodId: string;
      description?: string;
      metadata?: any;
    };

    // Mock payment processing (would integrate with actual payment processor)
    const payment = await sql`
      INSERT INTO payments (
        user_id, amount, currency, payment_method_id, 
        status, description, metadata, created_at
      )
      VALUES (
        ${user.id}, ${body.amount}, ${body.currency}, ${body.paymentMethodId},
        'completed', ${body.description || 'Payment'}, ${JSON.stringify(body.metadata || {})}, NOW()
      )
      RETURNING *
    `;

    // Update user balance if applicable
    if (body.description === 'Credit Purchase') {
      await sql`
        UPDATE users 
        SET credits_balance = COALESCE(credits_balance, 0) + ${body.amount}
        WHERE id = ${user.id}
      `;
    }

    return new Response(JSON.stringify({
      success: true,
      payment: {
        id: payment[0].id,
        amount: payment[0].amount,
        currency: payment[0].currency,
        status: payment[0].status,
        transactionId: `txn_${Date.now()}`
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Payment processing failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleStreamMedia(
  request: Request,
  mediaId: string,
  env: Env,
  sql: any,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Get media metadata
    const media = await sql`
      SELECT * FROM media_files WHERE id = ${mediaId}
    `;

    if (media.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Media not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check access permissions (simplified)
    const user = await getUserFromAuth(request, env);
    
    // Return streaming URL (would be actual CDN URL in production)
    const streamingUrl = `https://cdn.pitchey.com/stream/${mediaId}`;

    // Log media access
    await sql`
      INSERT INTO file_access_logs (file_id, user_id, access_type)
      VALUES (${mediaId}, ${user?.id || null}, 'stream')
    `;

    return new Response(JSON.stringify({
      success: true,
      streamingUrl,
      metadata: {
        duration: media[0].metadata?.duration || 0,
        resolution: media[0].metadata?.resolution || '1080p',
        format: media[0].file_type
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get streaming URL'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleEngagementMetrics(
  request: Request,
  env: Env,
  sql: any,
  url: URL,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const dateRange = url.searchParams.get('range') || '30d';
    const granularity = url.searchParams.get('granularity') || 'daily';

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch(dateRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get engagement metrics
    const engagement = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(CASE WHEN event_name = 'pitch_view' THEN 1 ELSE 0 END) as pitch_views,
        SUM(CASE WHEN event_name = 'pitch_like' THEN 1 ELSE 0 END) as pitch_likes,
        SUM(CASE WHEN event_name = 'pitch_share' THEN 1 ELSE 0 END) as pitch_shares
      FROM user_analytics_events 
      WHERE created_at >= ${startDate.toISOString()} 
        AND created_at <= ${endDate.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return new Response(JSON.stringify({
      success: true,
      dateRange: { start: startDate, end: endDate },
      engagement,
      summary: {
        totalEvents: engagement.reduce((sum, day) => sum + parseInt(day.total_events), 0),
        uniqueUsers: [...new Set(engagement.map(day => day.unique_users))].length,
        avgDailyViews: engagement.reduce((sum, day) => sum + parseInt(day.pitch_views), 0) / engagement.length || 0
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch engagement metrics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Placeholder implementations for remaining functions
async function handleGetSubscriptions(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, subscriptions: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleCreateSubscription(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, subscriptionId: `sub_${Date.now()}` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleCancelSubscription(request: Request, subscriptionId: string, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, message: 'Subscription cancelled' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleGetInvoices(request: Request, env: Env, sql: any, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, invoices: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleGenerateInvoice(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, invoiceId: `inv_${Date.now()}` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleProcessRefund(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, refundId: `ref_${Date.now()}` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handlePaymentWebhook(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, message: 'Webhook processed' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleGetPaymentMethods(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, paymentMethods: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleAddPaymentMethod(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, paymentMethodId: `pm_${Date.now()}` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleCreateEscrow(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, escrowId: `esc_${Date.now()}` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleGenerateThumbnail(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, thumbnailUrl: `https://cdn.pitchey.com/thumb_${Date.now()}.jpg` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleTranscodeVideo(request: Request, env: Env, sql: any, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, jobId: `job_${Date.now()}`, status: 'processing' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleGetSubtitles(request: Request, mediaId: string, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, subtitles: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleUploadSubtitles(request: Request, mediaId: string, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, subtitleId: `sub_${Date.now()}` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleMediaAnalytics(request: Request, mediaId: string, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, analytics: {} }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handlePurgeCache(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, message: 'Cache purged' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleWatermarkMedia(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, watermarkedUrl: `https://cdn.pitchey.com/watermarked_${Date.now()}.jpg` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleCompressFile(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, compressedUrl: `https://cdn.pitchey.com/compressed_${Date.now()}.jpg` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleGeneratePreview(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, previewUrl: `https://cdn.pitchey.com/preview_${Date.now()}.gif` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleConversionAnalysis(request: Request, env: Env, sql: any, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, conversion: {} }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleCohortAnalysis(request: Request, env: Env, sql: any, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, cohorts: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleRevenueAnalytics(request: Request, env: Env, sql: any, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, revenue: {} }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleGeographicAnalytics(request: Request, sql: any, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, geographic: {} }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleDeviceAnalytics(request: Request, sql: any, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, devices: {} }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handlePerformanceMetrics(request: Request, env: Env, sql: any, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, performance: {} }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handlePredictiveAnalytics(request: Request, env: Env, sql: any, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, predictions: {} }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleCustomMetrics(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, metricId: `metric_${Date.now()}` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleRealTimeAnalytics(request: Request, env: Env, sql: any, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, realtime: {} }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handleScheduledReports(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, reports: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function handlePerformanceAlerts(request: Request, env: Env, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({ success: true, alerts: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}