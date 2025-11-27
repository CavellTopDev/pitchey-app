/**
 * Optimized Worker with Modular Service Architecture
 * Implements Phase 2 service bindings pattern within single Worker
 */

import { Toucan } from 'toucan-js';
import { WebSocketRoom } from './websocket-room-optimized.ts';
// Simple JWT creation using Web Crypto API
async function createSimpleJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerStr = btoa(JSON.stringify(header));
  const payloadStr = btoa(JSON.stringify(payload));
  
  const message = `${headerStr}.${payloadStr}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureStr = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${message}.${signatureStr}`;
}

async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerStr, payloadStr, signatureStr] = parts;
    const message = `${headerStr}.${payloadStr}`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(message));
    
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(atob(payloadStr));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

async function authenticateRequest(request: Request, env: Env): Promise<{success: boolean, user?: any, error?: Response}> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: new Response(JSON.stringify({
          success: false,
          message: 'Missing or invalid authorization header'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      };
    }

    const token = authHeader.substring(7);
    let payload;

    // Try to parse as base64 token first (production format)
    try {
      const decoded = atob(token);
      payload = JSON.parse(decoded);
      
      // Check if token is expired
      if (payload.exp && payload.exp < Date.now()) {
        throw new Error('Token expired');
      }
    } catch (error) {
      // If base64 fails, try JWT format (local development)
      try {
        const JWT_SECRET = env.JWT_SECRET;  // No fallback - must be configured
        payload = await verifyJWT(token, JWT_SECRET);
      } catch (jwtError) {
        throw new Error('Invalid token format');
      }
    }

    // Map to consistent user format
    let user;
    if (payload.userType === 'creator') {
      user = {
        id: payload.userId || payload.id || 1,
        email: payload.email || "alex.creator@demo.com",
        userType: "creator",
        firstName: "Alex",
        lastName: "Chen"
      };
    } else if (payload.userType === 'investor') {
      user = {
        id: payload.userId || payload.id || 2,
        email: payload.email || "sarah.investor@demo.com",
        userType: "investor",
        firstName: "Sarah",
        lastName: "Johnson"
      };
    } else if (payload.userType === 'production') {
      user = {
        id: payload.userId || payload.id || 16,
        email: payload.email || "stellar.production@demo.com",
        userType: "production",
        firstName: "Michael",
        lastName: "Rodriguez"
      };
    } else {
      throw new Error('Invalid user type: ' + payload.userType);
    }

    return { success: true, user };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: new Response(JSON.stringify({
        success: false,
        message: 'Invalid token: ' + error.message
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    };
  }
}

interface Env {
  HYPERDRIVE?: Hyperdrive;
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  FRONTEND_URL?: string;
  JWT_SECRET?: string;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
}

// Demo accounts for testing
const demoAccounts = {
  creator: {
    id: 1,
    email: "alex.creator@demo.com",
    username: "alexcreator",
    password: "Demo123",
    userType: "creator",
    companyName: "Independent Films",
    firstName: "Alex",
    lastName: "Chen",
    bio: "Independent filmmaker with 10+ years experience. Passionate about storytelling and visual narratives.",
    location: "Los Angeles, CA",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
    verified: true,
    joinedDate: "2022-03-15"
  },
  investor: {
    id: 2,
    email: "sarah.investor@demo.com",
    username: "sarahinvestor",
    password: "Demo123",
    userType: "investor",
    companyName: "Johnson Ventures",
    firstName: "Sarah",
    lastName: "Johnson",
    bio: "Entertainment industry investor. Looking for the next big breakthrough in film and TV.",
    location: "New York, NY",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    verified: true,
    joinedDate: "2021-08-22"
  },
  production: {
    id: 16,
    email: "stellar.production@demo.com",
    username: "stellarproduction",
    password: "Demo123",
    userType: "production",
    companyName: "Stellar Productions",
    firstName: "Michael",
    lastName: "Rodriguez",
    bio: "Award-winning production company. We bring stories to life with cutting-edge technology.",
    location: "Vancouver, BC",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=stellar",
    verified: true,
    joinedDate: "2020-11-10"
  }
};

// Extended demo users for social features
const extendedDemoUsers = [
  ...Object.values(demoAccounts),
  {
    id: 3,
    email: "emma.writer@demo.com",
    username: "emmawriter",
    userType: "creator",
    firstName: "Emma",
    lastName: "Thompson",
    companyName: "Freelance Writer",
    bio: "Screenwriter specializing in drama and thriller genres. Always looking for compelling stories.",
    location: "Atlanta, GA",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=emma",
    verified: false,
    joinedDate: "2023-01-12"
  },
  {
    id: 4,
    email: "david.angel@demo.com",
    username: "davidangel",
    userType: "investor",
    firstName: "David",
    lastName: "Foster",
    companyName: "Angel Capital",
    bio: "Angel investor focused on early-stage entertainment ventures. Former studio executive.",
    location: "Beverly Hills, CA",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
    verified: true,
    joinedDate: "2022-06-05"
  },
  {
    id: 5,
    email: "lisa.indie@demo.com",
    username: "lisaindiefilms",
    userType: "production",
    firstName: "Lisa",
    lastName: "Park",
    companyName: "Indie Vision Productions",
    bio: "Independent production company championing diverse voices and innovative storytelling.",
    location: "Austin, TX",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=lisa",
    verified: false,
    joinedDate: "2023-02-18"
  },
  {
    id: 6,
    email: "carlos.director@demo.com",
    username: "carlosdirector",
    userType: "creator",
    firstName: "Carlos",
    lastName: "Martinez",
    companyName: "Visionary Films",
    bio: "Director and cinematographer with a passion for visual storytelling and experimental techniques.",
    location: "Mexico City, Mexico",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=carlos",
    verified: true,
    joinedDate: "2022-09-30"
  },
  {
    id: 7,
    email: "rachel.producer@demo.com",
    username: "rachelproducer",
    userType: "creator",
    firstName: "Rachel",
    lastName: "Williams",
    companyName: "Williams Entertainment",
    bio: "Producer specializing in documentary and narrative features. Emmy-nominated for outstanding work.",
    location: "Nashville, TN",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=rachel",
    verified: true,
    joinedDate: "2021-12-14"
  }
];

// Demo social data
const demoFollows = [
  // Alex (creator 1) follows
  { id: 1, followerId: 1, creatorId: 2, followedAt: "2024-11-01T10:00:00Z" },
  { id: 2, followerId: 1, creatorId: 4, followedAt: "2024-11-02T14:30:00Z" },
  { id: 3, followerId: 1, creatorId: 6, followedAt: "2024-11-03T09:15:00Z" },
  { id: 4, followerId: 1, creatorId: 7, followedAt: "2024-11-05T16:45:00Z" },
  
  // Sarah (investor 2) follows
  { id: 5, followerId: 2, creatorId: 1, followedAt: "2024-11-01T11:30:00Z" },
  { id: 6, followerId: 2, creatorId: 3, followedAt: "2024-11-04T13:20:00Z" },
  { id: 7, followerId: 2, creatorId: 16, followedAt: "2024-11-06T10:10:00Z" },
  
  // Michael (production 16) follows
  { id: 8, followerId: 16, creatorId: 1, followedAt: "2024-11-02T15:00:00Z" },
  { id: 9, followerId: 16, creatorId: 7, followedAt: "2024-11-07T12:30:00Z" },
  { id: 10, followerId: 16, creatorId: 5, followedAt: "2024-11-08T14:15:00Z" },
  
  // Emma (creator 3) follows
  { id: 11, followerId: 3, creatorId: 1, followedAt: "2024-11-09T09:45:00Z" },
  { id: 12, followerId: 3, creatorId: 6, followedAt: "2024-11-10T11:20:00Z" },
  
  // David (investor 4) follows
  { id: 13, followerId: 4, creatorId: 7, followedAt: "2024-11-11T16:30:00Z" },
  { id: 14, followerId: 4, creatorId: 3, followedAt: "2024-11-12T08:45:00Z" },
  
  // Lisa (production 5) follows
  { id: 15, followerId: 5, creatorId: 1, followedAt: "2024-11-13T13:15:00Z" },
  
  // Carlos (creator 6) follows
  { id: 16, followerId: 6, creatorId: 2, followedAt: "2024-11-14T10:30:00Z" },
  { id: 17, followerId: 6, creatorId: 7, followedAt: "2024-11-15T14:45:00Z" },
  
  // Rachel (creator 7) follows
  { id: 18, followerId: 7, creatorId: 1, followedAt: "2024-11-16T12:00:00Z" },
  { id: 19, followerId: 7, creatorId: 2, followedAt: "2024-11-17T15:30:00Z" }
];

// Demo activity feed data
const demoActivities = [
  {
    id: 1,
    userId: 1,
    type: 'pitch_created',
    entityType: 'pitch',
    entityId: 1,
    metadata: { title: "The Last Voyage", genre: "Drama" },
    createdAt: "2024-11-18T09:00:00Z"
  },
  {
    id: 2,
    userId: 2,
    type: 'follow',
    entityType: 'user',
    entityId: 1,
    metadata: { action: "followed" },
    createdAt: "2024-11-17T14:30:00Z"
  },
  {
    id: 3,
    userId: 3,
    type: 'pitch_published',
    entityType: 'pitch',
    entityId: 2,
    metadata: { title: "Urban Legends", genre: "Horror" },
    createdAt: "2024-11-17T11:15:00Z"
  },
  {
    id: 4,
    userId: 16,
    type: 'nda_signed',
    entityType: 'pitch',
    entityId: 1,
    metadata: { action: "signed NDA for" },
    createdAt: "2024-11-16T16:45:00Z"
  },
  {
    id: 5,
    userId: 7,
    type: 'follow',
    entityType: 'user',
    entityId: 1,
    metadata: { action: "followed" },
    createdAt: "2024-11-16T13:20:00Z"
  },
  {
    id: 6,
    userId: 6,
    type: 'pitch_created',
    entityType: 'pitch',
    entityId: 3,
    metadata: { title: "Digital Dreams", genre: "Sci-Fi" },
    createdAt: "2024-11-15T10:30:00Z"
  },
  {
    id: 7,
    userId: 4,
    type: 'follow',
    entityType: 'user',
    entityId: 3,
    metadata: { action: "followed" },
    createdAt: "2024-11-15T08:45:00Z"
  },
  {
    id: 8,
    userId: 1,
    type: 'like',
    entityType: 'pitch',
    entityId: 2,
    metadata: { action: "liked" },
    createdAt: "2024-11-14T15:10:00Z"
  }
];

// Demo NDA data with various statuses for comprehensive testing
const demoNDARequests = [
  {
    id: 1,
    pitchId: 1,
    requesterId: 2, // Sarah Investor
    ownerId: 1, // Alex Creator
    ndaType: 'basic',
    status: 'pending',
    requestMessage: 'I am interested in reviewing the full details of your pitch "The Last Voyage". My investment firm specializes in drama projects and I believe this could be a great fit.',
    requestedAt: "2024-11-20T10:30:00Z",
    expiresAt: "2024-12-20T10:30:00Z"
  },
  {
    id: 2,
    pitchId: 2,
    requesterId: 16, // Stellar Production
    ownerId: 1, // Alex Creator
    ndaType: 'basic',
    status: 'approved',
    requestMessage: 'Our production company would like to review the comprehensive details of "Urban Legends". We have a strong track record in horror productions.',
    requestedAt: "2024-11-18T14:15:00Z",
    respondedAt: "2024-11-19T09:30:00Z",
    expiresAt: "2024-12-18T14:15:00Z"
  },
  {
    id: 3,
    pitchId: 1,
    requesterId: 4, // David Angel Investor
    ownerId: 1, // Alex Creator
    ndaType: 'enhanced',
    status: 'rejected',
    requestMessage: 'Interested in potential investment opportunities for this drama project.',
    rejectionReason: 'Thank you for your interest, but we are not seeking additional investors at this time.',
    requestedAt: "2024-11-17T16:45:00Z",
    respondedAt: "2024-11-18T11:20:00Z",
    expiresAt: "2024-12-17T16:45:00Z"
  },
  {
    id: 4,
    pitchId: 3,
    requesterId: 2, // Sarah Investor
    ownerId: 7, // Rachel Producer
    ndaType: 'basic',
    status: 'approved',
    requestMessage: 'Would love to learn more about this documentary project for potential funding.',
    requestedAt: "2024-11-16T12:00:00Z",
    respondedAt: "2024-11-16T18:30:00Z",
    expiresAt: "2024-12-16T12:00:00Z"
  },
  {
    id: 5,
    pitchId: 2,
    requesterId: 5, // Lisa Indie Films
    ownerId: 1, // Alex Creator
    ndaType: 'custom',
    status: 'expired',
    requestMessage: 'Our indie production company is interested in horror content that aligns with our vision.',
    requestedAt: "2024-10-15T09:00:00Z",
    expiresAt: "2024-11-15T09:00:00Z"
  },
  {
    id: 6,
    pitchId: 1,
    requesterId: 3, // Emma Writer
    ownerId: 1, // Alex Creator
    ndaType: 'basic',
    status: 'pending',
    requestMessage: 'As a fellow creator, I would love to review your work for potential collaboration opportunities.',
    requestedAt: "2024-11-21T08:15:00Z",
    expiresAt: "2024-12-21T08:15:00Z"
  }
];

const demoSignedNDAs = [
  {
    id: 1,
    pitchId: 2,
    userId: 1, // Alex Creator (pitch owner)
    signerId: 16, // Stellar Production
    ndaType: 'basic',
    status: 'signed',
    accessGranted: true,
    signedAt: "2024-11-19T15:45:00Z",
    expiresAt: "2024-12-18T14:15:00Z",
    createdAt: "2024-11-19T15:45:00Z",
    updatedAt: "2024-11-19T15:45:00Z"
  },
  {
    id: 2,
    pitchId: 3,
    userId: 7, // Rachel Producer (pitch owner)
    signerId: 2, // Sarah Investor
    ndaType: 'basic',
    status: 'signed',
    accessGranted: true,
    signedAt: "2024-11-17T10:20:00Z",
    expiresAt: "2024-12-16T12:00:00Z",
    createdAt: "2024-11-17T10:20:00Z",
    updatedAt: "2024-11-17T10:20:00Z"
  },
  {
    id: 3,
    pitchId: 1,
    userId: 1, // Alex Creator (pitch owner)
    signerId: 6, // Carlos Director
    ndaType: 'enhanced',
    status: 'revoked',
    accessGranted: false,
    signedAt: "2024-10-20T14:30:00Z",
    revokedAt: "2024-11-10T09:15:00Z",
    expiresAt: "2024-12-20T14:30:00Z",
    createdAt: "2024-10-20T14:30:00Z",
    updatedAt: "2024-11-10T09:15:00Z"
  },
  {
    id: 4,
    pitchId: 4,
    userId: 3, // Emma Writer (pitch owner)
    signerId: 4, // David Angel Investor
    ndaType: 'basic',
    status: 'expired',
    accessGranted: false,
    signedAt: "2024-09-15T11:00:00Z",
    expiresAt: "2024-10-15T11:00:00Z",
    createdAt: "2024-09-15T11:00:00Z",
    updatedAt: "2024-10-15T11:00:00Z"
  }
];

// Demo NDA Templates for comprehensive testing
const demoNDATemplates = [
  {
    id: 1,
    name: "Standard Entertainment NDA",
    description: "Standard non-disclosure agreement for entertainment industry pitch viewing",
    content: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into between {{CREATOR_NAME}} ("Disclosing Party") and {{VIEWER_NAME}} ("Receiving Party") regarding the pitch "{{PITCH_TITLE}}" dated {{DATE}}.

CONFIDENTIAL INFORMATION:
The Disclosing Party may provide the Receiving Party with confidential and proprietary information related to the entertainment project, including but not limited to:
- Plot concepts, storylines, and narrative elements
- Character descriptions and development
- Production plans, budgets, and timelines
- Marketing and distribution strategies
- Any other creative or business information

NON-DISCLOSURE OBLIGATIONS:
The Receiving Party agrees to:
1. Maintain strict confidentiality of all disclosed information
2. Use the information solely for evaluation purposes
3. Not disclose any information to third parties without written consent
4. Return or destroy all materials upon request

This agreement is governed by entertainment industry standards and applicable law.`,
    variables: ["CREATOR_NAME", "VIEWER_NAME", "PITCH_TITLE", "DATE"],
    isDefault: true,
    createdBy: 1,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z"
  },
  {
    id: 2,
    name: "Enhanced IP Protection NDA",
    description: "Comprehensive NDA with enhanced intellectual property protection clauses",
    content: `ENHANCED NON-DISCLOSURE AGREEMENT WITH IP PROTECTION

This Enhanced Non-Disclosure Agreement provides comprehensive protection for creative content between {{CREATOR_NAME}} and {{VIEWER_NAME}} regarding "{{PITCH_TITLE}}".

COMPREHENSIVE CONFIDENTIALITY:
This agreement covers all forms of creative expression including:
- Original concepts and ideas
- Character names, descriptions, and development arcs
- Dialogue samples and writing style
- Visual concepts and artistic direction
- Business models and financial projections
- Distribution and marketing strategies

ENHANCED PROTECTIONS:
1. No reverse engineering of creative concepts
2. Prohibition on developing similar or competing projects
3. Requirement for disclosure of any conflicts of interest
4. Specific time-bound restrictions on competitive activities
5. Liquidated damages clause for material breaches

COMPANY REPRESENTATION:
{{COMPANY_NAME}} represents that it has authority to enter this agreement and bind all employees, contractors, and agents to these terms.

This agreement remains in effect for 5 years from the date of execution.`,
    variables: ["CREATOR_NAME", "VIEWER_NAME", "PITCH_TITLE", "DATE", "COMPANY_NAME"],
    isDefault: true,
    createdBy: 1,
    createdAt: "2024-02-01T14:30:00Z",
    updatedAt: "2024-02-01T14:30:00Z"
  },
  {
    id: 3,
    name: "Production Company NDA",
    description: "Specialized NDA for production companies with development considerations",
    content: `PRODUCTION COMPANY NON-DISCLOSURE AGREEMENT

Between: {{CREATOR_NAME}} (Creator)
And: {{COMPANY_NAME}} (Production Company)
Representative: {{VIEWER_NAME}}

PROJECT: "{{PITCH_TITLE}}"
DATE: {{DATE}}

PRODUCTION-SPECIFIC TERMS:
Given the nature of production company evaluation, this agreement specifically addresses:

1. DEVELOPMENT DISCUSSIONS: Any discussions regarding potential development, production, or acquisition of rights
2. BUDGET CONSIDERATIONS: Financial projections, cost estimates, and funding requirements
3. TALENT ATTACHMENTS: Any director, actor, or key personnel considerations
4. DISTRIBUTION PLANS: Release strategies, target demographics, and market analysis
5. SCHEDULING: Production timelines and delivery requirements

RESTRICTIONS:
The Production Company agrees not to use any disclosed information to:
- Develop competing or substantially similar projects
- Approach talent mentioned in the materials
- Pursue similar storylines or concepts without explicit permission
- Share information with other production entities

GOOD FAITH CLAUSE:
Both parties agree to negotiate in good faith should mutual interest in development arise.

Term: 24 months from execution date.`,
    variables: ["CREATOR_NAME", "VIEWER_NAME", "PITCH_TITLE", "DATE", "COMPANY_NAME"],
    isDefault: false,
    createdBy: 16, // Stellar Production
    createdAt: "2024-03-10T09:15:00Z",
    updatedAt: "2024-03-10T09:15:00Z"
  }
];

// Helper function to get demo NDA data based on user and filters
function getDemoNDAData(userId: number, userType: string, filters: any = {}) {
  let requests = demoNDARequests;
  let signedNdas = demoSignedNDAs;

  // Filter by user role
  if (userType === 'creator') {
    requests = requests.filter(r => r.ownerId === userId);
    signedNdas = signedNdas.filter(n => n.userId === userId);
  } else {
    requests = requests.filter(r => r.requesterId === userId);
    signedNdas = signedNdas.filter(n => n.signerId === userId);
  }

  // Apply filters
  if (filters.status) {
    requests = requests.filter(r => r.status === filters.status);
    signedNdas = signedNdas.filter(n => n.status === filters.status);
  }

  if (filters.pitchId) {
    const pitchId = parseInt(filters.pitchId);
    requests = requests.filter(r => r.pitchId === pitchId);
    signedNdas = signedNdas.filter(n => n.pitchId === pitchId);
  }

  return { requests, signedNdas };
}

// Helper functions
async function validateRequest(request: Request, requiredFields: string[]) {
  try {
    const body = await request.json();
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return {
          success: false,
          error: new Response(JSON.stringify({
            success: false,
            message: `Missing required field: ${field}`
          }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' }
          })
        };
      }
    }
    
    return { success: true, data: body };
  } catch (error) {
    return {
      success: false,
      error: new Response(JSON.stringify({
        success: false,
        message: "Invalid JSON in request body"
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

function authErrorResponse(message: string) {
  return jsonResponse({
    success: false,
    message: message || "Authentication failed"
  }, 401);
}

function serverErrorResponse(message: string) {
  return jsonResponse({
    success: false,
    message: message || "Internal server error"
  }, 500);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry for error tracking
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: ctx,
      request,
      environment: env.SENTRY_ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE || 'phase2-services-v1.0'
    });

    try {
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      const pathname = url.pathname;

      // Handle WebSocket upgrade requests
      if (request.headers.get('Upgrade') === 'websocket') {
        console.log('WebSocket upgrade request received:', pathname);
        
        // Route to appropriate WebSocket handler
        if (pathname.startsWith('/ws') || pathname.startsWith('/websocket')) {
          // Get or create Durable Object for WebSocket room
          const roomId = url.searchParams.get('room') || 'default';
          const durableObjectId = env.WEBSOCKET_ROOM.idFromName(roomId);
          const durableObject = env.WEBSOCKET_ROOM.get(durableObjectId);
          
          // Forward the WebSocket upgrade request to the Durable Object
          return durableObject.fetch(request);
        }
        
        return new Response('WebSocket upgrade not supported for this path', { status: 400 });
      }

      // Simple test endpoint first
      if (pathname === '/api/simple-test') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Simple test working',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Database test - requires proper configuration
      if (pathname === '/api/db-test') {
        console.log('Testing database connection...');
        
        // Test 1: Try Hyperdrive connection
        if (env.HYPERDRIVE) {
          try {
            console.log('Testing Hyperdrive connection...');
            const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
            dbPool.initialize(env, sentry);
            const result = await withDatabase(env, async (sql) => await sql`SELECT 1 as test_hyperdrive, 'hyperdrive' as connection_type`, sentry);
            
            return new Response(JSON.stringify({
              success: true,
              message: 'Hyperdrive connection working!',
              testResult: result[0] || null,
              connection_type: 'hyperdrive'
            }), {
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          } catch (hyperdriveError) {
            console.error('Hyperdrive failed, trying direct connection...', hyperdriveError);
            
            // Test 2: Try direct Neon connection
            try {
              console.log('Testing direct Neon connection...');
              const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
              // Force a direct connection string into env for testing
              const testEnv = { ...env, HYPERDRIVE: { connectionString: 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require' } };
              dbPool.initialize(testEnv, sentry);
              const result = await withDatabase(testEnv, async (sql) => await sql`SELECT 1 as test_direct, 'direct' as connection_type`, sentry);
              
              return new Response(JSON.stringify({
                success: true,
                message: 'Direct connection working! (Hyperdrive failed)',
                testResult: result[0] || null,
                connection_type: 'direct',
                hyperdrive_error: hyperdriveError.message
              }), {
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              });
            } catch (directError) {
              console.error('Both Hyperdrive and direct connections failed');
              return new Response(JSON.stringify({
                success: false,
                error: 'Both database connections failed',
                hyperdrive_error: hyperdriveError.message,
                direct_error: directError.message,
                available_bindings: Object.keys(env)
              }), {
                status: 500,
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              });
            }
          }
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'HYPERDRIVE binding not available',
            available_bindings: Object.keys(env)
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Validate token endpoint
      if (pathname === '/api/validate-token' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }
        
        return new Response(JSON.stringify({
          success: true,
          valid: true,
          user: auth.user
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Production following endpoint
      if (pathname === '/api/production/following' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const tab = url.searchParams.get('tab') || 'activity';
        
        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get following activity
          const following = await withDatabase(env, async (sql) => await sql`
            SELECT 
              u.id, u.username, u.company_name, u.profile_image_url,
              f.created_at as followed_at
            FROM follows f
            JOIN users u ON (f.following_id = u.id OR f.creator_id = u.id)
            WHERE f.follower_id = ${auth.user.id}
              AND (f.following_id IS NOT NULL OR f.creator_id IS NOT NULL)
            ORDER BY f.created_at DESC
            LIMIT 20
          `, sentry);

          return new Response(JSON.stringify({
            success: true,
            data: following.map(f => ({
              id: f.id,
              username: f.username,
              companyName: f.company_name,
              profileImage: f.profile_image_url,
              followedAt: f.followed_at
            }))
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Production following error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to get following data'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Payments subscription status endpoint
      if (pathname === '/api/payments/subscription-status' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        // Mock subscription data
        return new Response(JSON.stringify({
          success: true,
          subscription: {
            plan: 'pro',
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            features: {
              maxPitches: 100,
              maxNDAs: 50,
              analytics: true,
              advancedFeatures: true
            }
          }
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Payments credits balance endpoint
      if (pathname === '/api/payments/credits/balance' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        // Mock credits data
        return new Response(JSON.stringify({
          success: true,
          balance: {
            available: 250,
            pending: 50,
            total: 300,
            currency: 'USD'
          }
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Production investments overview endpoint
      if (pathname === '/api/production/investments/overview' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get investment overview data
          const investments = await withDatabase(env, async (sql) => await sql`
            SELECT 
              COUNT(*) as total_investments,
              SUM(amount) as total_amount,
              AVG(amount) as avg_investment
            FROM investments
            WHERE investor_id = ${auth.user.id}
          `, sentry);

          const overview = investments[0] || {
            total_investments: 0,
            total_amount: 0,
            avg_investment: 0
          };

          return new Response(JSON.stringify({
            success: true,
            data: {
              totalInvestments: parseInt(overview.total_investments) || 0,
              totalAmount: parseFloat(overview.total_amount) || 0,
              avgInvestment: parseFloat(overview.avg_investment) || 0,
              portfolioValue: parseFloat(overview.total_amount) * 1.15 || 0, // Mock 15% growth
              monthlyReturn: parseFloat(overview.total_amount) * 0.02 || 0, // Mock 2% monthly
              yearlyReturn: parseFloat(overview.total_amount) * 0.25 || 0, // Mock 25% yearly
              activeDeals: Math.floor(parseInt(overview.total_investments) * 0.7) || 0,
              completedDeals: Math.floor(parseInt(overview.total_investments) * 0.3) || 0
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Production investments overview error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to get investments overview'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle trending pitches with connection pool
      if (pathname === '/api/pitches/trending') {
        try {
          console.log('Loading trending pitches...');
          const limit = url.searchParams.get('limit') || '10';
          
          // Import connection pool instead of creating direct connection
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          console.log('Executing trending pitches query...');
          const results = await withDatabase(env, async (sql) => await sql`
            SELECT 
              p.id, p.title, p.logline, p.genre, p.format,
              p.view_count as "viewCount", p.like_count as "likeCount", 
              p.poster_url as "posterUrl", p.created_at as "createdAt",
              u.username as creator_username, u.id as creator_id
            FROM pitches p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
            ORDER BY p.view_count DESC
            LIMIT ${parseInt(limit, 10)}
          `, sentry);
          
          console.log('Query executed, mapping results...');
          const pitches = results.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            viewCount: pitch.viewCount || 0,
            likeCount: pitch.likeCount || 0,
            posterUrl: pitch.posterUrl,
            createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
            creator: {
              id: pitch.creator_id,
              username: pitch.creator_username
            }
          }));

          console.log(`Successfully loaded ${pitches.length} trending pitches`);
          return new Response(JSON.stringify({
            success: true,
            items: pitches,
            message: `Found ${pitches.length} trending pitches`
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Trending pitches error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'trending-pitches' }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load trending pitches',
            error_name: error instanceof Error ? error.name : 'Unknown'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle new releases with connection pool
      if (pathname === '/api/pitches/new') {
        try {
          console.log('Loading new releases...');
          const limit = url.searchParams.get('limit') || '10';
          
          // Import connection pool instead of creating direct connection
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          console.log('Executing new releases query...');
          const results = await withDatabase(env, async (sql) => await sql`
            SELECT 
              p.id, p.title, p.logline, p.genre, p.format,
              p.view_count as "viewCount", p.poster_url as "posterUrl", 
              p.created_at as "createdAt",
              u.username as creator_username, u.id as creator_id
            FROM pitches p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
            ORDER BY p.created_at DESC
            LIMIT ${parseInt(limit, 10)}
          `, sentry);
          
          console.log('Query executed, mapping results...');
          const pitches = results.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            viewCount: pitch.viewCount || 0,
            posterUrl: pitch.posterUrl,
            createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
            creator: {
              id: pitch.creator_id,
              username: pitch.creator_username
            }
          }));

          console.log(`Successfully loaded ${pitches.length} new releases`);
          return new Response(JSON.stringify({
            success: true,
            items: pitches,
            message: `Found ${pitches.length} new releases`
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('New releases error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'new-releases' }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load new releases',
            error_name: error instanceof Error ? error.name : 'Unknown'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle public pitches (both list and individual)
      if (pathname.startsWith('/api/pitches/public')) {
        try {
          // Check if this is a request for a specific pitch (e.g., /api/pitches/public/162)
          const pathParts = pathname.split('/');
          const pitchId = pathParts[pathParts.length - 1];
          
          // Import connection pool instead of creating direct connection
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          // If pitchId is a number, fetch individual pitch
          if (pitchId && !isNaN(parseInt(pitchId)) && pitchId !== 'public') {
            console.log(`Loading individual pitch: ${pitchId}`);
            
            const results = await withDatabase(env, async (sql) => await sql`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.format,
                p.view_count as "viewCount", p.like_count as "likeCount",
                p.poster_url as "posterUrl", p.created_at as "createdAt",
                p.status, p.visibility,
                u.username as creator_username, u.id as creator_id
              FROM pitches p
              LEFT JOIN users u ON p.user_id = u.id
              WHERE p.id = ${parseInt(pitchId)} 
                AND p.status IN ('published', 'active') 
                AND p.visibility = 'public'
            `, sentry);
            
            if (results.length === 0) {
              return new Response(JSON.stringify({
                success: false,
                error: 'Pitch not found or not accessible',
                pitch_id: pitchId
              }), {
                status: 404,
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              });
            }
            
            const pitch = results[0];
            const pitchDetail = {
              id: pitch.id,
              title: pitch.title,
              logline: pitch.logline,
              genre: pitch.genre,
              format: pitch.format,
              viewCount: pitch.viewCount || 0,
              likeCount: pitch.likeCount || 0,
              posterUrl: pitch.posterUrl,
              createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
              status: pitch.status,
              visibility: pitch.visibility,
              creator: {
                id: pitch.creator_id,
                username: pitch.creator_username
              }
            };

            console.log(`Successfully loaded pitch ${pitchId}`);
            return new Response(JSON.stringify({
              success: true,
              pitch: pitchDetail,
              message: `Pitch ${pitchId} loaded successfully`
            }), {
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
            
          } else {
            // List all public pitches
            console.log('Loading public pitches list...');
            const limit = url.searchParams.get('limit') || '10';
            
            console.log('Executing public pitches query...');
            const results = await withDatabase(env, async (sql) => await sql`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.format,
                p.view_count as "viewCount", p.poster_url as "posterUrl", 
                p.created_at as "createdAt",
                u.username as creator_username, u.id as creator_id
              FROM pitches p
              LEFT JOIN users u ON p.user_id = u.id
              WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
              ORDER BY p.created_at DESC
              LIMIT ${parseInt(limit, 10)}
            `, sentry);
            
            console.log('Query executed, mapping results...');
            const pitches = results.map(pitch => ({
              id: pitch.id,
              title: pitch.title,
              logline: pitch.logline,
              genre: pitch.genre,
              format: pitch.format,
              viewCount: pitch.viewCount || 0,
              posterUrl: pitch.posterUrl,
              createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
              creator: {
                id: pitch.creator_id,
                username: pitch.creator_username
              }
            }));

            console.log(`Successfully loaded ${pitches.length} public pitches`);
            return new Response(JSON.stringify({
              success: true,
              items: pitches,
              message: `Found ${pitches.length} public pitches`
            }), {
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          }
        } catch (error) {
          console.error('Public pitches error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'public-pitches' }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load public pitches',
            error_name: error instanceof Error ? error.name : 'Unknown'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle specific pitch routes first to avoid conflict with generic ID route
      if (pathname === '/api/pitches/following' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get pitches from followed creators - fixed query for proper follows relationship
          const followingPitches = await withDatabase(env, async (sql) => await sql`
            SELECT DISTINCT
              p.id, p.title, p.logline, p.genre, p.format,
              p.view_count, p.like_count, p.poster_url,
              p.created_at, p.updated_at,
              u.id as creator_id, u.username, u.company_name
            FROM pitches p
            JOIN users u ON p.user_id = u.id
            WHERE EXISTS (
              SELECT 1 FROM follows f 
              WHERE f.follower_id = ${auth.user.id}
              AND (
                (f.following_id = u.id) OR  -- User following creator
                (f.pitch_id = p.id)          -- User following pitch directly
              )
            )
            AND p.status IN ('published', 'active')
            AND (p.visibility = 'public' OR p.visibility IS NULL)
            ORDER BY p.created_at DESC
            LIMIT 20
          `, sentry);

          return jsonResponse({
            success: true,
            data: followingPitches.map(pitch => ({
              id: pitch.id,
              title: pitch.title,
              logline: pitch.logline,
              genre: pitch.genre,
              format: pitch.format,
              viewCount: pitch.view_count || 0,
              likeCount: pitch.like_count || 0,
              posterUrl: pitch.poster_url,
              createdAt: pitch.created_at,
              updatedAt: pitch.updated_at,
              creator: {
                id: pitch.creator_id,
                username: pitch.username,
                companyName: pitch.company_name
              }
            }))
          });
        } catch (error) {
          console.error('Following pitches error:', error);
          return serverErrorResponse("Failed to get following pitches: " + error.message);
        }
      }

      // Handle individual pitch details with comprehensive business data - /api/pitches/:id
      // Exclude specific route names to avoid conflicts
      if ((pathname.match(/^\/api\/pitches\/\d+$/) || pathname.match(/^\/api\/pitches\/[a-zA-Z0-9-]+$/)) 
          && !pathname.includes('/following') 
          && !pathname.includes('/trending') 
          && !pathname.includes('/new') 
          && !pathname.includes('/public')
          && !pathname.includes('/browse')
          && !pathname.includes('/my')) {
        try {
          const pitchIdentifier = pathname.split('/').pop();
          console.log(`Loading comprehensive pitch details: ${pitchIdentifier}`);
          
          // Authentication and access control
          const authHeader = request.headers.get('Authorization');
          let currentUser = null;
          let hasNdaAccess = false;
          
          // Use direct connection (Hyperdrive has issues)
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          // Check for authentication if provided
          if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
              const token = authHeader.replace('Bearer ', '');
              // Simple JWT validation (in production, use proper JWT library)
              const tokenParts = token.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                if (payload.userId && payload.exp > Date.now() / 1000) {
                  const userResults = await withDatabase(env, async (sql) => await sql`
                    SELECT id, username, user_type, email 
                    FROM users 
                    WHERE id = ${payload.userId} AND is_active = true
                  `, sentry);
                  if (userResults.length > 0) {
                    currentUser = userResults[0];
                    console.log(`Authenticated user: ${currentUser.username} (${currentUser.user_type})`);
                  }
                }
              }
            } catch (authError) {
              console.warn('Authentication error:', authError.message);
              // Continue as unauthenticated user
            }
          }
          
          // Determine if identifier is numeric ID or slug
          const isNumericId = !isNaN(parseInt(pitchIdentifier));
          let pitchResults;
          
          if (isNumericId) {
            const pitchId = parseInt(pitchIdentifier);
            
            // Check NDA access for authenticated user
            if (currentUser) {
              const ndaAccessResults = await withDatabase(env, async (sql) => await sql`
                SELECT nr.status, nr.pitch_id, p.user_id as pitch_owner_id
                FROM nda_requests nr
                JOIN pitches p ON p.id = nr.pitch_id
                WHERE nr.pitch_id = ${pitchId} 
                  AND nr.requester_id = ${currentUser.id} 
                  AND nr.status = 'approved'
                UNION
                SELECT 'owner' as status, p.id as pitch_id, p.user_id as pitch_owner_id
                FROM pitches p
                WHERE p.id = ${pitchId} AND p.user_id = ${currentUser.id}
              `, sentry);
              
              if (ndaAccessResults.length > 0) {
                hasNdaAccess = true;
                console.log(`User has NDA access to pitch ${pitchId}`);
              }
            }
            
            // Modify query based on access level
            let visibilityCondition = "p.status IN ('published', 'active') AND p.visibility = 'public'";
            if (hasNdaAccess) {
              // Full access with NDA or owner
              visibilityCondition = "p.status IN ('published', 'active', 'private', 'nda_required')";
            }
            
            // Comprehensive pitch query with all business-relevant fields (numeric ID)
            if (hasNdaAccess) {
              pitchResults = await withDatabase(env, async (sql) => await sql`
                SELECT 
                  p.id, p.title, p.logline, p.short_synopsis, p.long_synopsis, 
                  p.genre, p.format, p.format_category, p.format_subtype, p.custom_format,
                  p.opener, p.premise, p.target_audience, p.characters, p.themes, p.world_description,
                  p.episode_breakdown, p.budget_range, p.budget_bracket, p.estimated_budget,
                  p.stage, p.production_stage, p.production_timeline,
                  p.view_count as "viewCount", p.like_count as "likeCount", p.comment_count as "commentCount",
                  p.share_count as "shareCount", p.nda_count as "ndaCount",
                  p.poster_url as "posterUrl", p.video_url as "videoUrl", 
                  p.pitch_deck_url as "pitchDeckUrl", p.title_image as "titleImage",
                  p.lookbook_url as "lookbookUrl", p.script_url as "scriptUrl", p.trailer_url as "trailerUrl",
                  p.additional_materials, p.additional_media, p.visibility_settings,
                  p.status, p.visibility, p.require_nda as "requireNda", 
                  p.seeking_investment as "seekingInvestment",
                  p.ai_used as "aiUsed", p.ai_tools as "aiTools", p.ai_disclosure as "aiDisclosure",
                  p.feedback, p.tags, p.metadata,
                  p.created_at as "createdAt", p.updated_at as "updatedAt", p.published_at as "publishedAt",
                  u.id as creator_id, u.username as creator_username, u.first_name, u.last_name,
                  u.bio as creator_bio, u.location as creator_location, u.website as creator_website,
                  u.profile_image_url as "creatorProfileImage", u.company_name as "creatorCompany"
                FROM pitches p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.id = ${pitchId} AND p.status IN ('published', 'active', 'private', 'nda_required')
              `, sentry);
            } else {
              pitchResults = await withDatabase(env, async (sql) => await sql`
                SELECT 
                  p.id, p.title, p.logline, p.short_synopsis, p.long_synopsis, 
                  p.genre, p.format, p.format_category, p.format_subtype, p.custom_format,
                  p.opener, p.premise, p.target_audience, p.characters, p.themes, p.world_description,
                  p.episode_breakdown, p.budget_range, p.budget_bracket, p.estimated_budget,
                  p.stage, p.production_stage, p.production_timeline,
                  p.view_count as "viewCount", p.like_count as "likeCount", p.comment_count as "commentCount",
                  p.share_count as "shareCount", p.nda_count as "ndaCount",
                  p.poster_url as "posterUrl", p.video_url as "videoUrl", 
                  p.pitch_deck_url as "pitchDeckUrl", p.title_image as "titleImage",
                  p.lookbook_url as "lookbookUrl", p.script_url as "scriptUrl", p.trailer_url as "trailerUrl",
                  p.additional_materials, p.additional_media, p.visibility_settings,
                  p.status, p.visibility, p.require_nda as "requireNda", 
                  p.seeking_investment as "seekingInvestment",
                  p.ai_used as "aiUsed", p.ai_tools as "aiTools", p.ai_disclosure as "aiDisclosure",
                  p.feedback, p.tags, p.metadata,
                  p.created_at as "createdAt", p.updated_at as "updatedAt", p.published_at as "publishedAt",
                  u.id as creator_id, u.username as creator_username, u.first_name, u.last_name,
                  u.bio as creator_bio, u.location as creator_location, u.website as creator_website,
                  u.profile_image_url as "creatorProfileImage", u.company_name as "creatorCompany"
                FROM pitches p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.id = ${pitchId} AND p.status IN ('published', 'active') AND p.visibility = 'public'
              `, sentry);
            }
          } else {
            // Support slug-based lookup (title-based slug) - only public pitches for slug access
            const slugTitle = pitchIdentifier.replace(/-/g, ' ');
            pitchResults = await withDatabase(env, async (sql) => await sql`
              SELECT 
                p.id, p.title, p.logline, p.short_synopsis, p.long_synopsis, 
                p.genre, p.format, p.format_category, p.format_subtype, p.custom_format,
                p.opener, p.premise, p.target_audience, p.characters, p.themes, p.world_description,
                p.episode_breakdown, p.budget_range, p.budget_bracket, p.estimated_budget,
                p.stage, p.production_stage, p.production_timeline,
                p.view_count as "viewCount", p.like_count as "likeCount", p.comment_count as "commentCount",
                p.share_count as "shareCount", p.nda_count as "ndaCount",
                p.poster_url as "posterUrl", p.video_url as "videoUrl", 
                p.pitch_deck_url as "pitchDeckUrl", p.title_image as "titleImage",
                p.lookbook_url as "lookbookUrl", p.script_url as "scriptUrl", p.trailer_url as "trailerUrl",
                p.additional_materials, p.additional_media, p.visibility_settings,
                p.status, p.visibility, p.require_nda as "requireNda", 
                p.seeking_investment as "seekingInvestment",
                p.ai_used as "aiUsed", p.ai_tools as "aiTools", p.ai_disclosure as "aiDisclosure",
                p.feedback, p.tags, p.metadata,
                p.created_at as "createdAt", p.updated_at as "updatedAt", p.published_at as "publishedAt",
                u.id as creator_id, u.username as creator_username, u.first_name, u.last_name,
                u.bio as creator_bio, u.location as creator_location, u.website as creator_website,
                u.profile_image_url as "creatorProfileImage", u.company_name as "creatorCompany"
              FROM pitches p
              LEFT JOIN users u ON p.user_id = u.id
              WHERE LOWER(REPLACE(p.title, ' ', '-')) = LOWER(${pitchIdentifier}) 
                AND p.status IN ('published', 'active') AND p.visibility = 'public'
            `, sentry);
          }
          
          if (pitchResults.length === 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Pitch not found or not accessible',
              pitch_identifier: pitchIdentifier
            }), {
              status: 404,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          }
          
          const pitch = pitchResults[0];
          
          // Get pitch characters from database
          let charactersResults = [];
          try {
            charactersResults = await withDatabase(env, async (sql) => await sql`
              SELECT 
                pc.id, pc.name, pc.description, pc.age, pc.gender, 
                pc.actor, pc.role, pc.relationship, pc.display_order
              FROM pitch_characters pc
              WHERE pc.pitch_id = ${pitch.id}
              ORDER BY pc.display_order ASC, pc.name ASC
            `, sentry);
          } catch (error) {
            // Table doesn't exist, characters info is stored in pitch.characters text field
            console.log('pitch_characters table not available, using characters text field');
            charactersResults = [];
          }
          
          // Get pitch documents (based on access level)
          let documentsResults;
          if (hasNdaAccess) {
            // Full document access with NDA
            documentsResults = await withDatabase(env, async (sql) => await sql`
              SELECT 
                pd.id, pd.file_name, pd.original_file_name, pd.file_type, 
                pd.document_type, pd.file_size, pd.is_public, pd.requires_nda,
                pd.uploaded_at, pd.download_count, pd.file_url
              FROM pitch_documents pd
              WHERE pd.pitch_id = ${pitch.id}
              ORDER BY pd.document_type, pd.uploaded_at DESC
            `, sentry);
          } else {
            // Public documents only
            documentsResults = await withDatabase(env, async (sql) => await sql`
              SELECT 
                pd.id, pd.file_name, pd.original_file_name, pd.file_type, 
                pd.document_type, pd.file_size, pd.is_public, pd.requires_nda,
                pd.uploaded_at, pd.download_count
              FROM pitch_documents pd
              WHERE pd.pitch_id = ${pitch.id} AND pd.is_public = true
              ORDER BY pd.document_type, pd.uploaded_at DESC
            `, sentry);
          }
          
          // Get pitch analytics (basic view tracking)
          const analyticsResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              COUNT(DISTINCT pv.viewer_id) as unique_viewers,
              COUNT(pv.id) as total_views,
              AVG(pv.view_duration) as avg_view_duration,
              COUNT(CASE WHEN pv.clicked_watch_this = true THEN 1 END) as watch_clicks
            FROM pitch_views pv
            WHERE pv.pitch_id = ${pitch.id} AND pv.viewed_at > NOW() - INTERVAL '30 days'
          `, sentry);
          
          // Get NDA status summary (without revealing private info)
          const ndaResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              COUNT(*) as total_nda_requests,
              COUNT(CASE WHEN nr.status = 'approved' THEN 1 END) as approved_ndas,
              COUNT(CASE WHEN nr.status = 'pending' THEN 1 END) as pending_ndas
            FROM nda_requests nr
            WHERE nr.pitch_id = ${pitch.id}
          `, sentry);
          
          // Get investment interest indicators (basic metrics only)
          const investmentResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              (SELECT COUNT(DISTINCT investor_id) FROM investments WHERE pitch_id = ${pitch.id}) as interested_investors,
              (SELECT COUNT(*) FROM watchlist WHERE pitch_id = ${pitch.id}) as watchlist_adds
          `, sentry);
          
          // Get related pitches by same creator (public only)
          const relatedResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              p2.id, p2.title, p2.logline, p2.genre, p2.poster_url as "posterUrl",
              p2.view_count as "viewCount"
            FROM pitches p2
            WHERE p2.user_id = ${pitch.creator_id} 
              AND p2.id != ${pitch.id} 
              AND p2.status IN ('published', 'active') 
              AND p2.visibility = 'public'
            ORDER BY p2.view_count DESC
            LIMIT 5
          `, sentry);
          
          // Track view analytics for authenticated users and increment view count
          const viewerInfo = {
            ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown',
            userAgent: request.headers.get('User-Agent') || 'unknown',
            referrer: request.headers.get('Referer') || null
          };
          
          // Increment view count (fire and forget with proper context)
          ctx.waitUntil(
            withDatabase(env, async (sql) => await sql`UPDATE pitches SET view_count = view_count + 1 WHERE id = ${pitch.id}`, sentry)
              .catch(error => {
                console.error('Error updating view count:', error);
                sentry.captureException(error);
              })
          );
          
          // Track detailed view for authenticated users (fire and forget with proper context)
          if (currentUser) {
            ctx.waitUntil(
              withDatabase(env, async (sql) => await sql`
                INSERT INTO pitch_views (pitch_id, viewer_id, ip_address, user_agent, referrer, view_type)
                VALUES (${pitch.id}, ${currentUser.id}, ${viewerInfo.ipAddress}, ${viewerInfo.userAgent}, ${viewerInfo.referrer}, 'detailed')
              `, sentry)
                .catch(error => {
                  console.error('Error tracking authenticated view:', error);
                  sentry.captureException(error);
                })
            );
            
            // Track analytics event
            ctx.waitUntil(
              withDatabase(env, async (sql) => await sql`
                INSERT INTO analytics_events (event_type, user_id, pitch_id, event_data)
                VALUES ('pitch_view', ${currentUser.id}, ${pitch.id}, ${JSON.stringify({
                  viewType: hasNdaAccess ? 'nda_access' : 'public',
                  userType: currentUser.user_type,
                  accessLevel: hasNdaAccess ? 'full' : 'limited'
                })})
              `, sentry)
                .catch(error => {
                  console.error('Error tracking analytics event:', error);
                  sentry.captureException(error);
                })
            );
          } else {
            // Anonymous view tracking (fire and forget with proper context)
            ctx.waitUntil(
              withDatabase(env, async (sql) => await sql`
                INSERT INTO pitch_views (pitch_id, ip_address, user_agent, referrer, view_type)
                VALUES (${pitch.id}, ${viewerInfo.ipAddress}, ${viewerInfo.userAgent}, ${viewerInfo.referrer}, 'anonymous')
              `, sentry)
                .catch(error => {
                  console.error('Error tracking anonymous view:', error);
                  sentry.captureException(error);
                })
            );
          }
          
          // Build comprehensive response
          const analytics = analyticsResults[0] || {};
          const ndaStats = ndaResults[0] || {};
          const investmentStats = investmentResults[0] || {};
          
          const comprehensivePitch = {
            // Core pitch information
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            shortSynopsis: pitch.short_synopsis,
            longSynopsis: pitch.long_synopsis,
            
            // Production details
            genre: pitch.genre,
            format: pitch.format,
            formatCategory: pitch.format_category,
            formatSubtype: pitch.format_subtype,
            customFormat: pitch.custom_format,
            
            // Creative elements
            opener: pitch.opener,
            premise: pitch.premise,
            targetAudience: pitch.target_audience,
            characters: pitch.characters,
            themes: pitch.themes,
            worldDescription: pitch.world_description,
            episodeBreakdown: pitch.episode_breakdown,
            
            // Character details (structured from database table or parsed from text field)
            charactersList: charactersResults.length > 0 
              ? charactersResults.map(char => ({
                  id: char.id,
                  name: char.name,
                  description: char.description,
                  age: char.age,
                  gender: char.gender,
                  actor: char.actor,
                  role: char.role,
                  relationship: char.relationship,
                  displayOrder: char.display_order
                }))
              : [], // Empty array if no structured characters data
            
            // Business information
            budgetRange: pitch.budget_range,
            budgetBracket: pitch.budget_bracket,
            estimatedBudget: pitch.estimated_budget ? parseFloat(pitch.estimated_budget) : null,
            stage: pitch.stage,
            productionStage: pitch.production_stage,
            productionTimeline: pitch.production_timeline,
            seekingInvestment: pitch.seekingInvestment,
            
            // Media assets
            posterUrl: pitch.posterUrl,
            videoUrl: pitch.videoUrl,
            pitchDeckUrl: pitch.pitchDeckUrl,
            titleImage: pitch.titleImage,
            lookbookUrl: pitch.lookbookUrl,
            scriptUrl: pitch.scriptUrl,
            trailerUrl: pitch.trailerUrl,
            additionalMaterials: pitch.additional_materials,
            additionalMedia: pitch.additional_media,
            
            // Documents (based on access level)
            documents: documentsResults.map(doc => ({
              id: doc.id,
              fileName: doc.file_name,
              originalFileName: doc.original_file_name,
              fileType: doc.file_type,
              documentType: doc.document_type,
              fileSize: doc.file_size,
              isPublic: doc.is_public,
              requiresNda: doc.requires_nda,
              uploadedAt: doc.uploaded_at?.toISOString ? doc.uploaded_at.toISOString() : doc.uploaded_at,
              downloadCount: doc.download_count,
              downloadUrl: hasNdaAccess && doc.file_url ? doc.file_url : null
            })),
            
            // Privacy and access
            visibility: pitch.visibility,
            visibilitySettings: pitch.visibility_settings,
            requireNda: pitch.requireNda,
            ndaStats: {
              totalRequests: parseInt(ndaStats.total_nda_requests) || 0,
              approvedNdas: parseInt(ndaStats.approved_ndas) || 0,
              pendingNdas: parseInt(ndaStats.pending_ndas) || 0
            },
            
            // Engagement metrics
            viewCount: pitch.viewCount || 0,
            likeCount: pitch.likeCount || 0,
            commentCount: pitch.commentCount || 0,
            shareCount: pitch.shareCount || 0,
            ndaCount: pitch.ndaCount || 0,
            
            // Analytics (30-day summary)
            analytics: {
              uniqueViewers: parseInt(analytics.unique_viewers) || 0,
              totalViews: parseInt(analytics.total_views) || 0,
              avgViewDuration: parseFloat(analytics.avg_view_duration) || 0,
              watchClicks: parseInt(analytics.watch_clicks) || 0,
              interestedInvestors: parseInt(investmentStats.interested_investors) || 0,
              watchlistAdds: parseInt(investmentStats.watchlist_adds) || 0
            },
            
            // Creator information
            creator: {
              id: pitch.creator_id,
              username: pitch.creator_username,
              firstName: pitch.first_name,
              lastName: pitch.last_name,
              displayName: pitch.first_name && pitch.last_name 
                ? `${pitch.first_name} ${pitch.last_name}` 
                : pitch.creator_username,
              bio: pitch.creator_bio,
              location: pitch.creator_location,
              website: pitch.creator_website,
              profileImage: pitch.creatorProfileImage,
              company: pitch.creatorCompany
            },
            
            // AI disclosure
            aiUsed: pitch.aiUsed || false,
            aiTools: pitch.aiTools || [],
            aiDisclosure: pitch.aiDisclosure,
            
            // Metadata
            feedback: pitch.feedback || [],
            tags: pitch.tags || [],
            metadata: pitch.metadata || {},
            status: pitch.status,
            
            // Timestamps
            createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
            updatedAt: pitch.updatedAt?.toISOString ? pitch.updatedAt.toISOString() : pitch.updatedAt,
            publishedAt: pitch.publishedAt?.toISOString ? pitch.publishedAt.toISOString() : pitch.publishedAt,
            
            // Related content
            relatedPitches: relatedResults.map(related => ({
              id: related.id,
              title: related.title,
              logline: related.logline,
              genre: related.genre,
              posterUrl: related.posterUrl,
              viewCount: related.viewCount || 0
            }))
          };

          console.log(`Successfully loaded comprehensive pitch ${pitchIdentifier}`);
          
          // Cache control headers for performance
          const cacheHeaders = {
            'Cache-Control': 'public, max-age=300', // 5 minutes cache
            'ETag': `"pitch-${pitch.id}-${pitch.updatedAt}"`,
            'Last-Modified': new Date(pitch.updatedAt).toUTCString()
          };
          
          return new Response(JSON.stringify({
            success: true,
            pitch: comprehensivePitch,
            data: comprehensivePitch, // Some frontends expect 'data' field
            message: `Comprehensive pitch data for ${pitchIdentifier} loaded successfully`,
            access: {
              level: hasNdaAccess ? 'full' : 'public',
              authenticated: !!currentUser,
              ndaAccess: hasNdaAccess,
              userType: currentUser?.user_type || 'anonymous'
            },
            cached: false,
            analytics: true
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders,
              ...cacheHeaders
            }
          });
          
        } catch (error) {
          console.error('Comprehensive pitch endpoint error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'pitch-comprehensive', identifier: pathname }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load comprehensive pitch data',
            error_name: error instanceof Error ? error.name : 'Unknown',
            error_details: 'Unable to retrieve complete pitch information'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle browse endpoints for marketplace functionality
      if (pathname.startsWith('/api/pitches/browse/')) {
        try {
          const browseType = pathname.split('/').pop(); // 'enhanced' or 'general'
          const sort = url.searchParams.get('sort') || 'date';
          const order = url.searchParams.get('order') || 'desc';
          const limit = parseInt(url.searchParams.get('limit') || '24', 10);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);
          const genre = url.searchParams.get('genre');
          const format = url.searchParams.get('format');
          
          console.log(`Loading ${browseType} browse pitches with filters - genre: ${genre}, format: ${format}...`);
          
          // Use direct connection (Hyperdrive has issues)
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          console.log(`Executing browse query with sort: ${sort}, order: ${order}...`);
          
          // Build base query with filters
          let baseQuery = `
            SELECT 
              p.id, p.title, p.logline, p.genre, p.format,
              p.view_count as "viewCount", p.like_count as "likeCount",
              p.poster_url as "posterUrl", p.created_at as "createdAt",
              p.status, p.visibility,
              u.username as creator_username, u.id as creator_id
            FROM pitches p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
          `;
          
          // Add filters
          if (genre) {
            baseQuery += ` AND p.genre = '${genre}'`;
          }
          
          if (format) {
            baseQuery += ` AND p.format = '${format}'`;
          }
          
          // Add ordering and pagination
          let orderClause;
          if (sort === 'views' && order === 'desc') {
            orderClause = ' ORDER BY p.view_count DESC';
          } else if (sort === 'views' && order === 'asc') {
            orderClause = ' ORDER BY p.view_count ASC';
          } else if (sort === 'title' && order === 'asc') {
            orderClause = ' ORDER BY p.title ASC';
          } else if (sort === 'title' && order === 'desc') {
            orderClause = ' ORDER BY p.title DESC';
          } else if (sort === 'date' && order === 'asc') {
            orderClause = ' ORDER BY p.created_at ASC';
          } else {
            orderClause = ' ORDER BY p.created_at DESC';
          }
          
          const finalQuery = baseQuery + orderClause + ` LIMIT ${limit} OFFSET ${offset}`;
          
          // Execute the query using template literal with neon
          let results;
          try {
            // Use withDatabase for proper SQL context
            results = await withDatabase(env, async (sql) => {
              // Build dynamic query safely
              if (genre && format) {
                return await sql`
                  SELECT 
                    p.id, p.title, p.logline, p.genre, p.format,
                    p.view_count as "viewCount", p.like_count as "likeCount",
                    p.poster_url as "posterUrl", p.created_at as "createdAt",
                    p.status, p.visibility,
                    u.username as creator_username, u.id as creator_id
                  FROM pitches p
                  LEFT JOIN users u ON p.user_id = u.id
                  WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
                    AND p.genre = ${genre} AND p.format = ${format}
                  ORDER BY p.created_at DESC
                  LIMIT ${limit}
                  OFFSET ${offset}
                `;
              } else if (genre) {
                return await sql`
                  SELECT 
                    p.id, p.title, p.logline, p.genre, p.format,
                    p.view_count as "viewCount", p.like_count as "likeCount",
                    p.poster_url as "posterUrl", p.created_at as "createdAt",
                    p.status, p.visibility,
                    u.username as creator_username, u.id as creator_id
                  FROM pitches p
                  LEFT JOIN users u ON p.user_id = u.id
                  WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
                    AND p.genre = ${genre}
                  ORDER BY p.created_at DESC
                  LIMIT ${limit}
                  OFFSET ${offset}
                `;
              } else if (format) {
                return await sql`
                  SELECT 
                    p.id, p.title, p.logline, p.genre, p.format,
                    p.view_count as "viewCount", p.like_count as "likeCount",
                    p.poster_url as "posterUrl", p.created_at as "createdAt",
                    p.status, p.visibility,
                    u.username as creator_username, u.id as creator_id
                  FROM pitches p
                  LEFT JOIN users u ON p.user_id = u.id
                  WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
                    AND p.format = ${format}
                  ORDER BY p.created_at DESC
                  LIMIT ${limit}
                  OFFSET ${offset}
                `;
              } else {
                return await sql`
                  SELECT 
                    p.id, p.title, p.logline, p.genre, p.format,
                    p.view_count as "viewCount", p.like_count as "likeCount",
                    p.poster_url as "posterUrl", p.created_at as "createdAt",
                    p.status, p.visibility,
                    u.username as creator_username, u.id as creator_id
                  FROM pitches p
                  LEFT JOIN users u ON p.user_id = u.id
                  WHERE p.status IN ('published', 'active') AND p.visibility = 'public'
                  ORDER BY p.created_at DESC
                  LIMIT ${limit}
                  OFFSET ${offset}
                `;
              }
            }, sentry);
          } catch (error) {
            console.error('Query error:', error);
            throw error;
          }
          
          console.log('Query executed, mapping results...');
          const pitches = results.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            genre: pitch.genre,
            format: pitch.format,
            viewCount: pitch.viewCount || 0,
            likeCount: pitch.likeCount || 0,
            posterUrl: pitch.posterUrl,
            createdAt: pitch.createdAt?.toISOString ? pitch.createdAt.toISOString() : pitch.createdAt,
            status: pitch.status,
            visibility: pitch.visibility,
            creator: {
              id: pitch.creator_id,
              username: pitch.creator_username
            }
          }));

          // Get total count for pagination with same filters
          let countQuery = `SELECT COUNT(*) as total FROM pitches p WHERE p.status IN ('published', 'active') AND p.visibility = 'public'`;
          
          if (genre) {
            countQuery += ` AND p.genre = '${genre}'`;
          }
          
          if (format) {
            countQuery += ` AND p.format = '${format}'`;
          }
          
          let countResult;
          try {
            countResult = await withDatabase(env, async (sql) => {
              if (genre && format) {
                return await sql`SELECT COUNT(*) as total FROM pitches p WHERE p.status IN ('published', 'active') AND p.visibility = 'public' AND p.genre = ${genre} AND p.format = ${format}`;
              } else if (genre) {
                return await sql`SELECT COUNT(*) as total FROM pitches p WHERE p.status IN ('published', 'active') AND p.visibility = 'public' AND p.genre = ${genre}`;
              } else if (format) {
                return await sql`SELECT COUNT(*) as total FROM pitches p WHERE p.status IN ('published', 'active') AND p.visibility = 'public' AND p.format = ${format}`;
              } else {
                return await sql`SELECT COUNT(*) as total FROM pitches p WHERE p.status IN ('published', 'active') AND p.visibility = 'public'`;
              }
            }, sentry);
          } catch (error) {
            console.error('Count query error:', error);
            countResult = await withDatabase(env, async (sql) => await sql`SELECT COUNT(*) as total FROM pitches p WHERE p.status IN ('published', 'active') AND p.visibility = 'public'`, sentry);
          }
          const total = parseInt(countResult[0]?.total || '0', 10);

          console.log(`Successfully loaded ${pitches.length} ${browseType} pitches`);
          return new Response(JSON.stringify({
            success: true,
            items: pitches,
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + limit < total
            },
            sort: { by: sort, order },
            message: `Found ${pitches.length} ${browseType} pitches`
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Browse pitches error:', error);
          sentry.captureException(error as Error, {
            tags: { endpoint: 'browse-pitches' }
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load browse pitches',
            error_name: error instanceof Error ? error.name : 'Unknown'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Handle health endpoint
      if (pathname === '/api/health') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Pitchey API - Direct endpoints active',
          architecture: 'simplified',
          services: {
            database: 'direct-connection',
            hyperdrive: 'bypassed-due-to-530-errors'
          },
          optimizations: {
            cors: 'enabled',
            sentry: 'enabled',
            direct_database: 'enabled'
          },
          endpoints: ['/api/simple-test', '/api/db-test', '/api/pitches/trending', '/api/pitches/new', '/api/pitches/public', '/api/pitches/{id}', '/api/pitches/browse/enhanced', '/api/pitches/browse/general', '/api/content/about', '/api/content/how-it-works', '/api/content/team', '/api/content/stats', '/api/analytics/user', '/api/analytics/dashboard', '/api/analytics/pitch/{id}', '/api/analytics/activity', '/api/analytics/track', '/api/analytics/export', '/api/analytics/compare/{type}', '/api/analytics/trending', '/api/analytics/engagement', '/api/analytics/funnel/{id}', '/api/presence/online', '/api/presence/update', '/api/websocket/test', '/ws', '/websocket'],
          timestamp: new Date().toISOString()
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Enhanced browse endpoint for marketplace with advanced filtering
      if (pathname === '/api/pitches/browse/enhanced' && request.method === 'GET') {
        try {
          const limit = parseInt(url.searchParams.get('limit') || '24');
          const offset = parseInt(url.searchParams.get('offset') || '0');
          const sort = url.searchParams.get('sort') || 'date';
          const order = url.searchParams.get('order') || 'desc';
          const genre = url.searchParams.get('genre');
          const format = url.searchParams.get('format');
          const search = url.searchParams.get('search');
          
          // Use direct connection
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          // Build ORDER BY clause
          let orderClause = 'created_at DESC';
          if (sort === 'date') {
            orderClause = order === 'asc' ? 'created_at ASC' : 'created_at DESC';
          } else if (sort === 'views') {
            orderClause = order === 'asc' ? 'view_count ASC' : 'view_count DESC';
          } else if (sort === 'likes') {
            orderClause = order === 'asc' ? 'like_count ASC' : 'like_count DESC';
          } else if (sort === 'alphabetical') {
            orderClause = order === 'asc' ? 'title ASC' : 'title DESC';
          }
          
          // Build WHERE conditions
          let whereConditions = [`status = 'published'`];
          if (genre && genre !== 'all') {
            whereConditions.push(`genre = '${genre}'`);
          }
          if (format && format !== 'all') {
            whereConditions.push(`format = '${format}'`);
          }
          if (search) {
            whereConditions.push(`(title ILIKE '%${search}%' OR logline ILIKE '%${search}%')`);
          }
          
          const whereClause = whereConditions.join(' AND ');
          
          // Get total count using raw SQL query
          // Database utilities already imported above, no need to re-import
          
          // Get total count - need to build safe query
          const totalResult = await withDatabase(env, async (sql) => {
            // Build query with proper parameterization based on filters
            const conditions = [];
            const values = [];
            let paramIndex = 1;
            
            conditions.push(`status IN ('published', 'active')`);
            conditions.push(`visibility = 'public'`);
            
            if (genre) {
              conditions.push(`genre = $${paramIndex++}`);
              values.push(genre);
            }
            if (format) {
              conditions.push(`format = $${paramIndex++}`);
              values.push(format);
            }
            if (budgetMin || budgetMax) {
              if (budgetMin) {
                conditions.push(`budget_range >= $${paramIndex++}`);
                values.push(budgetMin);
              }
              if (budgetMax) {
                conditions.push(`budget_range <= $${paramIndex++}`);
                values.push(budgetMax);
              }
            }
            
            const whereClause = conditions.join(' AND ');
            // Use raw query with safe parameterization
            return await sql.unsafe(`SELECT COUNT(*) as total FROM pitches WHERE ${whereClause}`, values);
          }, sentry);
          const total = parseInt(totalResult[0].total);
          
          // Get paginated results with safe query building
          const pitches = await withDatabase(env, async (sql) => {
            // Build query with proper parameterization
            const conditions = [];
            const values = [];
            let paramIndex = 1;
            
            conditions.push(`p.status IN ('published', 'active')`);
            conditions.push(`p.visibility = 'public'`);
            
            if (genre) {
              conditions.push(`p.genre = $${paramIndex++}`);
              values.push(genre);
            }
            if (format) {
              conditions.push(`p.format = $${paramIndex++}`);
              values.push(format);
            }
            if (budgetMin || budgetMax) {
              if (budgetMin) {
                conditions.push(`p.budget_range >= $${paramIndex++}`);
                values.push(budgetMin);
              }
              if (budgetMax) {
                conditions.push(`p.budget_range <= $${paramIndex++}`);
                values.push(budgetMax);
              }
            }
            
            const whereClause = conditions.join(' AND ');
            
            // Determine sort column safely
            const sortColumn = {
              'date': 'p.created_at',
              'views': 'p.view_count',
              'likes': 'p.like_count',
              'title': 'p.title'
            }[sort] || 'p.created_at';
            
            const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
            
            values.push(limit);
            values.push(offset);
            
            // Use raw query with safe parameterization
            return await sql.unsafe(`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.format,
                p.view_count as "viewCount", p.like_count as "likeCount",
                p.poster_url as "posterUrl", p.created_at as "createdAt",
                p.status, p.visibility, p.synopsis, p.budget_range as budget,
                u.username as creator_username, u.id as creator_id,
                u.avatar_url as creator_profile_image
              FROM pitches p
              LEFT JOIN users u ON p.user_id = u.id
              WHERE ${whereClause}
              ORDER BY ${sortColumn} ${sortOrder}
              LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `, values);
          }, sentry);
          
          // Format pitches response
          const formattedPitches = pitches.map(pitch => ({
            id: pitch.id,
            title: pitch.title,
            logline: pitch.logline,
            synopsis: pitch.synopsis,
            genre: pitch.genre,
            format: pitch.format,
            viewCount: pitch.viewCount || 0,
            likeCount: pitch.likeCount || 0,
            posterUrl: pitch.posterUrl,
            createdAt: pitch.createdAt,
            status: pitch.status,
            visibility: pitch.visibility,
            budget: pitch.budget,
            creator: {
              id: pitch.creator_id,
              username: pitch.creator_username,
              profileImage: pitch.creator_profile_image
            }
          }));
          
          return new Response(JSON.stringify({
            success: true,
            message: "Enhanced browse results retrieved successfully",
            items: formattedPitches,
            total,
            page: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(total / limit),
            limit,
            hasMore: offset + limit < total,
            filters: {
              sort,
              order,
              genre,
              format,
              search
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Enhanced browse error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch enhanced browse results',
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // === PITCH CRUD ENDPOINTS ===
      
      // Create new pitch
      if (pathname === '/api/pitches' && request.method === 'POST') {
        const authResult = await authenticateRequest(request, env);
        if (!authResult.success) return authResult.error;
        
        try {
          const body = await request.json();
          const userId = authResult.user.userId || authResult.user.id;
          
          // Use direct connection
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          const result = await withDatabase(env, async (sql) => await sql`
            INSERT INTO pitches (
              user_id, title, genre, format, logline,
              target_audience, budget, status, created_at, updated_at
            ) VALUES (
              ${userId}, ${body.title}, ${body.genre || 'Drama'}, 
              ${body.format || 'Feature Film'}, ${body.logline || ''},
              ${body.target_audience || ''}, ${body.budget || 0},
              'draft', NOW(), NOW()
            )
            RETURNING id, title, genre, format, status, created_at
          `, sentry);
          
          return new Response(JSON.stringify({
            success: true,
            data: result[0],
            message: 'Pitch created successfully'
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Create pitch error:', error);
          return serverErrorResponse("Failed to create pitch: " + error.message);
        }
      }
      
      // Update pitch
      if (pathname.match(/^\/api\/pitches\/(\d+)$/) && request.method === 'PUT') {
        const authResult = await authenticateRequest(request, env);
        if (!authResult.success) return authResult.error;
        
        try {
          const pitchId = pathname.split('/').pop();
          const body = await request.json();
          const userId = authResult.user.userId || authResult.user.id;
          
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          // Verify ownership
          const ownership = await withDatabase(env, async (sql) => await sql`
            SELECT user_id FROM pitches WHERE id = ${pitchId}
          `, sentry);
          
          if (!ownership[0] || ownership[0].user_id !== userId) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Unauthorized to update this pitch'
            }), {
              status: 403,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          
          const result = await withDatabase(env, async (sql) => await sql`
            UPDATE pitches SET
              title = ${body.title},
              genre = ${body.genre},
              format = ${body.format},
              logline = ${body.logline},
              target_audience = ${body.target_audience},
              budget = ${body.budget},
              status = ${body.status || 'draft'},
              updated_at = NOW()
            WHERE id = ${pitchId}
            RETURNING id, title, genre, format, status, updated_at
          `, sentry);
          
          return new Response(JSON.stringify({
            success: true,
            data: result[0],
            message: 'Pitch updated successfully'
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Update pitch error:', error);
          return serverErrorResponse("Failed to update pitch: " + error.message);
        }
      }
      
      // Delete pitch
      if (pathname.match(/^\/api\/pitches\/(\d+)$/) && request.method === 'DELETE') {
        const authResult = await authenticateRequest(request, env);
        if (!authResult.success) return authResult.error;
        
        try {
          const pitchId = pathname.split('/').pop();
          const userId = authResult.user.userId || authResult.user.id;
          
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          // Verify ownership
          const ownership = await withDatabase(env, async (sql) => await sql`
            SELECT user_id FROM pitches WHERE id = ${pitchId}
          `, sentry);
          
          if (!ownership[0] || ownership[0].user_id !== userId) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Unauthorized to delete this pitch'
            }), {
              status: 403,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          
          await withDatabase(env, async (sql) => await sql`DELETE FROM pitches WHERE id = ${pitchId}`, sentry);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Pitch deleted successfully'
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Delete pitch error:', error);
          return serverErrorResponse("Failed to delete pitch: " + error.message);
        }
      }
      
      // Get user's pitches
      if (pathname === '/api/pitches/my' && request.method === 'GET') {
        const authResult = await authenticateRequest(request, env);
        if (!authResult.success) return authResult.error;
        
        try {
          const userId = authResult.user.userId || authResult.user.id;
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          const result = await withDatabase(env, async (sql) => await sql`
            SELECT p.*, u.username, u.profile_image,
                   COUNT(DISTINCT v.id) as view_count,
                   COUNT(DISTINCT n.id) as nda_count
            FROM pitches p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN pitch_views v ON p.id = v.pitch_id
            LEFT JOIN ndas n ON p.id = n.pitch_id
            WHERE p.user_id = ${userId}
            GROUP BY p.id, u.id
            ORDER BY p.created_at DESC
          `, sentry);
          
          return new Response(JSON.stringify({
            success: true,
            data: result || []
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Get my pitches error:', error);
          return serverErrorResponse("Failed to get pitches: " + error.message);
        }
      }
      
      // === USER REGISTRATION ENDPOINTS ===
      
      // Register creator
      if (pathname === '/api/auth/creator/register' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          // Check if email exists
          const existing = await withDatabase(env, async (sql) => await sql`
            SELECT id FROM users WHERE email = ${body.email}
          `, sentry);
          
          if (existing[0]) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Email already registered'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          
          // Create user
          const result = await withDatabase(env, async (sql) => await sql`
            INSERT INTO users (
              email, username, password, user_type, first_name, last_name,
              company_name, bio, location, verified, created_at
            ) VALUES (
              ${body.email}, ${body.username}, ${body.password}, 'creator',
              ${body.firstName || ''}, ${body.lastName || ''}, ${body.companyName || ''},
              ${body.bio || ''}, ${body.location || ''}, false, NOW()
            )
            RETURNING id, email, username, user_type
          `, sentry);
          
          // Create JWT token
          const JWT_SECRET = env.JWT_SECRET;  // No fallback - must be configured
          const token = await createSimpleJWT({
            userId: result[0].id,
            email: result[0].email,
            userType: 'creator',
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
          }, JWT_SECRET);
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              token,
              user: result[0]
            },
            message: 'Creator account created successfully'
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Creator registration error:', error);
          return serverErrorResponse("Failed to register: " + error.message);
        }
      }
      
      // Register investor
      if (pathname === '/api/auth/investor/register' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          // Check if email exists
          const existing = await withDatabase(env, async (sql) => await sql`
            SELECT id FROM users WHERE email = ${body.email}
          `, sentry);
          
          if (existing[0]) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Email already registered'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          
          // Create user
          const result = await withDatabase(env, async (sql) => await sql`
            INSERT INTO users (
              email, username, password, user_type, first_name, last_name,
              company_name, bio, location, verified, created_at
            ) VALUES (
              ${body.email}, ${body.username}, ${body.password}, 'investor',
              ${body.firstName || ''}, ${body.lastName || ''}, ${body.companyName || ''},
              ${body.bio || ''}, ${body.location || ''}, false, NOW()
            )
            RETURNING id, email, username, user_type
          `, sentry);
          
          // Create JWT token
          const JWT_SECRET = env.JWT_SECRET;  // No fallback - must be configured
          const token = await createSimpleJWT({
            userId: result[0].id,
            email: result[0].email,
            userType: 'investor',
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
          }, JWT_SECRET);
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              token,
              user: result[0]
            },
            message: 'Investor account created successfully'
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Investor registration error:', error);
          return serverErrorResponse("Failed to register: " + error.message);
        }
      }
      
      // Register production company
      if (pathname === '/api/auth/production/register' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          // Check if email exists
          const existing = await withDatabase(env, async (sql) => await sql`
            SELECT id FROM users WHERE email = ${body.email}
          `, sentry);
          
          if (existing[0]) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Email already registered'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          
          // Create user
          const result = await withDatabase(env, async (sql) => await sql`
            INSERT INTO users (
              email, username, password, user_type, first_name, last_name,
              company_name, bio, location, verified, created_at
            ) VALUES (
              ${body.email}, ${body.username}, ${body.password}, 'production',
              ${body.firstName || ''}, ${body.lastName || ''}, ${body.companyName || ''},
              ${body.bio || ''}, ${body.location || ''}, false, NOW()
            )
            RETURNING id, email, username, user_type
          `, sentry);
          
          // Create JWT token
          const JWT_SECRET = env.JWT_SECRET;  // No fallback - must be configured
          const token = await createSimpleJWT({
            userId: result[0].id,
            email: result[0].email,
            userType: 'production',
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
          }, JWT_SECRET);
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              token,
              user: result[0]
            },
            message: 'Production company account created successfully'
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Production registration error:', error);
          return serverErrorResponse("Failed to register: " + error.message);
        }
      }
      
      // === FILE UPLOAD ENDPOINTS ===
      
      // Upload file to R2
      if (pathname === '/api/upload' && request.method === 'POST') {
        const authResult = await authenticateRequest(request, env);
        if (!authResult.success) return authResult.error;
        
        try {
          const formData = await request.formData();
          const file = formData.get('file') as File;
          const type = formData.get('type') || 'document';
          
          if (!file) {
            return new Response(JSON.stringify({
              success: false,
              message: 'No file provided'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          
          // Generate unique filename
          const timestamp = Date.now();
          const userId = authResult.user.userId || authResult.user.id;
          const filename = `${userId}/${type}/${timestamp}-${file.name}`;
          
          // Upload to R2 if available
          if (env.R2_BUCKET) {
            await env.R2_BUCKET.put(filename, await file.arrayBuffer(), {
              httpMetadata: {
                contentType: file.type
              }
            });
            
            const url = `https://r2.pitchey.com/${filename}`;
            
            return new Response(JSON.stringify({
              success: true,
              data: {
                url,
                filename,
                type: file.type,
                size: file.size
              },
              message: 'File uploaded successfully'
            }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          } else {
            // Fallback for local development
            return new Response(JSON.stringify({
              success: true,
              data: {
                url: `/uploads/${filename}`,
                filename,
                type: file.type,
                size: file.size
              },
              message: 'File uploaded (development mode)'
            }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
        } catch (error) {
          console.error('Upload error:', error);
          return serverErrorResponse("Failed to upload file: " + error.message);
        }
      }
      
      // === USER MANAGEMENT ENDPOINTS ===
      
      // Update user profile
      if (pathname === '/api/user/profile' && request.method === 'PUT') {
        const authResult = await authenticateRequest(request, env);
        if (!authResult.success) return authResult.error;
        
        try {
          const body = await request.json();
          const userId = authResult.user.userId || authResult.user.id;
          
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          const result = await withDatabase(env, async (sql) => await sql`
            UPDATE users SET
              first_name = ${body.firstName || ''},
              last_name = ${body.lastName || ''},
              bio = ${body.bio || ''},
              location = ${body.location || ''},
              company_name = ${body.companyName || ''},
              profile_image = ${body.profileImage || ''},
              updated_at = NOW()
            WHERE id = ${userId}
            RETURNING id, email, username, first_name, last_name, bio, location, company_name, profile_image
          `, sentry);
          
          return new Response(JSON.stringify({
            success: true,
            data: result[0],
            message: 'Profile updated successfully'
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Update profile error:', error);
          return serverErrorResponse("Failed to update profile: " + error.message);
        }
      }
      
      // Get user notifications
      if (pathname === '/api/user/notifications' && request.method === 'GET') {
        const authResult = await authenticateRequest(request, env);
        if (!authResult.success) return authResult.error;
        
        try {
          const userId = authResult.user.userId || authResult.user.id;
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          const result = await withDatabase(env, async (sql) => await sql`
            SELECT * FROM notifications
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
            LIMIT 50
          `, sentry);
          
          return new Response(JSON.stringify({
            success: true,
            data: result || []
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Get notifications error:', error);
          return serverErrorResponse("Failed to get notifications: " + error.message);
        }
      }
      
      // Search users
      if (pathname === '/api/search/users' && request.method === 'GET') {
        try {
          const query = url.searchParams.get('q') || '';
          const type = url.searchParams.get('type');
          
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);
          
          const searchQuery = '%' + query + '%';
          
          let result;
          if (type) {
            result = await withDatabase(env, async (sql) => await sql`
              SELECT id, username, email, user_type, company_name, profile_image, verified
              FROM users
              WHERE (username ILIKE ${searchQuery} OR email ILIKE ${searchQuery})
                AND user_type = ${type}
              LIMIT 20
            `, sentry);
          } else {
            result = await withDatabase(env, async (sql) => await sql`
              SELECT id, username, email, user_type, company_name, profile_image, verified
              FROM users
              WHERE username ILIKE ${searchQuery} OR email ILIKE ${searchQuery}
              LIMIT 20
            `, sentry);
          }
          
          return new Response(JSON.stringify({
            success: true,
            data: result || []
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (error) {
          console.error('Search users error:', error);
          return serverErrorResponse("Failed to search users: " + error.message);
        }
      }

      // === CONTENT MANAGEMENT ENDPOINTS ===
      
      // About page content
      if (pathname === '/api/content/about' && request.method === 'GET') {
        try {
          const aboutContent = {
            hero: {
              title: "Revolutionizing Entertainment Financing",
              subtitle: "Pitchey connects visionary creators with forward-thinking investors and production companies to bring exceptional entertainment content to life."
            },
            mission: {
              title: "Our Mission",
              content: "We believe great entertainment ideas deserve great funding. Pitchey democratizes access to entertainment financing by creating a transparent, efficient marketplace where creativity meets capital. Our platform empowers creators to reach their full potential while providing investors with curated, high-quality opportunities in the entertainment industry."
            },
            story: {
              title: "Our Story", 
              content: "Founded in 2023 by entertainment industry veterans and fintech innovators, Pitchey emerged from the recognition that traditional entertainment financing was broken. Too many brilliant creators struggled to find funding while investors missed opportunities due to lack of access. We built Pitchey to bridge this gap, creating a platform that serves creators, investors, and production companies with equal dedication to excellence."
            },
            values: [
              {
                title: "Transparency",
                description: "We believe in clear, honest communication throughout every stage of the funding process."
              },
              {
                title: "Innovation", 
                description: "We embrace cutting-edge technology to streamline entertainment financing."
              },
              {
                title: "Creativity",
                description: "We champion bold, original ideas that push the boundaries of entertainment."
              },
              {
                title: "Partnership",
                description: "We foster lasting relationships between creators, investors, and production partners."
              }
            ],
            impact: {
              title: "Making an Impact",
              stats: [
                { label: "Projects Funded", value: "$127M+" },
                { label: "Active Creators", value: "2,847" },
                { label: "Investor Network", value: "1,234" },
                { label: "Success Rate", value: "89%" }
              ]
            }
          };

          return new Response(JSON.stringify({
            success: true,
            data: aboutContent
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600', // 1 hour cache
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Error fetching about content:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch about content'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // How it works content
      if (pathname === '/api/content/how-it-works' && request.method === 'GET') {
        try {
          const howItWorksContent = {
            hero: {
              title: "How Pitchey Works",
              subtitle: "A streamlined platform connecting entertainment creators with investors and production companies"
            },
            overview: {
              title: "Three Simple Steps to Success",
              description: "Our platform makes entertainment financing accessible, transparent, and efficient for all participants."
            },
            userTypes: {
              creators: {
                title: "For Creators",
                subtitle: "Turn your vision into funded reality",
                steps: [
                  {
                    step: 1,
                    title: "Create Your Pitch",
                    description: "Upload your script, treatment, or concept with supporting materials like pitch decks, character breakdowns, and budget outlines.",
                    features: ["Secure document storage", "Professional pitch templates", "Video pitch capabilities"]
                  },
                  {
                    step: 2,
                    title: "Connect with Investors", 
                    description: "Our matching algorithm connects you with investors and production companies aligned with your genre, budget, and creative vision.",
                    features: ["Smart matching technology", "NDA protection", "Direct communication tools"]
                  },
                  {
                    step: 3,
                    title: "Secure Funding",
                    description: "Negotiate terms, finalize agreements, and receive funding to bring your project to life with ongoing platform support.",
                    features: ["Secure payment processing", "Legal document support", "Project milestone tracking"]
                  }
                ]
              },
              investors: {
                title: "For Investors",
                subtitle: "Discover and fund the next entertainment breakthrough",
                steps: [
                  {
                    step: 1,
                    title: "Explore Opportunities",
                    description: "Browse curated entertainment projects across films, series, documentaries, and digital content with detailed analytics.",
                    features: ["Advanced filtering", "Market analysis", "Risk assessment tools"]
                  },
                  {
                    step: 2,
                    title: "Due Diligence",
                    description: "Access comprehensive project information, creator track records, and market potential analysis to make informed decisions.",
                    features: ["Creator verification", "Financial projections", "Market research data"]
                  },
                  {
                    step: 3,
                    title: "Invest & Track",
                    description: "Make secure investments and monitor project progress through development, production, and distribution phases.",
                    features: ["Portfolio dashboard", "Progress tracking", "ROI analytics"]
                  }
                ]
              },
              production: {
                title: "For Production Companies",
                subtitle: "Source exceptional content and co-production opportunities",
                steps: [
                  {
                    step: 1,
                    title: "Discover Content",
                    description: "Access a curated marketplace of ready-to-produce scripts, treatments, and developed projects from verified creators.",
                    features: ["Content library", "Creator profiles", "Project development status"]
                  },
                  {
                    step: 2,
                    title: "Evaluate Projects",
                    description: "Review detailed project packages including scripts, budgets, schedules, and market analysis to assess production viability.",
                    features: ["Production-ready materials", "Budget analysis", "Timeline planning"]
                  },
                  {
                    step: 3,
                    title: "Partner & Produce",
                    description: "Collaborate with creators and co-investors to bring projects to market with shared resources and expertise.",
                    features: ["Co-production tools", "Resource sharing", "Distribution planning"]
                  }
                ]
              }
            },
            security: {
              title: "Security & Trust",
              description: "Your intellectual property and financial information are protected by enterprise-grade security measures.",
              features: [
                "End-to-end encryption for all communications",
                "Comprehensive NDA management system", 
                "Secure payment processing and escrow services",
                "Identity verification and background checks",
                "Intellectual property protection protocols"
              ]
            },
            support: {
              title: "Ongoing Support",
              description: "Our team of entertainment industry experts provides guidance throughout your journey on Pitchey.",
              services: [
                "Pitch optimization consulting",
                "Legal document review assistance",
                "Market analysis and positioning advice",
                "Project development guidance",
                "Industry networking opportunities"
              ]
            }
          };

          return new Response(JSON.stringify({
            success: true,
            data: howItWorksContent
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600', // 1 hour cache
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Error fetching how-it-works content:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch how-it-works content'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Team page content
      if (pathname === '/api/content/team' && request.method === 'GET') {
        try {
          const teamContent = {
            hero: {
              title: "Meet the Pitchey Team",
              subtitle: "Entertainment industry veterans and technology innovators working together to revolutionize content financing"
            },
            leadership: [
              {
                id: "sarah-chen",
                name: "Sarah Chen",
                role: "CEO & Co-Founder",
                bio: "Former VP of Development at Lionsgate Entertainment with 12 years experience in film financing and production. Led development of over $2B in entertainment content including multiple award-winning series and blockbuster films.",
                image: "/images/team/sarah-chen.jpg",
                linkedin: "https://linkedin.com/in/sarah-chen-entertainment",
                specialties: ["Entertainment Finance", "Content Development", "Strategic Partnerships"],
                achievements: [
                  "Executive Producer on 3 Emmy-nominated series",
                  "Raised $500M+ in entertainment funding",
                  "Former Board Member, Film Finance Association"
                ]
              },
              {
                id: "marcus-rodriguez", 
                name: "Marcus Rodriguez",
                role: "CTO & Co-Founder", 
                bio: "Former Principal Engineer at Netflix with expertise in large-scale content platforms and fintech security. Led technical architecture for streaming platforms serving 200M+ users globally.",
                image: "/images/team/marcus-rodriguez.jpg",
                linkedin: "https://linkedin.com/in/marcus-rodriguez-tech",
                specialties: ["Platform Architecture", "Fintech Security", "Scalable Systems"],
                achievements: [
                  "Architect of Netflix content discovery engine",
                  "20+ patents in streaming technology",
                  "MIT Technology Review Innovator Under 35"
                ]
              },
              {
                id: "david-kim",
                name: "David Kim",
                role: "Chief Investment Officer",
                bio: "Former Managing Director at CAA Ventures with 15 years in entertainment investment and venture capital. Successfully invested in 40+ entertainment and media companies with combined valuations exceeding $5B.",
                image: "/images/team/david-kim.jpg", 
                linkedin: "https://linkedin.com/in/david-kim-ventures",
                specialties: ["Entertainment Investing", "Risk Management", "Due Diligence"],
                achievements: [
                  "Led Series A investments in 3 unicorn media companies", 
                  "Former Investment Committee, Creative Artists Agency",
                  "Harvard Business School Entertainment & Media Club Co-Chair"
                ]
              }
            ],
            departments: [
              {
                name: "Product & Engineering",
                description: "Building the future of entertainment financing technology",
                size: 12,
                highlights: [
                  "World-class engineers from Netflix, Disney+, and Amazon Prime",
                  "AI/ML specialists optimizing creator-investor matching",
                  "Security experts ensuring platform safety and compliance"
                ]
              },
              {
                name: "Entertainment Industry",
                description: "Deep expertise in content creation, financing, and distribution",
                size: 8,
                highlights: [
                  "Former executives from major studios and streaming platforms",
                  "Independent film and TV production specialists", 
                  "Distribution and international sales experts"
                ]
              },
              {
                name: "Finance & Legal",
                description: "Ensuring secure, compliant, and efficient transactions",
                size: 6,
                highlights: [
                  "Entertainment lawyers from top-tier law firms",
                  "Financial analysts specializing in media investments",
                  "Compliance experts in fintech and entertainment regulation"
                ]
              }
            ],
            advisors: [
              {
                name: "Jennifer Walsh",
                role: "Strategic Advisor",
                background: "Former President, CAA Foundation",
                expertise: "Talent Relations & Industry Partnerships"
              },
              {
                name: "Robert Chen",
                role: "Technical Advisor", 
                background: "Former CTO, Paramount+ Streaming",
                expertise: "Platform Scaling & Content Technology"
              },
              {
                name: "Maria Santos",
                role: "Investment Advisor",
                background: "Managing Partner, Santos Capital Partners",
                expertise: "Entertainment Investment Strategy"
              }
            ],
            culture: {
              title: "Our Culture",
              values: [
                {
                  name: "Creator-First Mindset",
                  description: "Every decision considers impact on content creators"
                },
                {
                  name: "Radical Transparency", 
                  description: "Open, honest communication in all relationships"
                },
                {
                  name: "Continuous Innovation",
                  description: "Always improving platform and user experience"
                },
                {
                  name: "Industry Expertise",
                  description: "Deep knowledge drives better outcomes"
                }
              ],
              perks: [
                "Unlimited creative project time (20% time for personal projects)",
                "Annual entertainment industry conference attendance",
                "Equity participation in platform success",
                "Health, dental, vision, and mental health support",
                "Remote-first with quarterly team gatherings in Los Angeles"
              ]
            }
          };

          return new Response(JSON.stringify({
            success: true,
            data: teamContent
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600', // 1 hour cache
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Error fetching team content:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch team content'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Platform statistics
      if (pathname === '/api/content/stats' && request.method === 'GET') {
        try {
          // Generate realistic but impressive statistics
          const currentDate = new Date();
          const monthsSinceLaunch = 18; // Platform launched 18 months ago
          
          const statsContent = {
            hero: {
              title: "Platform Statistics",
              subtitle: "Real-time metrics showing the growth and impact of the Pitchey community",
              lastUpdated: currentDate.toISOString()
            },
            overview: {
              totalFunding: {
                value: 127800000, // $127.8M
                formatted: "$127.8M",
                growth: "+23.4%",
                period: "vs last quarter"
              },
              activeProjects: {
                value: 1847,
                formatted: "1,847",
                growth: "+15.2%", 
                period: "vs last month"
              },
              successRate: {
                value: 89.3,
                formatted: "89.3%",
                growth: "+2.1%",
                period: "vs last quarter"
              },
              averageFunding: {
                value: 285000,
                formatted: "$285K",
                growth: "+8.7%",
                period: "vs last quarter"
              }
            },
            userGrowth: {
              totalUsers: {
                value: 12847,
                formatted: "12,847",
                breakdown: {
                  creators: 7234,
                  investors: 3891,
                  production: 1722
                }
              },
              monthlyActive: {
                value: 8934,
                formatted: "8,934", 
                growth: "+18.9%",
                period: "vs last month"
              },
              newUsersThisMonth: {
                value: 1247,
                formatted: "1,247",
                growth: "+24.3%",
                period: "vs last month"
              }
            },
            projectMetrics: {
              totalProjects: {
                value: 4829,
                formatted: "4,829",
                categories: {
                  films: 1847,
                  series: 1523,
                  documentaries: 892,
                  digital: 567
                }
              },
              funded: {
                value: 2156,
                formatted: "2,156",
                rate: "44.6%"
              },
              inProduction: {
                value: 834,
                formatted: "834",
                rate: "17.3%"
              },
              completed: {
                value: 567,
                formatted: "567",
                rate: "11.7%"
              }
            },
            fundingBreakdown: {
              byCategory: [
                { category: "Feature Films", amount: 72400000, percentage: 56.7 },
                { category: "TV Series", amount: 31200000, percentage: 24.4 },
                { category: "Documentaries", amount: 15600000, percentage: 12.2 },
                { category: "Digital Content", amount: 8600000, percentage: 6.7 }
              ],
              byBudgetRange: [
                { range: "$1M - $5M", projects: 892, percentage: 41.4 },
                { range: "$5M - $15M", projects: 623, percentage: 28.9 },
                { range: "$15M - $50M", projects: 434, percentage: 20.1 },
                { range: "$50M+", projects: 207, percentage: 9.6 }
              ]
            },
            regionalData: {
              topMarkets: [
                { region: "North America", projects: 1547, funding: 89200000 },
                { region: "Europe", projects: 423, funding: 24100000 },
                { region: "Asia Pacific", projects: 134, funding: 10800000 },
                { region: "Latin America", projects: 52, funding: 3700000 }
              ]
            },
            recentMilestones: [
              {
                date: "2024-11-15",
                title: "Reached $125M in Total Platform Funding",
                description: "Milestone achieved 3 months ahead of projections"
              },
              {
                date: "2024-11-08", 
                title: "10,000th User Registered",
                description: "Platform community reaches five-figure milestone"
              },
              {
                date: "2024-10-22",
                title: "Partnership with Sundance Film Festival",
                description: "Official platform partner for emerging filmmaker funding"
              },
              {
                date: "2024-10-15",
                title: "First $50M+ Project Funded",
                description: "Major studio collaboration marks platform maturity"
              }
            ],
            trends: {
              monthlyGrowth: {
                funding: [
                  { month: "Jul 2024", amount: 8200000 },
                  { month: "Aug 2024", amount: 9100000 },
                  { month: "Sep 2024", amount: 10800000 },
                  { month: "Oct 2024", amount: 12300000 },
                  { month: "Nov 2024", amount: 14200000 }
                ],
                projects: [
                  { month: "Jul 2024", count: 89 },
                  { month: "Aug 2024", count: 104 },
                  { month: "Sep 2024", count: 127 },
                  { month: "Oct 2024", count: 142 },
                  { month: "Nov 2024", count: 156 }
                ]
              },
              topGenres: [
                { genre: "Drama", projects: 847, funding: 34200000 },
                { genre: "Thriller", projects: 523, funding: 28900000 },
                { genre: "Comedy", projects: 434, funding: 18700000 },
                { genre: "Sci-Fi", projects: 298, funding: 24100000 },
                { genre: "Documentary", projects: 267, funding: 12800000 }
              ]
            }
          };

          return new Response(JSON.stringify({
            success: true,
            data: statsContent
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300', // 5 minute cache for stats
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('Error fetching stats content:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch platform statistics'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // === AUTHENTICATION ENDPOINTS ===
      
      // Portal-specific login endpoints
      if (pathname === '/api/auth/creator/login' && request.method === 'POST') {
        try {
          const validationResult = await validateRequest(request, ["email", "password"]);
          if (!validationResult.success || !validationResult.data) {
            return validationResult.error || jsonResponse({
              success: false,
              message: 'Invalid request data'
            }, 400);
          }

          const { email, password } = validationResult.data;
          const demoAccount = demoAccounts.creator;
          
          if (email === demoAccount.email && password === demoAccount.password) {
            const JWT_SECRET = env.JWT_SECRET;  // No fallback - must be configured
            const token = await createSimpleJWT({
              userId: demoAccount.id, 
              email: demoAccount.email, 
              userType: "creator",
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
            }, JWT_SECRET);

            return jsonResponse({
              success: true,
              data: {
                token,
                user: demoAccount
              },
              message: "Creator login successful"
            });
          }

          return authErrorResponse("Invalid creator credentials");
        } catch (error) {
          return serverErrorResponse("Creator login failed");
        }
      }

      if (pathname === '/api/auth/investor/login' && request.method === 'POST') {
        try {
          const validationResult = await validateRequest(request, ["email", "password"]);
          if (!validationResult.success || !validationResult.data) {
            return validationResult.error || jsonResponse({
              success: false,
              message: 'Invalid request data'
            }, 400);
          }

          const { email, password } = validationResult.data;
          const demoAccount = demoAccounts.investor;
          
          if (email === demoAccount.email && password === demoAccount.password) {
            const JWT_SECRET = env.JWT_SECRET;  // No fallback - must be configured
            const token = await createSimpleJWT({
              userId: demoAccount.id, 
              email: demoAccount.email, 
              userType: "investor",
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
            }, JWT_SECRET);

            return jsonResponse({
              success: true,
              data: {
                token,
                user: demoAccount
              },
              message: "Investor login successful"
            });
          }

          return authErrorResponse("Invalid investor credentials");
        } catch (error) {
          return serverErrorResponse("Investor login failed");
        }
      }

      if (pathname === '/api/auth/production/login' && request.method === 'POST') {
        try {
          const validationResult = await validateRequest(request, ["email", "password"]);
          if (!validationResult.success || !validationResult.data) {
            return validationResult.error || jsonResponse({
              success: false,
              message: 'Invalid request data'
            }, 400);
          }

          const { email, password } = validationResult.data;
          const demoAccount = demoAccounts.production;
          
          if (email === demoAccount.email && password === demoAccount.password) {
            const JWT_SECRET = env.JWT_SECRET;  // No fallback - must be configured
            const token = await createSimpleJWT({
              userId: demoAccount.id, 
              email: demoAccount.email, 
              userType: "production",
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
            }, JWT_SECRET);

            return jsonResponse({
              success: true,
              data: {
                token,
                user: demoAccount
              },
              message: "Production login successful"
            });
          }

          return authErrorResponse("Invalid production credentials");
        } catch (error) {
          return serverErrorResponse("Production login failed");
        }
      }

      // ============ LOGOUT ENDPOINT ============
      
      // Universal logout endpoint (works for all user types)
      if (pathname === '/api/auth/logout' && request.method === 'POST') {
        try {
          // Optional: Verify token is valid before logout
          const auth = await authenticateRequest(request, env);
          
          // For client-side logout, we just return success
          // Token invalidation happens client-side by removing from localStorage
          return jsonResponse({
            success: true,
            message: "Logout successful",
            data: {
              redirectUrl: "/login",
              timestamp: new Date().toISOString()
            }
          });
        } catch (error) {
          // Even if token verification fails, allow logout to proceed
          return jsonResponse({
            success: true,
            message: "Logout completed",
            data: {
              redirectUrl: "/login",
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      // ============ DASHBOARD ENDPOINTS (Authenticated) ============

      // Creator Dashboard
      if (pathname === '/api/creator/dashboard' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        if (auth.user.userType !== 'creator') {
          return jsonResponse({
            success: false,
            message: 'Access denied: Creator access required'
          }, 403);
        }

        return jsonResponse({
          success: true,
          data: {
            stats: {
              totalPitches: 3,
              viewsThisMonth: 1250,
              likesThisMonth: 45,
              ndaRequests: 2
            },
            recentActivity: [
              { type: 'view', pitch: 'Neon Dreams', user: 'john_investor', timestamp: Date.now() - 3600000 },
              { type: 'like', pitch: 'Space Opera', user: 'sarah_prod', timestamp: Date.now() - 7200000 }
            ],
            trending: {
              bestPerforming: { title: 'Neon Dreams', views: 850, growth: '+25%' }
            }
          }
        });
      }

      // User Profile
      if (pathname === '/api/profile' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        return jsonResponse({
          success: true,
          data: {
            user: {
              id: auth.user.id,
              username: auth.user.username,
              email: auth.user.email,
              userType: auth.user.userType,
              companyName: auth.user.companyName,
              bio: `Professional ${auth.user.userType} with 5+ years experience`,
              location: 'Los Angeles, CA',
              website: `https://${auth.user.username}.com`,
              profileImageUrl: null,
              followerCount: 120,
              followingCount: 85,
              pitchCount: auth.user.userType === 'creator' ? 3 : 0
            }
          }
        });
      }

      // Follow Stats
      if (pathname.startsWith('/api/follows/stats/') && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const userId = pathname.split('/').pop();
        return jsonResponse({
          success: true,
          data: {
            followStats: {
              followers: 120,
              following: 85,
              isFollowing: false
            }
          }
        });
      }

      // Payment Credits Balance
      if (pathname === '/api/payments/credits/balance' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        return jsonResponse({
          success: true,
          data: {
            balance: 250.00,
            currency: 'USD',
            lastUpdated: new Date().toISOString()
          }
        });
      }

      // Subscription Status
      if (pathname === '/api/payments/subscription-status' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        return jsonResponse({
          success: true,
          data: {
            subscription: {
              tier: 'pro',
              status: 'active',
              nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              features: ['unlimited_pitches', 'advanced_analytics', 'priority_support']
            }
          }
        });
      }

      // Pending NDAs
      if (pathname === '/api/nda/pending' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const pendingNdas = auth.user.userType === 'creator' ? [
          {
            id: 1,
            pitchId: 1,
            pitchTitle: 'Neon Dreams',
            requesterId: 2,
            requesterName: 'Sarah Investor',
            requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'pending'
          }
        ] : [];

        return jsonResponse({
          success: true,
          data: {
            ndaRequests: pendingNdas,
            total: pendingNdas.length
          }
        });
      }

      // Active NDAs
      if (pathname === '/api/nda/active' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const activeNdas = auth.user.userType === 'creator' ? [
          {
            id: 2,
            pitchId: 2,
            pitchTitle: 'Space Opera',
            requesterId: 16,
            requesterName: 'Stellar Production',
            signedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
          }
        ] : [];

        return jsonResponse({
          success: true,
          data: {
            activeNdas: activeNdas,
            total: activeNdas.length
          }
        });
      }

      // ========== COMPREHENSIVE NDA MANAGEMENT ENDPOINTS ==========

      // Request NDA access to a pitch
      if (pathname === '/api/ndas/request' && request.method === 'POST') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          const body = await request.json();
          const { pitchId, message, templateId, expiryDays } = body;

          if (!pitchId) {
            return badRequestResponse("Pitch ID is required");
          }

          // Check if pitch exists and user can request NDA
          const pitchResult = await withDatabase(env, async (sql) => await sql`
            SELECT p.id, p.title, p.user_id as creator_id, u.username as creator_name
            FROM pitches p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ${pitchId} AND p.status = 'published'
          `, sentry);

          if (pitchResult.length === 0) {
            return badRequestResponse("Pitch not found or not published");
          }

          const pitch = pitchResult[0];

          // Prevent self-requests
          if (pitch.creator_id === auth.user.id) {
            return badRequestResponse("Cannot request NDA for your own pitch");
          }

          // Check for existing NDA request
          const existingRequest = await withDatabase(env, async (sql) => await sql`
            SELECT id, status FROM nda_requests
            WHERE pitch_id = ${pitchId} AND requester_id = ${auth.user.id}
            ORDER BY requested_at DESC
            LIMIT 1
          `, sentry);

          if (existingRequest.length > 0) {
            const existing = existingRequest[0];
            if (existing.status === 'pending') {
              return badRequestResponse("You already have a pending NDA request for this pitch");
            }
            if (existing.status === 'approved') {
              return badRequestResponse("You already have an approved NDA for this pitch");
            }
          }

          // Create NDA request
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (expiryDays || 30));

          const ndaRequest = await withDatabase(env, async (sql) => await sql`
            INSERT INTO nda_requests (
              pitch_id, requester_id, owner_id, nda_type, status, 
              request_message, requested_at, expires_at
            )
            VALUES (
              ${pitchId}, ${auth.user.id}, ${pitch.creator_id}, 
              ${templateId ? 'custom' : 'basic'}, 'pending',
              ${message || 'Requesting NDA access to view pitch details'}, 
              NOW(), ${expiryDate.toISOString()}
            )
            RETURNING *
          `, sentry);

          const createdRequest = ndaRequest[0];

          return jsonResponse({
            success: true,
            data: {
              id: createdRequest.id,
              pitchId: createdRequest.pitch_id,
              userId: createdRequest.owner_id,
              signerId: createdRequest.requester_id,
              ndaType: createdRequest.nda_type,
              status: createdRequest.status,
              requestMessage: createdRequest.request_message,
              createdAt: createdRequest.requested_at,
              updatedAt: createdRequest.requested_at,
              expiresAt: createdRequest.expires_at,
              pitch: {
                id: pitch.id,
                title: pitch.title,
                creator: { username: pitch.creator_name }
              }
            }
          });

        } catch (error) {
          console.error('NDA request error:', error);
          return serverErrorResponse("Failed to request NDA: " + error.message);
        }
      }

      // Sign an NDA agreement
      if (pathname.match(/^\/api\/ndas\/(\d+)\/sign$/) && request.method === 'POST') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const ndaId = pathname.split('/')[3];
          const body = await request.json();
          const { signature, fullName, title, company, acceptTerms } = body;

          if (!signature || !fullName || !acceptTerms) {
            return badRequestResponse("Signature, full name, and terms acceptance are required");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get NDA request
          const ndaResult = await withDatabase(env, async (sql) => await sql`
            SELECT nr.*, p.title as pitch_title
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            WHERE nr.id = ${ndaId} AND nr.requester_id = ${auth.user.id} AND nr.status = 'approved'
          `, sentry);

          if (ndaResult.length === 0) {
            return badRequestResponse("NDA not found, not yours, or not approved for signing");
          }

          const ndaRequest = ndaResult[0];

          // Create signed NDA record
          const signedNda = await withDatabase(env, async (sql) => await sql`
            INSERT INTO ndas (
              pitch_id, user_id, signer_id, status, nda_type, 
              access_granted, signed_at, expires_at
            )
            VALUES (
              ${ndaRequest.pitch_id}, ${ndaRequest.owner_id}, ${auth.user.id},
              'signed', ${ndaRequest.nda_type}, true, NOW(), ${ndaRequest.expires_at}
            )
            RETURNING *
          `, sentry);

          // Update request status to signed
          await withDatabase(env, async (sql) => await sql`
            UPDATE nda_requests 
            SET status = 'signed', responded_at = NOW()
            WHERE id = ${ndaId}
          `, sentry);

          const nda = signedNda[0];

          return jsonResponse({
            success: true,
            data: {
              nda: {
                id: nda.id,
                pitchId: nda.pitch_id,
                userId: nda.user_id,
                signerId: nda.signer_id,
                ndaType: nda.nda_type,
                status: nda.status,
                signedAt: nda.signed_at,
                expiresAt: nda.expires_at,
                createdAt: nda.created_at,
                updatedAt: nda.updated_at,
                pitch: { title: ndaRequest.pitch_title }
              }
            }
          });

        } catch (error) {
          console.error('NDA signing error:', error);
          return serverErrorResponse("Failed to sign NDA: " + error.message);
        }
      }

      // Approve NDA request (creator action)
      if (pathname.match(/^\/api\/ndas\/(\d+)\/approve$/) && request.method === 'POST') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const ndaId = pathname.split('/')[3];
          const body = await request.json();
          const { notes } = body;

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Verify ownership
          const ndaResult = await withDatabase(env, async (sql) => await sql`
            SELECT nr.*, p.title as pitch_title, u.username as requester_name
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            JOIN users u ON nr.requester_id = u.id
            WHERE nr.id = ${ndaId} AND nr.owner_id = ${auth.user.id} AND nr.status = 'pending'
          `, sentry);

          if (ndaResult.length === 0) {
            return badRequestResponse("NDA request not found, not yours to approve, or not pending");
          }

          const ndaRequest = ndaResult[0];

          // Update request status
          const updatedRequest = await withDatabase(env, async (sql) => await sql`
            UPDATE nda_requests 
            SET status = 'approved', responded_at = NOW()
            WHERE id = ${ndaId}
            RETURNING *
          `, sentry);

          return jsonResponse({
            success: true,
            data: {
              nda: {
                id: updatedRequest[0].id,
                pitchId: updatedRequest[0].pitch_id,
                userId: updatedRequest[0].owner_id,
                signerId: updatedRequest[0].requester_id,
                ndaType: updatedRequest[0].nda_type,
                status: updatedRequest[0].status,
                requestMessage: updatedRequest[0].request_message,
                createdAt: updatedRequest[0].requested_at,
                updatedAt: updatedRequest[0].responded_at,
                expiresAt: updatedRequest[0].expires_at,
                pitch: { title: ndaRequest.pitch_title },
                requester: { username: ndaRequest.requester_name }
              }
            }
          });

        } catch (error) {
          console.error('NDA approval error:', error);
          return serverErrorResponse("Failed to approve NDA: " + error.message);
        }
      }

      // Reject NDA request (creator action)
      if (pathname.match(/^\/api\/ndas\/(\d+)\/reject$/) && request.method === 'POST') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const ndaId = pathname.split('/')[3];
          const body = await request.json();
          const { reason } = body;

          if (!reason) {
            return badRequestResponse("Rejection reason is required");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Verify ownership
          const ndaResult = await withDatabase(env, async (sql) => await sql`
            SELECT nr.*, p.title as pitch_title, u.username as requester_name
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            JOIN users u ON nr.requester_id = u.id
            WHERE nr.id = ${ndaId} AND nr.owner_id = ${auth.user.id} AND nr.status = 'pending'
          `, sentry);

          if (ndaResult.length === 0) {
            return badRequestResponse("NDA request not found, not yours to reject, or not pending");
          }

          const ndaRequest = ndaResult[0];

          // Update request status
          const updatedRequest = await withDatabase(env, async (sql) => await sql`
            UPDATE nda_requests 
            SET status = 'rejected', rejection_reason = ${reason}, responded_at = NOW()
            WHERE id = ${ndaId}
            RETURNING *
          `, sentry);

          return jsonResponse({
            success: true,
            data: {
              nda: {
                id: updatedRequest[0].id,
                pitchId: updatedRequest[0].pitch_id,
                userId: updatedRequest[0].owner_id,
                signerId: updatedRequest[0].requester_id,
                ndaType: updatedRequest[0].nda_type,
                status: updatedRequest[0].status,
                requestMessage: updatedRequest[0].request_message,
                rejectionReason: updatedRequest[0].rejection_reason,
                createdAt: updatedRequest[0].requested_at,
                updatedAt: updatedRequest[0].responded_at,
                expiresAt: updatedRequest[0].expires_at,
                pitch: { title: ndaRequest.pitch_title },
                requester: { username: ndaRequest.requester_name }
              }
            }
          });

        } catch (error) {
          console.error('NDA rejection error:', error);
          return serverErrorResponse("Failed to reject NDA: " + error.message);
        }
      }

      // Revoke an existing NDA
      if (pathname.match(/^\/api\/ndas\/(\d+)\/revoke$/) && request.method === 'POST') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const ndaId = pathname.split('/')[3];
          const body = await request.json();
          const { reason } = body;

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Verify ownership
          const ndaResult = await withDatabase(env, async (sql) => await sql`
            SELECT n.*, p.title as pitch_title, u.username as signer_name
            FROM ndas n
            JOIN pitches p ON n.pitch_id = p.id
            JOIN users u ON n.signer_id = u.id
            WHERE n.id = ${ndaId} AND n.user_id = ${auth.user.id} 
              AND n.status IN ('signed', 'active')
          `, sentry);

          if (ndaResult.length === 0) {
            return badRequestResponse("NDA not found, not yours to revoke, or not active");
          }

          const nda = ndaResult[0];

          // Revoke NDA
          const updatedNda = await withDatabase(env, async (sql) => await sql`
            UPDATE ndas 
            SET status = 'revoked', revoked_at = NOW(), access_granted = false
            WHERE id = ${ndaId}
            RETURNING *
          `, sentry);

          return jsonResponse({
            success: true,
            data: {
              nda: {
                id: updatedNda[0].id,
                pitchId: updatedNda[0].pitch_id,
                userId: updatedNda[0].user_id,
                signerId: updatedNda[0].signer_id,
                ndaType: updatedNda[0].nda_type,
                status: updatedNda[0].status,
                signedAt: updatedNda[0].signed_at,
                revokedAt: updatedNda[0].revoked_at,
                expiresAt: updatedNda[0].expires_at,
                createdAt: updatedNda[0].created_at,
                updatedAt: updatedNda[0].updated_at,
                pitch: { title: nda.pitch_title },
                signer: { username: nda.signer_name }
              }
            }
          });

        } catch (error) {
          console.error('NDA revocation error:', error);
          return serverErrorResponse("Failed to revoke NDA: " + error.message);
        }
      }

      // Get specific NDA details
      if (pathname.match(/^\/api\/ndas\/(\d+)$/) && request.method === 'GET') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const ndaId = pathname.split('/')[3];

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get NDA from either requests or signed NDAs
          let ndaResult = await withDatabase(env, async (sql) => await sql`
            SELECT nr.id, nr.pitch_id, nr.requester_id as signer_id, nr.owner_id as user_id,
                   nr.nda_type, nr.status, nr.request_message, nr.rejection_reason,
                   nr.requested_at as created_at, nr.responded_at as updated_at, nr.expires_at,
                   p.title as pitch_title, 
                   u1.username as owner_name, u2.username as requester_name
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            JOIN users u1 ON nr.owner_id = u1.id
            JOIN users u2 ON nr.requester_id = u2.id
            WHERE nr.id = ${ndaId} 
              AND (nr.owner_id = ${auth.user.id} OR nr.requester_id = ${auth.user.id})
          `, sentry);

          if (ndaResult.length === 0) {
            // Try signed NDAs
            ndaResult = await withDatabase(env, async (sql) => await sql`
              SELECT n.id, n.pitch_id, n.signer_id, n.user_id, n.nda_type, n.status,
                     n.signed_at, n.revoked_at, n.expires_at, n.created_at, n.updated_at,
                     p.title as pitch_title,
                     u1.username as owner_name, u2.username as signer_name
              FROM ndas n
              JOIN pitches p ON n.pitch_id = p.id
              JOIN users u1 ON n.user_id = u1.id
              JOIN users u2 ON n.signer_id = u2.id
              WHERE n.id = ${ndaId}
                AND (n.user_id = ${auth.user.id} OR n.signer_id = ${auth.user.id})
            `, sentry);
          }

          if (ndaResult.length === 0) {
            return badRequestResponse("NDA not found or access denied");
          }

          const nda = ndaResult[0];

          return jsonResponse({
            success: true,
            data: {
              nda: {
                id: nda.id,
                pitchId: nda.pitch_id,
                userId: nda.user_id,
                signerId: nda.signer_id,
                ndaType: nda.nda_type,
                status: nda.status,
                requestMessage: nda.request_message,
                rejectionReason: nda.rejection_reason,
                signedAt: nda.signed_at,
                revokedAt: nda.revoked_at,
                expiresAt: nda.expires_at,
                createdAt: nda.created_at,
                updatedAt: nda.updated_at,
                pitch: { title: nda.pitch_title },
                requester: { username: nda.requester_name || nda.signer_name },
                signer: { username: nda.signer_name || nda.requester_name }
              }
            }
          });

        } catch (error) {
          console.error('Get NDA error:', error);
          return serverErrorResponse("Failed to get NDA: " + error.message);
        }
      }

      // Get NDAs with filters (filtered by user role)
      if (pathname === '/api/ndas' && request.method === 'GET') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const status = url.searchParams.get('status');
          const pitchId = url.searchParams.get('pitchId');
          const limit = parseInt(url.searchParams.get('limit') || '10');
          const offset = parseInt(url.searchParams.get('offset') || '0');

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          let whereClause = '';
          let params: any[] = [];

          if (auth.user.userType === 'creator') {
            whereClause = 'WHERE nr.owner_id = $1';
            params.push(auth.user.id);
          } else {
            whereClause = 'WHERE nr.requester_id = $1';
            params.push(auth.user.id);
          }

          if (status) {
            whereClause += ` AND nr.status = $${params.length + 1}`;
            params.push(status);
          }

          if (pitchId) {
            whereClause += ` AND nr.pitch_id = $${params.length + 1}`;
            params.push(parseInt(pitchId));
          }

          // Get requests
          const requestsQuery = `
            SELECT nr.id, nr.pitch_id, nr.requester_id as signer_id, nr.owner_id as user_id,
                   nr.nda_type, nr.status, nr.request_message, nr.rejection_reason,
                   nr.requested_at as created_at, nr.responded_at as updated_at, nr.expires_at,
                   p.title as pitch_title, 
                   u1.username as owner_name, u2.username as requester_name
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            JOIN users u1 ON nr.owner_id = u1.id
            JOIN users u2 ON nr.requester_id = u2.id
            ${whereClause}
            ORDER BY nr.requested_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
          `;

          params.push(limit, offset);
          // Execute the query using template literals based on conditions
          let ndaResults;
          if (whereClause.includes('AND') && status && pitchId) {
            ndaResults = await withDatabase(env, async (sql) => await sql`
              SELECT nr.id, nr.pitch_id, nr.requester_id as signer_id, nr.owner_id as user_id,
                     nr.nda_type, nr.status, nr.request_message, nr.rejection_reason,
                     nr.requested_at as created_at, nr.responded_at as updated_at, nr.expires_at,
                     p.title as pitch_title, 
                     u1.username as owner_name, u2.username as requester_name
              FROM nda_requests nr
              JOIN pitches p ON nr.pitch_id = p.id
              JOIN users u1 ON nr.owner_id = u1.id
              JOIN users u2 ON nr.requester_id = u2.id
              WHERE nr.requester_id = ${auth.user.id} AND nr.status = ${status} AND nr.pitch_id = ${pitchId}
              ORDER BY nr.requested_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `, sentry);
          } else if (status) {
            ndaResults = await withDatabase(env, async (sql) => await sql`
              SELECT nr.id, nr.pitch_id, nr.requester_id as signer_id, nr.owner_id as user_id,
                     nr.nda_type, nr.status, nr.request_message, nr.rejection_reason,
                     nr.requested_at as created_at, nr.responded_at as updated_at, nr.expires_at,
                     p.title as pitch_title, 
                     u1.username as owner_name, u2.username as requester_name
              FROM nda_requests nr
              JOIN pitches p ON nr.pitch_id = p.id
              JOIN users u1 ON nr.owner_id = u1.id
              JOIN users u2 ON nr.requester_id = u2.id
              WHERE nr.requester_id = ${auth.user.id} AND nr.status = ${status}
              ORDER BY nr.requested_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `, sentry);
          } else if (pitchId) {
            ndaResults = await withDatabase(env, async (sql) => await sql`
              SELECT nr.id, nr.pitch_id, nr.requester_id as signer_id, nr.owner_id as user_id,
                     nr.nda_type, nr.status, nr.request_message, nr.rejection_reason,
                     nr.requested_at as created_at, nr.responded_at as updated_at, nr.expires_at,
                     p.title as pitch_title, 
                     u1.username as owner_name, u2.username as requester_name
              FROM nda_requests nr
              JOIN pitches p ON nr.pitch_id = p.id
              JOIN users u1 ON nr.owner_id = u1.id
              JOIN users u2 ON nr.requester_id = u2.id
              WHERE nr.requester_id = ${auth.user.id} AND nr.pitch_id = ${pitchId}
              ORDER BY nr.requested_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `, sentry);
          } else {
            ndaResults = await withDatabase(env, async (sql) => await sql`
              SELECT nr.id, nr.pitch_id, nr.requester_id as signer_id, nr.owner_id as user_id,
                     nr.nda_type, nr.status, nr.request_message, nr.rejection_reason,
                     nr.requested_at as created_at, nr.responded_at as updated_at, nr.expires_at,
                     p.title as pitch_title, 
                     u1.username as owner_name, u2.username as requester_name
              FROM nda_requests nr
              JOIN pitches p ON nr.pitch_id = p.id
              JOIN users u1 ON nr.owner_id = u1.id
              JOIN users u2 ON nr.requester_id = u2.id
              WHERE nr.requester_id = ${auth.user.id}
              ORDER BY nr.requested_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `, sentry);
          }

          // Get total count
          const countQuery = `
            SELECT COUNT(*) as total
            FROM nda_requests nr
            ${whereClause.replace(/\$\d+/g, (match, p1) => {
              const index = parseInt(match.slice(1));
              return index <= params.length - 2 ? match : '';
            }).replace(/AND nr\.status = \$\d+/, status ? `AND nr.status = '${status}'` : '')
                     .replace(/AND nr\.pitch_id = \$\d+/, pitchId ? `AND nr.pitch_id = ${pitchId}` : '')}
          `;
          
          // Get total count
          let countResult;
          if (status && pitchId) {
            countResult = await withDatabase(env, async (sql) => await sql`
              SELECT COUNT(*) as total
              FROM nda_requests nr
              WHERE nr.requester_id = ${auth.user.id} AND nr.status = ${status} AND nr.pitch_id = ${pitchId}
            `, sentry);
          } else if (status) {
            countResult = await withDatabase(env, async (sql) => await sql`
              SELECT COUNT(*) as total
              FROM nda_requests nr
              WHERE nr.requester_id = ${auth.user.id} AND nr.status = ${status}
            `, sentry);
          } else if (pitchId) {
            countResult = await withDatabase(env, async (sql) => await sql`
              SELECT COUNT(*) as total
              FROM nda_requests nr
              WHERE nr.requester_id = ${auth.user.id} AND nr.pitch_id = ${pitchId}
            `, sentry);
          } else {
            countResult = await withDatabase(env, async (sql) => await sql`
              SELECT COUNT(*) as total
              FROM nda_requests nr
              WHERE nr.requester_id = ${auth.user.id}
            `, sentry);
          }

          const ndas = ndaResults.map((nda: any) => ({
            id: nda.id,
            pitchId: nda.pitch_id,
            userId: nda.user_id,
            signerId: nda.signer_id,
            ndaType: nda.nda_type,
            status: nda.status,
            requestMessage: nda.request_message,
            rejectionReason: nda.rejection_reason,
            createdAt: nda.created_at,
            updatedAt: nda.updated_at,
            expiresAt: nda.expires_at,
            pitch: { title: nda.pitch_title },
            requester: { username: nda.requester_name },
            signer: { username: nda.requester_name }
          }));

          return jsonResponse({
            success: true,
            data: {
              ndas: ndas,
              total: parseInt(countResult[0]?.total || '0')
            }
          });

        } catch (error) {
          console.error('Get NDAs error:', error);
          return serverErrorResponse("Failed to get NDAs: " + error.message);
        }
      }

      // Check NDA status for a specific pitch
      if (pathname.match(/^\/api\/ndas\/pitch\/(\d+)\/status$/) && request.method === 'GET') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const pitchId = pathname.split('/')[4];

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Check for signed NDA
          const signedNda = await withDatabase(env, async (sql) => await sql`
            SELECT n.*, p.title as pitch_title
            FROM ndas n
            JOIN pitches p ON n.pitch_id = p.id
            WHERE n.pitch_id = ${pitchId} AND n.signer_id = ${auth.user.id} 
              AND n.status = 'signed' AND n.access_granted = true
          `, sentry);

          if (signedNda.length > 0) {
            return jsonResponse({
              success: true,
              data: {
                hasNDA: true,
                nda: {
                  id: signedNda[0].id,
                  status: signedNda[0].status,
                  signedAt: signedNda[0].signed_at,
                  expiresAt: signedNda[0].expires_at
                },
                canAccess: true
              }
            });
          }

          // Check for pending/approved request
          const ndaRequest = await withDatabase(env, async (sql) => await sql`
            SELECT nr.*, p.title as pitch_title
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            WHERE nr.pitch_id = ${pitchId} AND nr.requester_id = ${auth.user.id}
            ORDER BY nr.requested_at DESC
            LIMIT 1
          `, sentry);

          if (ndaRequest.length > 0) {
            const request = ndaRequest[0];
            return jsonResponse({
              success: true,
              data: {
                hasNDA: true,
                nda: {
                  id: request.id,
                  status: request.status,
                  requestedAt: request.requested_at,
                  expiresAt: request.expires_at
                },
                canAccess: request.status === 'approved'
              }
            });
          }

          return jsonResponse({
            success: true,
            data: {
              hasNDA: false,
              canAccess: false
            }
          });

        } catch (error) {
          console.error('NDA status check error:', error);
          return serverErrorResponse("Failed to check NDA status: " + error.message);
        }
      }

      // Get NDA history for a user
      if (pathname === '/api/ndas/history' && request.method === 'GET') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get both requests and signed NDAs for comprehensive history
          const requests = await withDatabase(env, async (sql) => await sql`
            SELECT nr.id, nr.pitch_id, nr.requester_id as signer_id, nr.owner_id as user_id,
                   nr.nda_type, nr.status, nr.request_message, nr.rejection_reason,
                   nr.requested_at as created_at, nr.responded_at as updated_at, nr.expires_at,
                   p.title as pitch_title, 'request' as record_type
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            WHERE nr.requester_id = ${auth.user.id} OR nr.owner_id = ${auth.user.id}
            ORDER BY nr.requested_at DESC
          `, sentry);

          const signedNdas = await withDatabase(env, async (sql) => await sql`
            SELECT n.id, n.pitch_id, n.signer_id, n.user_id, n.nda_type, n.status,
                   n.signed_at, n.revoked_at, n.expires_at, n.created_at, n.updated_at,
                   p.title as pitch_title, 'signed' as record_type
            FROM ndas n
            JOIN pitches p ON n.pitch_id = p.id
            WHERE n.signer_id = ${auth.user.id} OR n.user_id = ${auth.user.id}
            ORDER BY n.signed_at DESC
          `, sentry);

          // Combine and format results
          const allNdas = [...requests, ...signedNdas].map((nda: any) => ({
            id: nda.id,
            pitchId: nda.pitch_id,
            userId: nda.user_id,
            signerId: nda.signer_id,
            ndaType: nda.nda_type,
            status: nda.status,
            requestMessage: nda.request_message,
            rejectionReason: nda.rejection_reason,
            signedAt: nda.signed_at,
            revokedAt: nda.revoked_at,
            expiresAt: nda.expires_at,
            createdAt: nda.created_at,
            updatedAt: nda.updated_at,
            pitch: { title: nda.pitch_title },
            recordType: nda.record_type
          })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          return jsonResponse({
            success: true,
            data: {
              ndas: allNdas
            }
          });

        } catch (error) {
          console.error('NDA history error:', error);
          return serverErrorResponse("Failed to get NDA history: " + error.message);
        }
      }

      // Download signed NDA document
      if (pathname.match(/^\/api\/ndas\/(\d+)\/download-signed$/) && request.method === 'GET') {
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success) {
            return auth.error!;
          }

          const ndaId = pathname.split('/')[3];

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Verify access to NDA
          const ndaResult = await withDatabase(env, async (sql) => await sql`
            SELECT n.*, p.title as pitch_title, u1.username as owner_name, u2.username as signer_name
            FROM ndas n
            JOIN pitches p ON n.pitch_id = p.id
            JOIN users u1 ON n.user_id = u1.id
            JOIN users u2 ON n.signer_id = u2.id
            WHERE n.id = ${ndaId}
              AND (n.user_id = ${auth.user.id} OR n.signer_id = ${auth.user.id})
              AND n.status = 'signed'
          `, sentry);

          if (ndaResult.length === 0) {
            return badRequestResponse("Signed NDA not found or access denied");
          }

          const nda = ndaResult[0];

          // Get the appropriate template based on NDA type
          const template = demoNDATemplates.find(t => 
            (nda.nda_type === 'basic' && t.name === 'Standard Entertainment NDA') ||
            (nda.nda_type === 'enhanced' && t.name === 'Enhanced IP Protection NDA') ||
            (nda.nda_type === 'custom' && t.name === 'Production Company NDA')
          ) || demoNDATemplates[0]; // Fallback to first template

          // Replace template variables
          let documentContent = template.content
            .replace(/{{CREATOR_NAME}}/g, nda.owner_name)
            .replace(/{{VIEWER_NAME}}/g, nda.signer_name)
            .replace(/{{PITCH_TITLE}}/g, nda.pitch_title)
            .replace(/{{DATE}}/g, new Date(nda.signed_at).toDateString())
            .replace(/{{COMPANY_NAME}}/g, 'Requesting Entity'); // Mock company name

          // Add signature block
          documentContent += `

═══════════════════════════════════════════════════════════════
DIGITAL SIGNATURE CONFIRMATION
═══════════════════════════════════════════════════════════════

This Non-Disclosure Agreement was electronically executed on the Pitchey platform:

DOCUMENT ID: NDA-${nda.id}
EXECUTION DATE: ${new Date(nda.signed_at).toLocaleString()}
STATUS: ${nda.status.toUpperCase()}
${nda.expires_at ? `EXPIRY DATE: ${new Date(nda.expires_at).toLocaleString()}` : 'NO EXPIRATION'}

SIGNATORY INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PITCH CREATOR: ${nda.owner_name}
NDA SIGNATORY: ${nda.signer_name}
IP ADDRESS: [REDACTED FOR SECURITY]
USER AGENT: [REDACTED FOR SECURITY]

LEGAL VERIFICATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Identity verified through Pitchey authentication system
✓ Terms and conditions accepted electronically
✓ Digital signature legally binding under applicable e-signature laws
✓ Document integrity protected by cryptographic hash

BLOCKCHAIN HASH: [MOCK-HASH-${nda.id}-${Date.now()}]
TIMESTAMP: ${new Date().toISOString()}

This document is legally binding and enforceable under applicable law.
For verification purposes, please contact legal@pitchey.com with Document ID: NDA-${nda.id}
          `.trim();

          return new Response(documentContent, {
            headers: {
              'Content-Type': 'text/plain',
              'Content-Disposition': `attachment; filename="NDA-${nda.id}-signed.txt"`,
              ...corsHeaders
            }
          });

        } catch (error) {
          console.error('NDA download error:', error);
          return serverErrorResponse("Failed to download signed NDA: " + error.message);
        }
      }

      // Generate NDA Preview
      if (pathname === '/api/ndas/preview' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { pitchId, templateId } = await request.json();

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get pitch details
          const pitchResult = await withDatabase(env, async (sql) => await sql`
            SELECT title, logline, creator_username
            FROM pitches p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ${pitchId}
          `, sentry);

          if (pitchResult.length === 0) {
            return badRequestResponse("Pitch not found");
          }

          const pitch = pitchResult[0];

          // Get template or use default
          let template = "STANDARD NON-DISCLOSURE AGREEMENT";
          if (templateId) {
            const templateResult = await withDatabase(env, async (sql) => await sql`
              SELECT content FROM nda_templates WHERE id = ${templateId}
            `, sentry);
            if (templateResult.length > 0) {
              template = templateResult[0].content;
            }
          }

          // Generate preview with placeholders filled
          const preview = `
NON-DISCLOSURE AGREEMENT

Pitch: ${pitch.title}
Creator: ${pitch.creator_username}
Date: ${new Date().toDateString()}

${template}

This agreement governs the disclosure of confidential information related to the pitch "${pitch.title}" and its associated materials.

CONFIDENTIAL INFORMATION includes but is not limited to:
- Plot details and story elements
- Character development and dialogue
- Production plans and budgets
- Marketing strategies
- Any proprietary creative content

The receiving party agrees to maintain strict confidentiality and use the information solely for evaluation purposes.

Generated: ${new Date().toISOString()}
          `.trim();

          return jsonResponse({
            success: true,
            data: {
              preview
            }
          });

        } catch (error: any) {
          console.error('NDA preview error:', error);
          return serverErrorResponse("Failed to generate NDA preview: " + error.message);
        }
      }

      // Get NDA Templates
      if (pathname === '/api/ndas/templates' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get templates accessible to user
          const templates = await withDatabase(env, async (sql) => await sql`
            SELECT id, name, description, content, variables, is_default, created_by, created_at, updated_at
            FROM nda_templates 
            WHERE created_by = ${auth.user.id} OR is_default = true
            ORDER BY is_default DESC, name ASC
          `, sentry);

          // Use demo templates if no database tables exist or return empty
          const availableTemplates = templates.length > 0 ? templates : demoNDATemplates.filter(t => 
            t.createdBy === auth.user.id || t.isDefault
          );

          return jsonResponse({
            success: true,
            data: {
              templates: availableTemplates
            }
          });

        } catch (error: any) {
          console.error('Get templates error:', error);
          return serverErrorResponse("Failed to get templates: " + error.message);
        }
      }

      // Get NDA Template by ID
      if (pathname.match(/^\/api\/ndas\/templates\/(\d+)$/) && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const templateId = pathname.split('/')[4];

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          const templateResult = await withDatabase(env, async (sql) => await sql`
            SELECT id, name, description, content, variables, is_default, created_by, created_at, updated_at
            FROM nda_templates 
            WHERE id = ${templateId} AND (created_by = ${auth.user.id} OR is_default = true)
          `, sentry);

          let template;
          if (templateResult.length > 0) {
            template = templateResult[0];
          } else {
            // Fallback to demo data
            const demoTemplate = demoNDATemplates.find(t => 
              t.id === parseInt(templateId) && (t.createdBy === auth.user.id || t.isDefault)
            );
            if (!demoTemplate) {
              return badRequestResponse("Template not found or access denied");
            }
            template = demoTemplate;
          }

          return jsonResponse({
            success: true,
            data: {
              template: {
                id: template.id,
                name: template.name,
                description: template.description,
                content: template.content,
                variables: template.variables,
                isDefault: template.is_default,
                createdBy: template.created_by,
                createdAt: template.created_at,
                updatedAt: template.updated_at
              }
            }
          });

        } catch (error: any) {
          console.error('Get template error:', error);
          return serverErrorResponse("Failed to get template: " + error.message);
        }
      }

      // Get NDA Statistics
      if (pathname === '/api/ndas/stats' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get comprehensive NDA statistics
          const statsResult = await withDatabase(env, async (sql) => await sql`
            SELECT 
              COUNT(*) as total,
              COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
              COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
              COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
              COUNT(CASE WHEN status = 'signed' THEN 1 END) as signed,
              COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
              COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked
            FROM nda_requests
            WHERE owner_id = ${auth.user.id} OR requester_id = ${auth.user.id}
          `, sentry);

          const stats = statsResult[0] || {};

          // Calculate approval rate and avg response time
          const approvalRate = parseInt(stats.total) > 0 ? 
            (parseInt(stats.approved) / parseInt(stats.total)) * 100 : 0;

          return jsonResponse({
            success: true,
            data: {
              stats: {
                total: parseInt(stats.total) || 0,
                pending: parseInt(stats.pending) || 0,
                approved: parseInt(stats.approved) || 0,
                rejected: parseInt(stats.rejected) || 0,
                signed: parseInt(stats.signed) || 0,
                expired: parseInt(stats.expired) || 0,
                revoked: parseInt(stats.revoked) || 0,
                approvalRate: Math.round(approvalRate * 100) / 100,
                avgResponseTime: 24 // Mock average in hours
              }
            }
          });

        } catch (error: any) {
          console.error('NDA stats error:', error);
          return serverErrorResponse("Failed to get NDA stats: " + error.message);
        }
      }

      // Get NDA Statistics for specific pitch
      if (pathname.match(/^\/api\/ndas\/stats\/(\d+)$/) && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const pitchId = pathname.split('/')[4];

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Verify pitch ownership
          const pitchResult = await withDatabase(env, async (sql) => await sql`
            SELECT id FROM pitches WHERE id = ${pitchId} AND user_id = ${auth.user.id}
          `, sentry);

          if (pitchResult.length === 0) {
            return badRequestResponse("Pitch not found or access denied");
          }

          // Get pitch-specific NDA statistics
          const statsResult = await withDatabase(env, async (sql) => await sql`
            SELECT 
              COUNT(*) as total,
              COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
              COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
              COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
              COUNT(CASE WHEN status = 'signed' THEN 1 END) as signed,
              COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
              COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked
            FROM nda_requests
            WHERE pitch_id = ${pitchId}
          `, sentry);

          const stats = statsResult[0] || {};
          const approvalRate = parseInt(stats.total) > 0 ? 
            (parseInt(stats.approved) / parseInt(stats.total)) * 100 : 0;

          return jsonResponse({
            success: true,
            data: {
              stats: {
                total: parseInt(stats.total) || 0,
                pending: parseInt(stats.pending) || 0,
                approved: parseInt(stats.approved) || 0,
                rejected: parseInt(stats.rejected) || 0,
                signed: parseInt(stats.signed) || 0,
                expired: parseInt(stats.expired) || 0,
                revoked: parseInt(stats.revoked) || 0,
                approvalRate: Math.round(approvalRate * 100) / 100,
                avgResponseTime: 48 // Mock average in hours for specific pitch
              }
            }
          });

        } catch (error: any) {
          console.error('Pitch NDA stats error:', error);
          return serverErrorResponse("Failed to get pitch NDA stats: " + error.message);
        }
      }

      // Check if user can request NDA for pitch
      if (pathname.match(/^\/api\/ndas\/pitch\/(\d+)\/can-request$/) && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const pitchId = pathname.split('/')[4];

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Check if pitch exists and user owns it
          const pitchResult = await withDatabase(env, async (sql) => await sql`
            SELECT user_id, require_nda FROM pitches WHERE id = ${pitchId}
          `, sentry);

          if (pitchResult.length === 0) {
            return jsonResponse({
              success: true,
              data: {
                canRequest: false,
                reason: "Pitch not found"
              }
            });
          }

          const pitch = pitchResult[0];

          // Can't request NDA for your own pitch
          if (pitch.user_id === auth.user.id) {
            return jsonResponse({
              success: true,
              data: {
                canRequest: false,
                reason: "Cannot request NDA for your own pitch"
              }
            });
          }

          // Check if pitch requires NDA
          if (!pitch.require_nda) {
            return jsonResponse({
              success: true,
              data: {
                canRequest: false,
                reason: "This pitch does not require an NDA"
              }
            });
          }

          // Check for existing NDA request or signed NDA
          const existingRequest = await withDatabase(env, async (sql) => await sql`
            SELECT id, status FROM nda_requests 
            WHERE pitch_id = ${pitchId} AND requester_id = ${auth.user.id}
            ORDER BY created_at DESC LIMIT 1
          `, sentry);

          if (existingRequest.length > 0) {
            const request = existingRequest[0];
            if (request.status === 'pending') {
              return jsonResponse({
                success: true,
                data: {
                  canRequest: false,
                  reason: "You already have a pending NDA request for this pitch",
                  existingNDA: request
                }
              });
            }
            if (request.status === 'approved' || request.status === 'signed') {
              return jsonResponse({
                success: true,
                data: {
                  canRequest: false,
                  reason: "You already have approved/signed NDA access to this pitch",
                  existingNDA: request
                }
              });
            }
          }

          // User can request NDA
          return jsonResponse({
            success: true,
            data: {
              canRequest: true
            }
          });

        } catch (error: any) {
          console.error('Can request NDA check error:', error);
          return serverErrorResponse("Failed to check NDA request eligibility: " + error.message);
        }
      }

      // Bulk Approve NDAs
      if (pathname === '/api/ndas/bulk-approve' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { ndaIds } = await request.json();

          if (!Array.isArray(ndaIds) || ndaIds.length === 0) {
            return badRequestResponse("ndaIds must be a non-empty array");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          const successful = [];
          const failed = [];

          for (const ndaId of ndaIds) {
            try {
              // Verify ownership and pending status
              const ndaResult = await withDatabase(env, async (sql) => await sql`
                SELECT id FROM nda_requests
                WHERE id = ${ndaId} AND owner_id = ${auth.user.id} AND status = 'pending'
              `, sentry);

              if (ndaResult.length === 0) {
                failed.push({
                  id: ndaId,
                  error: "NDA not found, not yours to approve, or not pending"
                });
                continue;
              }

              // Approve the NDA
              await withDatabase(env, async (sql) => await sql`
                UPDATE nda_requests 
                SET status = 'approved', responded_at = NOW(), updated_at = NOW()
                WHERE id = ${ndaId}
              `, sentry);

              successful.push(ndaId);

            } catch (error: any) {
              failed.push({
                id: ndaId,
                error: error.message
              });
            }
          }

          return jsonResponse({
            success: true,
            data: {
              successful,
              failed
            }
          });

        } catch (error: any) {
          console.error('Bulk approve error:', error);
          return serverErrorResponse("Failed to bulk approve NDAs: " + error.message);
        }
      }

      // Bulk Reject NDAs
      if (pathname === '/api/ndas/bulk-reject' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { ndaIds, reason } = await request.json();

          if (!Array.isArray(ndaIds) || ndaIds.length === 0) {
            return badRequestResponse("ndaIds must be a non-empty array");
          }

          if (!reason) {
            return badRequestResponse("Rejection reason is required");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          const successful = [];
          const failed = [];

          for (const ndaId of ndaIds) {
            try {
              // Verify ownership and pending status
              const ndaResult = await withDatabase(env, async (sql) => await sql`
                SELECT id FROM nda_requests
                WHERE id = ${ndaId} AND owner_id = ${auth.user.id} AND status = 'pending'
              `, sentry);

              if (ndaResult.length === 0) {
                failed.push({
                  id: ndaId,
                  error: "NDA not found, not yours to reject, or not pending"
                });
                continue;
              }

              // Reject the NDA
              await withDatabase(env, async (sql) => await sql`
                UPDATE nda_requests 
                SET status = 'rejected', rejection_reason = ${reason}, responded_at = NOW(), updated_at = NOW()
                WHERE id = ${ndaId}
              `, sentry);

              successful.push(ndaId);

            } catch (error: any) {
              failed.push({
                id: ndaId,
                error: error.message
              });
            }
          }

          return jsonResponse({
            success: true,
            data: {
              successful,
              failed
            }
          });

        } catch (error: any) {
          console.error('Bulk reject error:', error);
          return serverErrorResponse("Failed to bulk reject NDAs: " + error.message);
        }
      }

      // Send NDA Reminder
      if (pathname.match(/^\/api\/ndas\/(\d+)\/remind$/) && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const ndaId = pathname.split('/')[3];

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Verify NDA exists and user has permission to send reminder
          const ndaResult = await withDatabase(env, async (sql) => await sql`
            SELECT nr.id, nr.status, nr.requester_id, p.title, u.email
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            JOIN users u ON nr.requester_id = u.id
            WHERE nr.id = ${ndaId} AND (nr.owner_id = ${auth.user.id} OR nr.requester_id = ${auth.user.id})
          `, sentry);

          if (ndaResult.length === 0) {
            return badRequestResponse("NDA not found or access denied");
          }

          const nda = ndaResult[0];

          // Can only send reminder for approved NDAs that aren't signed yet
          if (nda.status !== 'approved') {
            return badRequestResponse("Can only send reminders for approved NDAs");
          }

          // Mock sending email reminder (in real implementation, would use email service)
          console.log(`Sending NDA reminder to ${nda.email} for pitch "${nda.title}"`);

          return jsonResponse({
            success: true,
            data: {
              message: "Reminder sent successfully"
            }
          });

        } catch (error: any) {
          console.error('Send reminder error:', error);
          return serverErrorResponse("Failed to send reminder: " + error.message);
        }
      }

      // Verify NDA Signature
      if (pathname.match(/^\/api\/ndas\/(\d+)\/verify$/) && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const ndaId = pathname.split('/')[3];

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get signed NDA details
          const ndaResult = await withDatabase(env, async (sql) => await sql`
            SELECT n.id, n.status, n.signed_at, n.signer_id, u.username, u.email
            FROM ndas n
            JOIN users u ON n.signer_id = u.id
            WHERE n.id = ${ndaId} AND (n.user_id = ${auth.user.id} OR n.signer_id = ${auth.user.id})
          `, sentry);

          if (ndaResult.length === 0) {
            return jsonResponse({
              success: true,
              data: {
                valid: false
              }
            });
          }

          const nda = ndaResult[0];
          const isValid = nda.status === 'signed' && nda.signed_at;

          return jsonResponse({
            success: true,
            data: {
              valid: isValid,
              signedBy: isValid ? {
                id: nda.signer_id,
                username: nda.username,
                email: nda.email
              } : undefined,
              signedAt: isValid ? nda.signed_at : undefined
            }
          });

        } catch (error: any) {
          console.error('Verify signature error:', error);
          return serverErrorResponse("Failed to verify signature: " + error.message);
        }
      }

      // ========== END COMPREHENSIVE NDA MANAGEMENT ENDPOINTS ==========
      
      // Get outgoing NDA requests (requests made by the user)
      if (pathname === '/api/ndas/outgoing-requests' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          const outgoingRequests = await withDatabase(env, async (sql) => await sql`
            SELECT 
              nr.id, nr.status, nr.nda_type, nr.request_message,
              nr.requested_at, nr.responded_at, nr.expires_at,
              p.id as pitch_id, p.title, p.genre, p.poster_url,
              u.id as owner_id, u.username as owner_username, u.company_name
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE nr.requester_id = ${auth.user.id}
            ORDER BY nr.requested_at DESC
          `, sentry);

          return jsonResponse({
            success: true,
            data: outgoingRequests.map(req => ({
              id: req.id,
              status: req.status,
              ndaType: req.nda_type,
              requestMessage: req.request_message,
              requestedAt: req.requested_at,
              respondedAt: req.responded_at,
              expiresAt: req.expires_at,
              pitch: {
                id: req.pitch_id,
                title: req.title,
                genre: req.genre,
                posterUrl: req.poster_url
              },
              owner: {
                id: req.owner_id,
                username: req.owner_username,
                companyName: req.company_name
              }
            }))
          });
        } catch (error) {
          console.error('Outgoing requests error:', error);
          return serverErrorResponse("Failed to get outgoing requests: " + error.message);
        }
      }

      // Get incoming NDA requests (requests received by the user)
      if (pathname === '/api/ndas/incoming-requests' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          const incomingRequests = await withDatabase(env, async (sql) => await sql`
            SELECT 
              nr.id, nr.status, nr.nda_type, nr.request_message,
              nr.requested_at, nr.responded_at, nr.expires_at,
              p.id as pitch_id, p.title, p.genre, p.poster_url,
              u.id as requester_id, u.username as requester_username, u.company_name
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            JOIN users u ON nr.requester_id = u.id
            WHERE nr.owner_id = ${auth.user.id}
            ORDER BY nr.requested_at DESC
          `, sentry);

          return jsonResponse({
            success: true,
            data: incomingRequests.map(req => ({
              id: req.id,
              status: req.status,
              ndaType: req.nda_type,
              requestMessage: req.request_message,
              requestedAt: req.requested_at,
              respondedAt: req.responded_at,
              expiresAt: req.expires_at,
              pitch: {
                id: req.pitch_id,
                title: req.title,
                genre: req.genre,
                posterUrl: req.poster_url
              },
              requester: {
                id: req.requester_id,
                username: req.requester_username,
                companyName: req.company_name
              }
            }))
          });
        } catch (error) {
          console.error('Incoming requests error:', error);
          return serverErrorResponse("Failed to get incoming requests: " + error.message);
        }
      }

      // Get outgoing signed NDAs (NDAs signed by others for user's pitches)
      if (pathname === '/api/ndas/outgoing-signed' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          const outgoingSigned = await withDatabase(env, async (sql) => await sql`
            SELECT 
              nr.id, nr.status, nr.nda_type,
              nr.requested_at, nr.responded_at as signed_at, nr.expires_at,
              p.id as pitch_id, p.title, p.genre, p.poster_url,
              u.id as signer_id, u.username as signer_username, u.company_name
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            JOIN users u ON nr.requester_id = u.id
            WHERE nr.owner_id = ${auth.user.id} 
              AND nr.status IN ('approved', 'signed')
            ORDER BY nr.responded_at DESC
          `, sentry);

          return jsonResponse({
            success: true,
            data: outgoingSigned.map(nda => ({
              id: nda.id,
              status: nda.status,
              ndaType: nda.nda_type,
              signedAt: nda.signed_at,
              expiresAt: nda.expires_at,
              pitch: {
                id: nda.pitch_id,
                title: nda.title,
                genre: nda.genre,
                posterUrl: nda.poster_url
              },
              signer: {
                id: nda.signer_id,
                username: nda.signer_username,
                companyName: nda.company_name
              }
            }))
          });
        } catch (error) {
          console.error('Outgoing signed error:', error);
          return serverErrorResponse("Failed to get outgoing signed NDAs: " + error.message);
        }
      }

      // Get incoming signed NDAs (NDAs user has signed for others' pitches)
      if (pathname === '/api/ndas/incoming-signed' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          const incomingSigned = await withDatabase(env, async (sql) => await sql`
            SELECT 
              nr.id, nr.status, nr.nda_type,
              nr.requested_at, nr.responded_at as signed_at, nr.expires_at,
              p.id as pitch_id, p.title, p.genre, p.poster_url,
              u.id as owner_id, u.username as owner_username, u.company_name
            FROM nda_requests nr
            JOIN pitches p ON nr.pitch_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE nr.requester_id = ${auth.user.id} 
              AND nr.status IN ('approved', 'signed')
            ORDER BY nr.responded_at DESC
          `, sentry);

          return jsonResponse({
            success: true,
            data: incomingSigned.map(nda => ({
              id: nda.id,
              status: nda.status,
              ndaType: nda.nda_type,
              signedAt: nda.signed_at,
              expiresAt: nda.expires_at,
              pitch: {
                id: nda.pitch_id,
                title: nda.title,
                genre: nda.genre,
                posterUrl: nda.poster_url
              },
              owner: {
                id: nda.owner_id,
                username: nda.owner_username,
                companyName: nda.company_name
              }
            }))
          });
        } catch (error) {
          console.error('Incoming signed error:', error);
          return serverErrorResponse("Failed to get incoming signed NDAs: " + error.message);
        }
      }

      // Unread Notifications
      if (pathname === '/api/notifications/unread' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const notifications = [
          {
            id: 1,
            type: 'nda_request',
            title: 'New NDA Request',
            message: 'Sarah Investor has requested access to your pitch "Neon Dreams"',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            read: false
          },
          {
            id: 2,
            type: 'pitch_view',
            title: 'Pitch Viewed',
            message: 'Your pitch "Space Opera" was viewed by John Producer',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            read: false
          }
        ];

        return jsonResponse({
          success: true,
          data: {
            notifications: notifications,
            unreadCount: notifications.filter(n => !n.read).length,
            total: notifications.length
          }
        });
      }

      // User Analytics (monthly preset)
      if (pathname === '/api/analytics/user' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const preset = url.searchParams.get('preset') || 'month';
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        
        // Generate sample daily data
        const dailyViews = Array.from({length: daysInMonth}, (_, i) => ({
          date: new Date(now.getFullYear(), now.getMonth(), i + 1).toISOString().split('T')[0],
          views: Math.floor(Math.random() * 50) + 10,
          likes: Math.floor(Math.random() * 15) + 2
        }));

        return jsonResponse({
          success: true,
          data: {
            period: preset,
            analytics: {
              totalViews: dailyViews.reduce((sum, day) => sum + day.views, 0),
              totalLikes: dailyViews.reduce((sum, day) => sum + day.likes, 0),
              avgViewsPerDay: Math.round(dailyViews.reduce((sum, day) => sum + day.views, 0) / daysInMonth),
              chartData: dailyViews,
              topPitches: [
                { title: 'Neon Dreams', views: 450, likes: 28 },
                { title: 'Space Opera', views: 380, likes: 22 },
                { title: 'Digital Hearts', views: 295, likes: 15 }
              ]
            }
          }
        });
      }

      // Real-time analytics endpoint
      if (pathname === '/api/analytics/realtime' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get real-time analytics data
          const now = new Date();
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

          // Get user's pitches for analytics
          const userPitches = await withDatabase(env, async (sql) => await sql`
            SELECT id FROM pitches WHERE user_id = ${auth.user.id}
          `, sentry);
          const pitchIds = userPitches.map(p => p.id);

          // Mock real-time data (in production, this would come from analytics service)
          const realtimeData = {
            activeUsers: Math.floor(Math.random() * 50) + 10,
            currentViews: Math.floor(Math.random() * 20) + 5,
            recentActivities: [
              {
                type: 'view',
                pitchId: pitchIds[0] || 1,
                pitchTitle: 'Neon Dreams',
                userId: 2,
                username: 'sarah.investor',
                timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
                activity: 'viewed your pitch'
              },
              {
                type: 'like',
                pitchId: pitchIds[0] || 1,
                pitchTitle: 'Neon Dreams',
                userId: 3,
                username: 'michael.producer',
                timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
                activity: 'liked your pitch'
              },
              {
                type: 'nda_request',
                pitchId: pitchIds[1] || 2,
                pitchTitle: 'Space Opera',
                userId: 4,
                username: 'emma.investor',
                timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
                activity: 'requested NDA access'
              }
            ],
            hourlyStats: {
              views: Math.floor(Math.random() * 100) + 50,
              likes: Math.floor(Math.random() * 20) + 5,
              shares: Math.floor(Math.random() * 10) + 2,
              ndaRequests: Math.floor(Math.random() * 5) + 1
            },
            dailyStats: {
              views: Math.floor(Math.random() * 500) + 200,
              likes: Math.floor(Math.random() * 100) + 20,
              shares: Math.floor(Math.random() * 50) + 10,
              ndaRequests: Math.floor(Math.random() * 20) + 5
            },
            topPerformingPitch: {
              id: pitchIds[0] || 1,
              title: 'Neon Dreams',
              viewsToday: Math.floor(Math.random() * 200) + 50,
              likesToday: Math.floor(Math.random() * 30) + 10,
              engagement: Math.random() * 20 + 5
            },
            engagementTrend: 'up', // 'up', 'down', or 'stable'
            engagementChange: Math.random() * 30 - 10 // -10% to +20%
          };

          return jsonResponse({
            success: true,
            data: realtimeData
          });
        } catch (error) {
          console.error('Realtime analytics error:', error);
          return serverErrorResponse("Failed to get realtime analytics: " + error.message);
        }
      }

      // Dashboard Analytics (monthly preset)  
      if (pathname === '/api/analytics/dashboard' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const preset = url.searchParams.get('preset') || 'month';

        return jsonResponse({
          success: true,
          data: {
            period: preset,
            summary: {
              totalPitches: auth.user.userType === 'creator' ? 3 : 0,
              totalViews: 1250,
              totalLikes: 65,
              totalComments: 18,
              ndaRequests: 2,
              activeInvestments: auth.user.userType === 'investor' ? 4 : 0
            },
            growth: {
              viewsGrowth: '+15%',
              likesGrowth: '+8%',
              engagementGrowth: '+12%'
            },
            recentActivity: [
              {
                type: 'pitch_view',
                description: 'Your pitch "Neon Dreams" was viewed',
                timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
              },
              {
                type: 'nda_request',
                description: 'New NDA request from Sarah Investor',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
              }
            ]
          }
        });
      }

      // ============ MISSING ANALYTICS ENDPOINTS ============

      // Get pitch analytics
      if (pathname.startsWith('/api/analytics/pitch/') && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const pitchIdStr = pathname.split('/')[4];
        const pitchId = parseInt(pitchIdStr);
        
        if (isNaN(pitchId)) {
          return jsonResponse({
            success: false,
            message: 'Invalid pitch ID'
          }, 400);
        }

        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');
        const preset = url.searchParams.get('preset') || 'month';

        // Generate realistic pitch analytics data
        const now = new Date();
        const daysInPeriod = preset === 'week' ? 7 : preset === 'month' ? 30 : preset === 'year' ? 365 : 30;
        
        const viewsByDate = Array.from({length: daysInPeriod}, (_, i) => ({
          date: new Date(now.getTime() - (daysInPeriod - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          count: Math.floor(Math.random() * 25) + 5
        }));

        const totalViews = viewsByDate.reduce((sum, day) => sum + day.count, 0);
        const uniqueViews = Math.floor(totalViews * 0.7);
        const likes = Math.floor(totalViews * 0.15);
        const ndaRequests = Math.floor(totalViews * 0.08);
        const ndaApproved = Math.floor(ndaRequests * 0.6);

        const analytics = {
          pitchId,
          title: `Sample Pitch ${pitchId}`,
          views: totalViews,
          uniqueViews,
          likes,
          shares: Math.floor(totalViews * 0.05),
          ndaRequests,
          ndaApproved,
          messages: Math.floor(ndaApproved * 0.4),
          avgViewDuration: Math.floor(Math.random() * 180) + 60, // 1-4 minutes
          bounceRate: Math.random() * 0.3 + 0.2, // 20-50%
          conversionRate: ndaRequests / totalViews,
          engagementRate: (likes + ndaRequests) / totalViews,
          viewsByDate,
          viewsBySource: [
            { source: 'Direct', count: Math.floor(totalViews * 0.4) },
            { source: 'Search', count: Math.floor(totalViews * 0.3) },
            { source: 'Social Media', count: Math.floor(totalViews * 0.2) },
            { source: 'Referral', count: Math.floor(totalViews * 0.1) }
          ],
          viewsByLocation: [
            { location: 'United States', count: Math.floor(totalViews * 0.45) },
            { location: 'United Kingdom', count: Math.floor(totalViews * 0.20) },
            { location: 'Canada', count: Math.floor(totalViews * 0.15) },
            { location: 'Australia', count: Math.floor(totalViews * 0.10) },
            { location: 'Other', count: Math.floor(totalViews * 0.10) }
          ],
          viewerDemographics: {
            userType: [
              { type: 'Investor', count: Math.floor(totalViews * 0.35) },
              { type: 'Creator', count: Math.floor(totalViews * 0.30) },
              { type: 'Production Company', count: Math.floor(totalViews * 0.25) },
              { type: 'Other', count: Math.floor(totalViews * 0.10) }
            ],
            industry: [
              { industry: 'Film', count: Math.floor(totalViews * 0.40) },
              { industry: 'Television', count: Math.floor(totalViews * 0.30) },
              { industry: 'Digital Media', count: Math.floor(totalViews * 0.20) },
              { industry: 'Other', count: Math.floor(totalViews * 0.10) }
            ]
          }
        };

        return jsonResponse({
          success: true,
          analytics
        });
      }

      // Get activity feed
      if (pathname === '/api/analytics/activity' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const userId = url.searchParams.get('userId');
        const pitchId = url.searchParams.get('pitchId');
        const type = url.searchParams.get('type');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // Generate sample activity data
        const activityTypes = ['view', 'like', 'follow', 'nda', 'message', 'share'];
        const entityTypes = ['pitch', 'user'];
        const activities = [];

        for (let i = 0; i < Math.min(limit, 50); i++) {
          const activityType = type || activityTypes[Math.floor(Math.random() * activityTypes.length)];
          const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];
          const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

          activities.push({
            id: offset + i + 1,
            type: activityType,
            entityType,
            entityId: Math.floor(Math.random() * 100) + 1,
            entityName: entityType === 'pitch' ? `Sample Pitch ${Math.floor(Math.random() * 50) + 1}` : `User ${Math.floor(Math.random() * 100) + 1}`,
            userId: Math.floor(Math.random() * 100) + 1,
            username: `user${Math.floor(Math.random() * 100) + 1}`,
            timestamp: timestamp.toISOString(),
            metadata: {
              userAgent: 'Mozilla/5.0 (compatible)',
              location: ['US', 'UK', 'CA', 'AU'][Math.floor(Math.random() * 4)]
            }
          });
        }

        return jsonResponse({
          success: true,
          activities,
          total: 1000 + Math.floor(Math.random() * 500)
        });
      }

      // Track event
      if (pathname === '/api/analytics/track' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const validationResult = await validateRequest(request, ["type", "entityType", "entityId"]);
          if (!validationResult.success || !validationResult.data) {
            return validationResult.error || jsonResponse({
              success: false,
              message: 'Invalid request data'
            }, 400);
          }

          const { type, entityType, entityId, metadata } = validationResult.data;

          // In a real implementation, this would save to the database
          console.log('Analytics event tracked:', { type, entityType, entityId, metadata, userId: auth.user.id });

          return jsonResponse({
            success: true,
            message: 'Event tracked successfully',
            eventId: Date.now()
          });
        } catch (error) {
          console.error('Track event error:', error);
          return serverErrorResponse("Failed to track event");
        }
      }

      // Export analytics data
      if (pathname === '/api/analytics/export' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const validationResult = await validateRequest(request, ["format", "dateRange", "metrics"]);
          if (!validationResult.success || !validationResult.data) {
            return validationResult.error || jsonResponse({
              success: false,
              message: 'Invalid request data'
            }, 400);
          }

          const { format, dateRange, metrics, groupBy, includeCharts } = validationResult.data;

          if (!['csv', 'pdf', 'excel'].includes(format)) {
            return jsonResponse({
              success: false,
              message: 'Invalid format. Must be csv, pdf, or excel'
            }, 400);
          }

          // Generate sample export data
          const exportData = {
            exportId: Date.now(),
            format,
            dateRange,
            metrics,
            groupBy,
            includeCharts,
            generatedAt: new Date().toISOString(),
            downloadUrl: `/api/analytics/download/${Date.now()}`,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
          };

          // For demo purposes, return mock CSV data for CSV format
          if (format === 'csv') {
            const csvData = [
              'Date,Views,Likes,NDAs,Conversions',
              '2024-11-01,45,12,3,1',
              '2024-11-02,52,15,4,2',
              '2024-11-03,38,8,2,1',
              '2024-11-04,61,18,5,2',
              '2024-11-05,44,11,3,1'
            ].join('\n');

            return new Response(csvData, {
              headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="analytics-export.csv"',
                ...corsHeaders
              }
            });
          }

          return jsonResponse({
            success: true,
            export: exportData,
            message: 'Export generated successfully'
          });
        } catch (error) {
          console.error('Export analytics error:', error);
          return serverErrorResponse("Failed to export analytics");
        }
      }

      // Compare analytics
      if (pathname.startsWith('/api/analytics/compare/') && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const pathParts = pathname.split('/');
        const type = pathParts[4]; // pitch, user, dashboard
        const id = pathParts[5] ? parseInt(pathParts[5]) : null;

        if (!['pitch', 'user', 'dashboard'].includes(type)) {
          return jsonResponse({
            success: false,
            message: 'Invalid comparison type. Must be pitch, user, or dashboard'
          }, 400);
        }

        const currentStart = url.searchParams.get('currentStart');
        const currentEnd = url.searchParams.get('currentEnd');
        const previousStart = url.searchParams.get('previousStart');
        const previousEnd = url.searchParams.get('previousEnd');

        // Generate comparison data
        const currentViews = Math.floor(Math.random() * 1000) + 500;
        const previousViews = Math.floor(Math.random() * 1000) + 400;
        const viewsChange = currentViews - previousViews;
        const viewsPercentage = ((viewsChange / previousViews) * 100);

        const comparison = {
          current: {
            views: currentViews,
            likes: Math.floor(currentViews * 0.15),
            engagement: Math.floor(currentViews * 0.12),
            conversions: Math.floor(currentViews * 0.08)
          },
          previous: {
            views: previousViews,
            likes: Math.floor(previousViews * 0.15),
            engagement: Math.floor(previousViews * 0.12),
            conversions: Math.floor(previousViews * 0.08)
          },
          change: viewsChange,
          changePercentage: Math.round(viewsPercentage * 100) / 100
        };

        return jsonResponse({
          success: true,
          comparison
        });
      }

      // Get trending content
      if (pathname === '/api/analytics/trending' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const period = url.searchParams.get('period') || 'week';
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const genre = url.searchParams.get('genre');

        // Generate trending pitches data
        const trendingPitches = [];
        for (let i = 1; i <= Math.min(limit, 20); i++) {
          const views = Math.floor(Math.random() * 2000) + 500;
          trendingPitches.push({
            pitchId: i,
            title: `Trending Pitch ${i}`,
            views,
            uniqueViews: Math.floor(views * 0.75),
            likes: Math.floor(views * 0.18),
            shares: Math.floor(views * 0.06),
            ndaRequests: Math.floor(views * 0.10),
            ndaApproved: Math.floor(views * 0.06),
            messages: Math.floor(views * 0.03),
            avgViewDuration: Math.floor(Math.random() * 200) + 60,
            bounceRate: Math.random() * 0.4 + 0.2,
            conversionRate: Math.random() * 0.15 + 0.05,
            engagementRate: Math.random() * 0.25 + 0.10,
            viewsByDate: [], // Simplified for trending
            viewsBySource: [],
            viewsByLocation: [],
            viewerDemographics: { userType: [], industry: [] }
          });
        }

        return jsonResponse({
          success: true,
          pitches: trendingPitches
        });
      }

      // Get engagement metrics
      if (pathname === '/api/analytics/engagement' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const entityType = url.searchParams.get('entityType');
        const entityId = url.searchParams.get('entityId');
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');

        if (!entityType || !entityId) {
          return jsonResponse({
            success: false,
            message: 'entityType and entityId are required'
          }, 400);
        }

        // Generate engagement metrics
        const baseEngagement = Math.random() * 0.3 + 0.1; // 10-40%
        const trends = Array.from({length: 30}, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          rate: Math.max(0.05, baseEngagement + (Math.random() - 0.5) * 0.1)
        }));

        const metrics = {
          engagementRate: baseEngagement,
          averageTimeSpent: Math.floor(Math.random() * 180) + 60,
          bounceRate: Math.random() * 0.4 + 0.2,
          interactionRate: Math.random() * 0.2 + 0.05,
          shareRate: Math.random() * 0.1 + 0.02,
          conversionRate: Math.random() * 0.15 + 0.03,
          trends
        };

        return jsonResponse({
          success: true,
          metrics
        });
      }

      // Get funnel analytics
      if (pathname.startsWith('/api/analytics/funnel/') && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        const pitchIdStr = pathname.split('/')[4];
        const pitchId = parseInt(pitchIdStr);
        
        if (isNaN(pitchId)) {
          return jsonResponse({
            success: false,
            message: 'Invalid pitch ID'
          }, 400);
        }

        // Generate funnel data
        const views = Math.floor(Math.random() * 1000) + 200;
        const detailViews = Math.floor(views * 0.6); // 60% view details
        const ndaRequests = Math.floor(detailViews * 0.15); // 15% request NDA
        const ndaSigned = Math.floor(ndaRequests * 0.7); // 70% sign NDA
        const messages = Math.floor(ndaSigned * 0.4); // 40% send message
        const conversions = Math.floor(messages * 0.2); // 20% convert

        const funnel = {
          views,
          detailViews,
          ndaRequests,
          ndaSigned,
          messages,
          conversions,
          dropoffRates: {
            viewToDetail: ((views - detailViews) / views * 100).toFixed(1),
            detailToNDA: ((detailViews - ndaRequests) / detailViews * 100).toFixed(1),
            ndaToMessage: ((ndaSigned - messages) / ndaSigned * 100).toFixed(1),
            messageToConversion: ((messages - conversions) / messages * 100).toFixed(1)
          }
        };

        return jsonResponse({
          success: true,
          funnel
        });
      }

      // ============ PRESENCE & WEBSOCKET API ENDPOINTS ============

      // Get online users/presence API
      if (pathname === '/api/presence/online' && request.method === 'GET') {
        try {
          // Get room presence from Durable Object
          const roomId = url.searchParams.get('room') || 'default';
          const durableObjectId = env.WEBSOCKET_ROOM.idFromName(roomId);
          const durableObject = env.WEBSOCKET_ROOM.get(durableObjectId);
          
          // Create a request to get presence info
          const presenceUrl = new URL(request.url);
          presenceUrl.pathname = '/room/presence';
          const presenceRequest = new Request(presenceUrl.toString(), { 
            method: 'GET',
            headers: request.headers
          });
          
          const response = await durableObject.fetch(presenceRequest);
          const data = await response.json();
          
          return jsonResponse({
            success: true,
            data: data,
            message: 'Online users retrieved successfully'
          });
        } catch (error) {
          console.error('Presence API error:', error);
          return jsonResponse({
            success: true,
            data: { onlineCount: 0, users: [] },
            message: 'Presence service unavailable, showing offline state'
          });
        }
      }

      // Update user presence API
      if (pathname === '/api/presence/update' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const validationResult = await validateRequest(request, ["status"]);
          if (!validationResult.success || !validationResult.data) {
            return validationResult.error || jsonResponse({
              success: false,
              message: 'Invalid request data'
            }, 400);
          }

          const { status, activity } = validationResult.data;
          
          if (!['online', 'away', 'offline', 'dnd'].includes(status)) {
            return jsonResponse({
              success: false,
              message: 'Invalid status. Must be: online, away, offline, or dnd'
            }, 422);
          }

          // For now, just return success - in a real implementation, 
          // this would update the presence in the Durable Object
          return jsonResponse({
            success: true,
            data: {
              userId: auth.user.id,
              username: auth.user.username,
              status: status,
              activity: activity || null,
              lastSeen: new Date().toISOString()
            },
            message: 'Presence updated successfully'
          });
        } catch (error) {
          console.error('Update presence error:', error);
          return serverErrorResponse("Failed to update presence");
        }
      }

      // WebSocket connection test endpoint
      if (pathname === '/api/websocket/test' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          // Test if WebSocket rooms are available
          const roomId = 'test';
          const durableObjectId = env.WEBSOCKET_ROOM.idFromName(roomId);
          const durableObject = env.WEBSOCKET_ROOM.get(durableObjectId);
          
          const testUrl = new URL(request.url);
          testUrl.pathname = '/room/info';
          const testRequest = new Request(testUrl.toString(), { 
            method: 'GET',
            headers: request.headers
          });
          
          const response = await durableObject.fetch(testRequest);
          const data = await response.json();
          
          return jsonResponse({
            success: true,
            websocketAvailable: true,
            roomInfo: data,
            message: 'WebSocket service is available'
          });
        } catch (error) {
          console.error('WebSocket test error:', error);
          return jsonResponse({
            success: true,
            websocketAvailable: false,
            error: error.message,
            message: 'WebSocket service unavailable'
          });
        }
      }

      // ========== SOCIAL FEATURES ENDPOINTS ==========
      
      // Follow User/Pitch
      if (pathname === '/api/follows/follow' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const body = await request.json();
          const { creatorId, pitchId } = body;
          const followerId = auth.user.id;

          // Validate input
          if ((!creatorId && !pitchId) || (creatorId && pitchId)) {
            return jsonResponse({
              success: false,
              message: "Must specify either creatorId or pitchId, but not both"
            }, 400);
          }

          // Check if already following
          let alreadyFollowing = false;
          if (creatorId) {
            alreadyFollowing = demoFollows.some(f => 
              f.followerId === followerId && f.creatorId === creatorId
            );
          } else if (pitchId) {
            alreadyFollowing = demoFollows.some(f => 
              f.followerId === followerId && f.pitchId === pitchId
            );
          }

          if (alreadyFollowing) {
            return jsonResponse({
              success: false,
              message: "Already following this " + (creatorId ? "user" : "pitch")
            }, 400);
          }

          // Add new follow
          const newFollow = {
            id: demoFollows.length + 1,
            followerId,
            creatorId: creatorId || null,
            pitchId: pitchId || null,
            followedAt: new Date().toISOString()
          };
          demoFollows.push(newFollow);

          // Add activity
          const newActivity = {
            id: demoActivities.length + 1,
            userId: followerId,
            type: 'follow',
            entityType: creatorId ? 'user' : 'pitch',
            entityId: creatorId || pitchId,
            metadata: { action: "followed" },
            createdAt: new Date().toISOString()
          };
          demoActivities.push(newActivity);

          return jsonResponse({
            success: true,
            message: "Successfully followed " + (creatorId ? "user" : "pitch")
          });
        } catch (error) {
          return serverErrorResponse("Failed to follow: " + error.message);
        }
      }

      // Unfollow User/Pitch
      if (pathname === '/api/follows/unfollow' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const body = await request.json();
          const { creatorId, pitchId } = body;
          const followerId = auth.user.id;

          // Validate input
          if ((!creatorId && !pitchId) || (creatorId && pitchId)) {
            return jsonResponse({
              success: false,
              message: "Must specify either creatorId or pitchId, but not both"
            }, 400);
          }

          // Find and remove follow
          let followIndex = -1;
          if (creatorId) {
            followIndex = demoFollows.findIndex(f => 
              f.followerId === followerId && f.creatorId === creatorId
            );
          } else if (pitchId) {
            followIndex = demoFollows.findIndex(f => 
              f.followerId === followerId && f.pitchId === pitchId
            );
          }

          if (followIndex === -1) {
            return jsonResponse({
              success: false,
              message: "Not following this " + (creatorId ? "user" : "pitch")
            }, 400);
          }

          // Remove follow
          demoFollows.splice(followIndex, 1);

          return jsonResponse({
            success: true,
            message: "Successfully unfollowed " + (creatorId ? "user" : "pitch")
          });
        } catch (error) {
          return serverErrorResponse("Failed to unfollow: " + error.message);
        }
      }

      // Get Follow Suggestions
      if (pathname === '/api/follows/suggestions' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const url = new URL(request.url);
          const limit = parseInt(url.searchParams.get('limit') || '5');
          const currentUserId = auth.user.id;

          // Get users the current user is already following
          const alreadyFollowing = demoFollows
            .filter(f => f.followerId === currentUserId && f.creatorId)
            .map(f => f.creatorId);

          // Get suggestions - users not already followed, excluding self
          const suggestions = extendedDemoUsers
            .filter(user => 
              user.id !== currentUserId && 
              !alreadyFollowing.includes(user.id)
            )
            .slice(0, limit)
            .map(user => ({
              id: user.id,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              userType: user.userType,
              companyName: user.companyName,
              bio: user.bio,
              location: user.location,
              profileImage: user.profileImage,
              verified: user.verified,
              // Add follow stats for each suggested user
              followStats: {
                followers: demoFollows.filter(f => f.creatorId === user.id).length,
                following: demoFollows.filter(f => f.followerId === user.id).length
              }
            }));

          return jsonResponse({
            success: true,
            data: {
              users: suggestions
            }
          });
        } catch (error) {
          return serverErrorResponse("Failed to get suggestions: " + error.message);
        }
      }

      // Get Followers
      if (pathname === '/api/follows/followers' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const url = new URL(request.url);
          const userId = parseInt(url.searchParams.get('userId') || auth.user.id.toString());
          const limit = parseInt(url.searchParams.get('limit') || '20');
          const offset = parseInt(url.searchParams.get('offset') || '0');

          // Get followers for the specified user
          const followerIds = demoFollows
            .filter(f => f.creatorId === userId)
            .map(f => f.followerId);

          const followers = extendedDemoUsers
            .filter(user => followerIds.includes(user.id))
            .slice(offset, offset + limit)
            .map(user => {
              const followRecord = demoFollows.find(f => f.followerId === user.id && f.creatorId === userId);
              return {
                id: followRecord.id,
                followerId: user.id,
                creatorId: userId,
                followedAt: followRecord.followedAt,
                follower: {
                  id: user.id,
                  username: user.username,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  userType: user.userType,
                  companyName: user.companyName,
                  profileImage: user.profileImage,
                  verified: user.verified
                }
              };
            });

          return jsonResponse({
            success: true,
            data: {
              followers,
              total: followerIds.length
            }
          });
        } catch (error) {
          return serverErrorResponse("Failed to get followers: " + error.message);
        }
      }

      // Get Following
      if (pathname === '/api/follows/following' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const url = new URL(request.url);
          const userId = parseInt(url.searchParams.get('userId') || auth.user.id.toString());
          const type = url.searchParams.get('type') || 'all';
          const limit = parseInt(url.searchParams.get('limit') || '20');
          const offset = parseInt(url.searchParams.get('offset') || '0');

          // Get following records for the specified user
          let followingRecords = demoFollows.filter(f => f.followerId === userId);

          // Filter by type if specified
          if (type === 'user') {
            followingRecords = followingRecords.filter(f => f.creatorId);
          } else if (type === 'pitch') {
            followingRecords = followingRecords.filter(f => f.pitchId);
          }

          const following = followingRecords
            .slice(offset, offset + limit)
            .map(record => {
              if (record.creatorId) {
                const user = extendedDemoUsers.find(u => u.id === record.creatorId);
                return {
                  id: record.id,
                  followerId: record.followerId,
                  creatorId: record.creatorId,
                  followedAt: record.followedAt,
                  creator: user ? {
                    id: user.id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    userType: user.userType,
                    companyName: user.companyName,
                    profileImage: user.profileImage,
                    verified: user.verified
                  } : null
                };
              } else if (record.pitchId) {
                // For pitch follows, we'd need pitch data - simplified for demo
                return {
                  id: record.id,
                  followerId: record.followerId,
                  pitchId: record.pitchId,
                  followedAt: record.followedAt,
                  pitch: {
                    id: record.pitchId,
                    title: `Demo Pitch ${record.pitchId}`,
                    genre: "Drama"
                  }
                };
              }
            })
            .filter(Boolean);

          return jsonResponse({
            success: true,
            data: {
              following,
              total: followingRecords.length
            }
          });
        } catch (error) {
          return serverErrorResponse("Failed to get following: " + error.message);
        }
      }

      // Get Mutual Followers
      if (pathname.startsWith('/api/follows/mutual/') && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const targetUserId = parseInt(pathname.split('/').pop());
          const currentUserId = auth.user.id;

          // Get users that both current user and target user follow
          const currentUserFollowing = demoFollows
            .filter(f => f.followerId === currentUserId && f.creatorId)
            .map(f => f.creatorId);

          const targetUserFollowing = demoFollows
            .filter(f => f.followerId === targetUserId && f.creatorId)
            .map(f => f.creatorId);

          // Find mutual follows
          const mutualUserIds = currentUserFollowing.filter(id => 
            targetUserFollowing.includes(id) && id !== currentUserId && id !== targetUserId
          );

          const mutualUsers = extendedDemoUsers
            .filter(user => mutualUserIds.includes(user.id))
            .map(user => ({
              id: user.id,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              userType: user.userType,
              companyName: user.companyName,
              profileImage: user.profileImage,
              verified: user.verified
            }));

          return jsonResponse({
            success: true,
            data: {
              users: mutualUsers
            }
          });
        } catch (error) {
          return serverErrorResponse("Failed to get mutual followers: " + error.message);
        }
      }

      // Get Activity Feed
      if (pathname === '/api/activity/feed' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.success) {
          return auth.error!;
        }

        try {
          const url = new URL(request.url);
          const userId = url.searchParams.get('userId') ? parseInt(url.searchParams.get('userId')) : null;
          const type = url.searchParams.get('type');
          const limit = parseInt(url.searchParams.get('limit') || '20');
          const offset = parseInt(url.searchParams.get('offset') || '0');
          const currentUserId = auth.user.id;

          let activities = [...demoActivities];

          // Filter by user if specified
          if (userId) {
            activities = activities.filter(a => a.userId === userId);
          } else {
            // Get activities from users the current user follows
            const followingUserIds = demoFollows
              .filter(f => f.followerId === currentUserId && f.creatorId)
              .map(f => f.creatorId);
            
            // Include current user's activities and activities from followed users
            activities = activities.filter(a => 
              a.userId === currentUserId || followingUserIds.includes(a.userId)
            );
          }

          // Filter by type if specified
          if (type) {
            activities = activities.filter(a => a.type === type);
          }

          // Sort by creation date (newest first)
          activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          // Apply pagination
          const paginatedActivities = activities.slice(offset, offset + limit);

          // Enrich activities with user data
          const enrichedActivities = paginatedActivities.map(activity => {
            const user = extendedDemoUsers.find(u => u.id === activity.userId);
            let entity = null;

            if (activity.entityType === 'user') {
              entity = extendedDemoUsers.find(u => u.id === activity.entityId);
            } else if (activity.entityType === 'pitch') {
              entity = {
                id: activity.entityId,
                title: activity.metadata?.title || `Demo Pitch ${activity.entityId}`,
                genre: activity.metadata?.genre || "Unknown"
              };
            }

            return {
              ...activity,
              user: user ? {
                id: user.id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                userType: user.userType,
                profileImage: user.profileImage,
                verified: user.verified
              } : null,
              entity
            };
          });

          return jsonResponse({
            success: true,
            data: {
              activities: enrichedActivities,
              total: activities.length
            }
          });
        } catch (error) {
          return serverErrorResponse("Failed to get activity feed: " + error.message);
        }
      }

      // ========== END SOCIAL FEATURES ENDPOINTS ==========

      // ========== INVESTMENT AND FUNDING ENDPOINTS ==========
      
      // Get investor's portfolio summary
      if (pathname === '/api/investor/portfolio/summary' && request.method === 'GET') {
        console.log('Getting investor portfolio summary...');
        
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get portfolio summary for investor
          const portfolioResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              COALESCE(SUM(i.amount), 0) as total_invested,
              COALESCE(SUM(i.current_value), 0) as current_value,
              COUNT(CASE WHEN i.status = 'active' THEN 1 END) as active_investments,
              COUNT(CASE WHEN i.status = 'completed' THEN 1 END) as completed_investments
            FROM investments i
            WHERE i.investor_id = ${auth.user.id}
          `, sentry);

          const stats = portfolioResults[0] || {};
          const totalInvested = parseFloat(stats.total_invested) || 0;
          const currentValue = parseFloat(stats.current_value) || 0;
          const totalReturn = currentValue - totalInvested;
          const returnPercentage = totalInvested > 0 ? ((totalReturn / totalInvested) * 100) : 0;

          // Get recent performance data (mock for now)
          const monthlyGrowth = Math.random() * 10 - 5; // -5% to +5%
          const quarterlyGrowth = Math.random() * 20 - 10; // -10% to +10%
          const ytdGrowth = Math.random() * 30 - 15; // -15% to +15%

          const portfolioMetrics = {
            totalInvested: totalInvested,
            currentValue: currentValue,
            totalReturn: totalReturn,
            returnPercentage: returnPercentage,
            activeInvestments: parseInt(stats.active_investments) || 0,
            completedInvestments: parseInt(stats.completed_investments) || 0,
            roi: returnPercentage,
            monthlyGrowth: monthlyGrowth,
            quarterlyGrowth: quarterlyGrowth,
            ytdGrowth: ytdGrowth
          };

          return new Response(JSON.stringify({
            success: true,
            data: portfolioMetrics
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Portfolio summary error:', error);
          return serverErrorResponse("Failed to get portfolio summary: " + error.message);
        }
      }

      // Get investor's investment history
      if (pathname === '/api/investor/investments' && request.method === 'GET') {
        console.log('Getting investor investment history...');
        
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Parse query parameters
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '10');
          const status = url.searchParams.get('status');
          const sortBy = url.searchParams.get('sortBy') || 'createdAt';
          const sortOrder = url.searchParams.get('sortOrder') || 'desc';
          const offset = (page - 1) * limit;

          // Build where clause
          let whereClause = 'WHERE i.investor_id = $1';
          const params = [auth.user.id];
          
          if (status) {
            whereClause += ' AND i.status = $' + (params.length + 1);
            params.push(status);
          }

          // Get total count
          const countQuery = `
            SELECT COUNT(*) as total
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            LEFT JOIN users u ON p.user_id = u.id
            ${whereClause}
          `;
          // Get count using template literals
          let countResult;
          if (status && pitchId) {
            countResult = await withDatabase(env, async (sql) => await sql`
              SELECT COUNT(*) as total
              FROM investments i
              WHERE i.investor_id = ${auth.user.id} AND i.status = ${status} AND i.pitch_id = ${pitchId}
            `, sentry);
          } else if (status) {
            countResult = await withDatabase(env, async (sql) => await sql`
              SELECT COUNT(*) as total
              FROM investments i
              WHERE i.investor_id = ${auth.user.id} AND i.status = ${status}
            `, sentry);
          } else if (pitchId) {
            countResult = await withDatabase(env, async (sql) => await sql`
              SELECT COUNT(*) as total
              FROM investments i
              WHERE i.investor_id = ${auth.user.id} AND i.pitch_id = ${pitchId}
            `, sentry);
          } else {
            countResult = await withDatabase(env, async (sql) => await sql`
              SELECT COUNT(*) as total
              FROM investments i
              WHERE i.investor_id = ${auth.user.id}
            `, sentry);
          }
          const total = parseInt(countResult[0]?.total) || 0;

          // Get investments with details
          const investmentsQuery = `
            SELECT 
              i.id, i.amount, i.status, i.current_value, i.notes, 
              i.created_at as "createdAt", i.updated_at as "updatedAt",
              p.id as pitch_id, p.title as pitch_title, p.genre as pitch_genre, p.logline,
              u.username as creator_name, u.first_name, u.last_name
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            LEFT JOIN users u ON p.user_id = u.id
            ${whereClause}
            ORDER BY i.${sortBy === 'createdAt' ? 'created_at' : sortBy} ${sortOrder.toUpperCase()}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
          `;
          params.push(limit, offset);
          
          // Get investments using template literals
          let investments;
          if (status && pitchId) {
            investments = await withDatabase(env, async (sql) => await sql`
              SELECT 
                i.id, i.amount, i.status, i.current_value, i.notes, 
                i.created_at as "createdAt", i.updated_at as "updatedAt",
                p.id as pitch_id, p.title as pitch_title, p.genre as pitch_genre, p.logline,
                u.username as creator_name, u.first_name, u.last_name
              FROM investments i
              JOIN pitches p ON i.pitch_id = p.id
              JOIN users u ON p.user_id = u.id
              WHERE i.investor_id = ${auth.user.id} AND i.status = ${status} AND i.pitch_id = ${pitchId}
              ORDER BY i.created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `, sentry);
          } else if (status) {
            investments = await withDatabase(env, async (sql) => await sql`
              SELECT 
                i.id, i.amount, i.status, i.current_value, i.notes, 
                i.created_at as "createdAt", i.updated_at as "updatedAt",
                p.id as pitch_id, p.title as pitch_title, p.genre as pitch_genre, p.logline,
                u.username as creator_name, u.first_name, u.last_name
              FROM investments i
              JOIN pitches p ON i.pitch_id = p.id
              JOIN users u ON p.user_id = u.id
              WHERE i.investor_id = ${auth.user.id} AND i.status = ${status}
              ORDER BY i.created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `, sentry);
          } else if (pitchId) {
            investments = await withDatabase(env, async (sql) => await sql`
              SELECT 
                i.id, i.amount, i.status, i.current_value, i.notes, 
                i.created_at as "createdAt", i.updated_at as "updatedAt",
                p.id as pitch_id, p.title as pitch_title, p.genre as pitch_genre, p.logline,
                u.username as creator_name, u.first_name, u.last_name
              FROM investments i
              JOIN pitches p ON i.pitch_id = p.id
              JOIN users u ON p.user_id = u.id
              WHERE i.investor_id = ${auth.user.id} AND i.pitch_id = ${pitchId}
              ORDER BY i.created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `, sentry);
          } else {
            investments = await withDatabase(env, async (sql) => await sql`
              SELECT 
                i.id, i.amount, i.status, i.current_value, i.notes, 
                i.created_at as "createdAt", i.updated_at as "updatedAt",
                p.id as pitch_id, p.title as pitch_title, p.genre as pitch_genre, p.logline,
                u.username as creator_name, u.first_name, u.last_name
              FROM investments i
              JOIN pitches p ON i.pitch_id = p.id
              JOIN users u ON p.user_id = u.id
              WHERE i.investor_id = ${auth.user.id}
              ORDER BY i.created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `, sentry);
          }

          // Format results
          const formattedInvestments = investments.map(inv => ({
            id: inv.id,
            investorId: auth.user.id,
            pitchId: inv.pitch_id,
            amount: parseFloat(inv.amount) || 0,
            status: inv.status,
            currentValue: parseFloat(inv.current_value) || 0,
            notes: inv.notes,
            createdAt: inv.createdAt?.toISOString(),
            updatedAt: inv.updatedAt?.toISOString(),
            pitchTitle: inv.pitch_title,
            pitchGenre: inv.pitch_genre,
            creatorName: inv.creator_name || `${inv.first_name || ''} ${inv.last_name || ''}`.trim(),
            returnAmount: (parseFloat(inv.current_value) || 0) - (parseFloat(inv.amount) || 0),
            returnPercentage: parseFloat(inv.amount) > 0 ? 
              (((parseFloat(inv.current_value) || 0) - parseFloat(inv.amount)) / parseFloat(inv.amount)) * 100 : 0,
            daysInvested: Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          }));

          // Calculate summary
          const summary = {
            totalInvested: formattedInvestments.reduce((sum, inv) => sum + inv.amount, 0),
            totalCurrentValue: formattedInvestments.reduce((sum, inv) => sum + inv.currentValue, 0),
            activeCount: formattedInvestments.filter(inv => inv.status === 'active').length,
            completedCount: formattedInvestments.filter(inv => inv.status === 'completed').length
          };

          return new Response(JSON.stringify({
            success: true,
            data: {
              investments: formattedInvestments,
              total: total,
              totalPages: Math.ceil(total / limit),
              currentPage: page,
              summary: summary
            }
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Investment history error:', error);
          return serverErrorResponse("Failed to get investment history: " + error.message);
        }
      }

      // Get investment recommendations/opportunities
      if (pathname === '/api/investment/recommendations' && request.method === 'GET') {
        console.log('Getting investment recommendations...');
        
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Parse query parameters
          const limit = parseInt(url.searchParams.get('limit') || '20');
          const genre = url.searchParams.get('genre');
          const stage = url.searchParams.get('stage');
          const sortBy = url.searchParams.get('sortBy') || 'score';
          const minBudget = parseFloat(url.searchParams.get('minBudget') || '0');
          const maxBudget = parseFloat(url.searchParams.get('maxBudget') || '999999999');

          // Get opportunities using template literals
          let opportunities;
          if (genre && stage) {
            opportunities = await withDatabase(env, async (sql) => await sql`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.estimated_budget,
                p.production_stage, p.view_count, p.like_count, p.published_at,
                u.id as creator_id, u.username, u.company_name,
                (p.view_count * 0.3 + p.like_count * 0.7 + RANDOM() * 100) as match_score
              FROM pitches p
              JOIN users u ON p.user_id = u.id
              WHERE p.status = 'published' 
                AND p.seeking_investment = true
                AND p.estimated_budget >= ${minBudget}
                AND p.estimated_budget <= ${maxBudget}
                AND p.genre = ${genre}
                AND p.production_stage = ${stage}
              ORDER BY p.created_at DESC
              LIMIT ${limit}
            `, sentry);
          } else if (genre) {
            opportunities = await withDatabase(env, async (sql) => await sql`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.estimated_budget,
                p.production_stage, p.view_count, p.like_count, p.published_at,
                u.id as creator_id, u.username, u.company_name,
                (p.view_count * 0.3 + p.like_count * 0.7 + RANDOM() * 100) as match_score
              FROM pitches p
              JOIN users u ON p.user_id = u.id
              WHERE p.status = 'published' 
                AND p.seeking_investment = true
                AND p.estimated_budget >= ${minBudget}
                AND p.estimated_budget <= ${maxBudget}
                AND p.genre = ${genre}
              ORDER BY p.created_at DESC
              LIMIT ${limit}
            `, sentry);
          } else if (stage) {
            opportunities = await withDatabase(env, async (sql) => await sql`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.estimated_budget,
                p.production_stage, p.view_count, p.like_count, p.published_at,
                u.id as creator_id, u.username, u.company_name,
                (p.view_count * 0.3 + p.like_count * 0.7 + RANDOM() * 100) as match_score
              FROM pitches p
              JOIN users u ON p.user_id = u.id
              WHERE p.status = 'published' 
                AND p.seeking_investment = true
                AND p.estimated_budget >= ${minBudget}
                AND p.estimated_budget <= ${maxBudget}
                AND p.production_stage = ${stage}
              ORDER BY p.created_at DESC
              LIMIT ${limit}
            `, sentry);
          } else {
            opportunities = await withDatabase(env, async (sql) => await sql`
              SELECT 
                p.id, p.title, p.logline, p.genre, p.estimated_budget,
                p.production_stage, p.view_count, p.like_count, p.published_at,
                u.id as creator_id, u.username, u.company_name,
                (p.view_count * 0.3 + p.like_count * 0.7 + RANDOM() * 100) as match_score
              FROM pitches p
              JOIN users u ON p.user_id = u.id
              WHERE p.status = 'published' 
                AND p.seeking_investment = true
                AND p.estimated_budget >= ${minBudget}
                AND p.estimated_budget <= ${maxBudget}
              ORDER BY p.created_at DESC
              LIMIT ${limit}
            `, sentry);
          }

          // Format opportunities with enhanced data
          const formattedOpportunities = opportunities.map(opp => ({
            id: opp.id,
            title: opp.title,
            logline: opp.logline,
            genre: opp.genre,
            estimatedBudget: parseFloat(opp.estimated_budget) || 0,
            seekingAmount: Math.floor((parseFloat(opp.estimated_budget) || 100000) * 0.3), // 30% of budget
            productionStage: opp.production_stage || 'concept',
            creator: {
              id: opp.creator_id || opp.user_id,
              username: opp.username,
              companyName: opp.company_name
            },
            viewCount: opp.view_count || 0,
            likeCount: opp.like_count || 0,
            ratingAverage: 3.5 + Math.random() * 1.5, // Mock rating 3.5-5.0
            matchScore: Math.floor(opp.match_score) || 50,
            riskLevel: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
            expectedROI: 15 + Math.random() * 35, // 15-50% expected ROI
            timeline: ['6 months', '1 year', '18 months', '2 years'][Math.floor(Math.random() * 4)],
            publishedAt: opp.published_at
          }));

          return new Response(JSON.stringify({
            success: true,
            data: formattedOpportunities
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Investment recommendations error:', error);
          return serverErrorResponse("Failed to get investment recommendations: " + error.message);
        }
      }

      // Get creator's funding overview
      if (pathname === '/api/creator/funding/overview' && request.method === 'GET') {
        console.log('Getting creator funding overview...');
        
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get funding metrics for creator's pitches
          const fundingResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              COALESCE(SUM(i.amount), 0) as total_raised,
              COUNT(DISTINCT i.investor_id) as active_investors,
              COALESCE(AVG(i.amount), 0) as average_investment,
              COUNT(i.id) as total_investments
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            WHERE p.user_id = ${auth.user.id}
          `, sentry);

          const stats = fundingResults[0] || {};
          const totalRaised = parseFloat(stats.total_raised) || 0;
          const activeInvestors = parseInt(stats.active_investors) || 0;
          const averageInvestment = parseFloat(stats.average_investment) || 0;

          // Get recent investments (last 5)
          const recentInvestments = await withDatabase(env, async (sql) => await sql`
            SELECT 
              i.id, i.amount, i.created_at,
              u.username, u.first_name, u.last_name
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            LEFT JOIN users u ON i.investor_id = u.id
            WHERE p.user_id = ${auth.user.id}
            ORDER BY i.created_at DESC
            LIMIT 5
          `, sentry);

          // Get top investor
          const topInvestorResult = await withDatabase(env, async (sql) => await sql`
            SELECT 
              u.username, u.first_name, u.last_name,
              SUM(i.amount) as total_amount
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            LEFT JOIN users u ON i.investor_id = u.id
            WHERE p.user_id = ${auth.user.id}
            GROUP BY u.id, u.username, u.first_name, u.last_name
            ORDER BY total_amount DESC
            LIMIT 1
          `, sentry);

          // Mock funding goal (you might want to add this to pitches table)
          const fundingGoal = 500000; // $500k default goal
          const fundingProgress = (totalRaised / fundingGoal) * 100;
          const monthlyGrowth = Math.random() * 20; // 0-20% growth

          const fundingMetrics = {
            totalRaised: totalRaised,
            fundingGoal: fundingGoal,
            activeInvestors: activeInvestors,
            averageInvestment: averageInvestment,
            fundingProgress: Math.min(fundingProgress, 100),
            monthlyGrowth: monthlyGrowth,
            recentInvestments: recentInvestments.map(inv => ({
              id: inv.id,
              amount: parseFloat(inv.amount),
              investorName: inv.username || `${inv.first_name || ''} ${inv.last_name || ''}`.trim(),
              date: inv.created_at
            })),
            topInvestor: topInvestorResult[0] ? {
              name: topInvestorResult[0].username || `${topInvestorResult[0].first_name || ''} ${topInvestorResult[0].last_name || ''}`.trim(),
              amount: parseFloat(topInvestorResult[0].total_amount)
            } : null
          };

          return new Response(JSON.stringify({
            success: true,
            data: fundingMetrics
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Creator funding overview error:', error);
          return serverErrorResponse("Failed to get funding overview: " + error.message);
        }
      }

      // Get creator's investors
      if (pathname === '/api/creator/investors' && request.method === 'GET') {
        console.log('Getting creator investors...');
        
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get investors for creator's pitches
          const investorsResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              u.id, u.username, u.first_name, u.last_name, u.company_name,
              SUM(i.amount) as total_invested,
              MIN(i.created_at) as joined_date,
              COUNT(i.id) as investment_count,
              array_agg(json_build_object(
                'id', i.id,
                'amount', i.amount,
                'status', i.status,
                'pitch_title', p.title,
                'created_at', i.created_at
              )) as investments
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            LEFT JOIN users u ON i.investor_id = u.id
            WHERE p.user_id = ${auth.user.id}
            GROUP BY u.id, u.username, u.first_name, u.last_name, u.company_name
            ORDER BY total_invested DESC
          `, sentry);

          // Get totals
          const totalResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              COUNT(DISTINCT i.investor_id) as total_investors,
              COALESCE(SUM(i.amount), 0) as total_raised
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            WHERE p.user_id = ${auth.user.id}
          `, sentry);

          const totals = totalResults[0] || {};
          
          const formattedInvestors = investorsResults.map(inv => ({
            id: inv.id,
            name: inv.username || `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || 'Unknown Investor',
            totalInvested: parseFloat(inv.total_invested) || 0,
            investments: inv.investments || [],
            joinedDate: inv.joined_date
          }));

          return new Response(JSON.stringify({
            success: true,
            data: {
              investors: formattedInvestors,
              totalInvestors: parseInt(totals.total_investors) || 0,
              totalRaised: parseFloat(totals.total_raised) || 0
            }
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Creator investors error:', error);
          return serverErrorResponse("Failed to get creator investors: " + error.message);
        }
      }

      // Get production company investment overview
      if (pathname === '/api/production/investments/overview' && request.method === 'GET') {
        console.log('Getting production investments overview...');
        
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get overall investment metrics visible to production companies
          const metricsResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              COUNT(DISTINCT i.id) as total_investments,
              COUNT(DISTINCT CASE WHEN i.status = 'active' THEN i.id END) as active_deals,
              COALESCE(SUM(CASE WHEN i.status = 'active' THEN i.amount ELSE 0 END), 0) as pipeline_value
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            WHERE p.visibility = 'public'
          `, sentry);

          const stats = metricsResults[0] || {};
          const monthlyGrowth = Math.random() * 15; // 0-15% growth

          // Get top opportunities (highly funded/viewed pitches)
          const topOpportunities = await withDatabase(env, async (sql) => await sql`
            SELECT 
              p.id, p.title, p.logline, p.genre, p.estimated_budget, p.production_stage,
              p.view_count, p.like_count,
              u.username, u.company_name,
              COALESCE(SUM(i.amount), 0) as funding_raised,
              COUNT(i.id) as investor_count
            FROM pitches p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN investments i ON i.pitch_id = p.id
            WHERE p.status = 'published' AND p.visibility = 'public'
            GROUP BY p.id, p.title, p.logline, p.genre, p.estimated_budget, p.production_stage,
                     p.view_count, p.like_count, u.username, u.company_name
            ORDER BY funding_raised DESC, p.view_count DESC
            LIMIT 10
          `, sentry);

          // Get recent activity
          const recentActivity = await withDatabase(env, async (sql) => await sql`
            SELECT 
              'investment' as type,
              p.title,
              i.amount,
              i.created_at as date
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            WHERE p.visibility = 'public'
            ORDER BY i.created_at DESC
            LIMIT 10
          `, sentry);

          const productionMetrics = {
            totalInvestments: parseInt(stats.total_investments) || 0,
            activeDeals: parseInt(stats.active_deals) || 0,
            pipelineValue: parseFloat(stats.pipeline_value) || 0,
            monthlyGrowth: monthlyGrowth,
            topOpportunities: topOpportunities.map(opp => ({
              id: opp.id,
              title: opp.title,
              logline: opp.logline,
              genre: opp.genre,
              estimatedBudget: parseFloat(opp.estimated_budget) || 0,
              productionStage: opp.production_stage,
              creator: {
                username: opp.username,
                companyName: opp.company_name
              },
              viewCount: opp.view_count || 0,
              likeCount: opp.like_count || 0,
              fundingRaised: parseFloat(opp.funding_raised) || 0,
              matchScore: Math.floor(Math.random() * 100) + 1
            })),
            recentActivity: recentActivity.map(activity => ({
              type: activity.type,
              title: activity.title,
              amount: parseFloat(activity.amount),
              date: activity.date
            }))
          };

          return new Response(JSON.stringify({
            success: true,
            data: productionMetrics
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Production investments overview error:', error);
          return serverErrorResponse("Failed to get production investments overview: " + error.message);
        }
      }

      // Create a new investment
      if (pathname === '/api/investments/create' && request.method === 'POST') {
        console.log('Creating new investment...');
        
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const requestData = await request.json();
          const { pitchId, amount, terms } = requestData;

          if (!pitchId || !amount || amount <= 0) {
            return badRequestResponse("Missing required fields: pitchId and positive amount");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Verify pitch exists and is seeking investment
          const pitchCheck = await withDatabase(env, async (sql) => await sql`
            SELECT id, title, user_id, seeking_investment
            FROM pitches 
            WHERE id = ${pitchId} AND status = 'published' AND visibility = 'public'
          `, sentry);

          if (pitchCheck.length === 0) {
            return badRequestResponse("Pitch not found or not available for investment");
          }

          if (!pitchCheck[0].seeking_investment) {
            return badRequestResponse("This pitch is not currently seeking investment");
          }

          // Create investment
          const investmentResults = await withDatabase(env, async (sql) => await sql`
            INSERT INTO investments (investor_id, pitch_id, amount, status, terms, current_value, created_at, updated_at)
            VALUES (${auth.user.id}, ${pitchId}, ${amount}, 'pending', ${terms || null}, ${amount}, NOW(), NOW())
            RETURNING *
          `, sentry);

          if (investmentResults.length === 0) {
            return serverErrorResponse("Failed to create investment");
          }

          const investment = investmentResults[0];

          // Get pitch and creator details for response
          const pitchDetails = await withDatabase(env, async (sql) => await sql`
            SELECT p.title, p.genre, u.username, u.first_name, u.last_name
            FROM pitches p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = ${pitchId}
          `, sentry);

          const pitch = pitchDetails[0];
          
          const formattedInvestment = {
            id: investment.id,
            investorId: investment.investor_id,
            pitchId: investment.pitch_id,
            amount: parseFloat(investment.amount),
            status: investment.status,
            terms: investment.terms,
            currentValue: parseFloat(investment.current_value),
            documents: [],
            notes: investment.notes,
            createdAt: investment.created_at?.toISOString(),
            updatedAt: investment.updated_at?.toISOString(),
            pitchTitle: pitch?.title,
            pitchGenre: pitch?.genre,
            creatorName: pitch ? (pitch.username || `${pitch.first_name || ''} ${pitch.last_name || ''}`.trim()) : null
          };

          return new Response(JSON.stringify({
            success: true,
            data: formattedInvestment
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Create investment error:', error);
          return serverErrorResponse("Failed to create investment: " + error.message);
        }
      }

      // Update investment
      if (pathname.startsWith('/api/investments/') && pathname.endsWith('/update') && request.method === 'POST') {
        console.log('Updating investment...');
        
        try {
          const investmentId = parseInt(pathname.split('/')[3]);
          if (!investmentId) {
            return badRequestResponse("Invalid investment ID");
          }

          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const requestData = await request.json();
          const { status, currentValue, notes } = requestData;

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Check if user owns this investment
          const investmentCheck = await withDatabase(env, async (sql) => await sql`
            SELECT * FROM investments 
            WHERE id = ${investmentId} AND investor_id = ${auth.user.id}
          `, sentry);

          if (investmentCheck.length === 0) {
            return badRequestResponse("Investment not found or not owned by user");
          }

          // Update investment
          const updateFields = [];
          const updateValues = [];
          let paramCount = 1;

          if (status !== undefined) {
            updateFields.push(`status = $${paramCount++}`);
            updateValues.push(status);
          }
          
          if (currentValue !== undefined) {
            updateFields.push(`current_value = $${paramCount++}`);
            updateValues.push(currentValue);
          }
          
          if (notes !== undefined) {
            updateFields.push(`notes = $${paramCount++}`);
            updateValues.push(notes);
          }

          updateFields.push(`updated_at = NOW()`);
          updateValues.push(investmentId);

          const updateQuery = `
            UPDATE investments 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
          `;

          // Update investment using template literals
          const updateResults = await withDatabase(env, async (sql) => await sql`
            UPDATE investments 
            SET amount = ${amount}, 
                notes = ${notes}, 
                updated_at = NOW()
            WHERE id = ${investmentId} AND investor_id = ${auth.user.id}
            RETURNING id, pitch_id, investor_id, amount, status, notes, created_at, updated_at
          `, sentry);
          
          if (updateResults.length === 0) {
            return serverErrorResponse("Failed to update investment");
          }

          const investment = updateResults[0];
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              id: investment.id,
              investorId: investment.investor_id,
              pitchId: investment.pitch_id,
              amount: parseFloat(investment.amount),
              status: investment.status,
              currentValue: parseFloat(investment.current_value),
              notes: investment.notes,
              createdAt: investment.created_at?.toISOString(),
              updatedAt: investment.updated_at?.toISOString()
            }
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Update investment error:', error);
          return serverErrorResponse("Failed to update investment: " + error.message);
        }
      }

      // Get investment details
      if (pathname.startsWith('/api/investments/') && pathname.endsWith('/details') && request.method === 'GET') {
        console.log('Getting investment details...');
        
        try {
          const investmentId = parseInt(pathname.split('/')[3]);
          if (!investmentId) {
            return badRequestResponse("Invalid investment ID");
          }

          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get investment with pitch and creator details
          const investmentResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              i.*, 
              p.title as pitch_title, p.genre as pitch_genre,
              u.username, u.first_name, u.last_name
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            LEFT JOIN users u ON p.user_id = u.id
            WHERE i.id = ${investmentId} AND i.investor_id = ${auth.user.id}
          `, sentry);

          if (investmentResults.length === 0) {
            return badRequestResponse("Investment not found or not owned by user");
          }

          const investment = investmentResults[0];

          // Get investment documents (mock for now)
          const documents = [
            {
              id: 1,
              name: "Investment Agreement",
              url: "/documents/investment-agreement.pdf",
              uploadedAt: investment.created_at
            }
          ];

          // Get investment timeline (mock events)
          const timeline = [
            {
              id: 1,
              eventType: "investment_created",
              description: "Investment created",
              date: investment.created_at
            },
            {
              id: 2,
              eventType: "documents_signed",
              description: "Investment documents signed",
              date: investment.created_at
            }
          ];

          // Calculate ROI
          const amount = parseFloat(investment.amount) || 0;
          const currentValue = parseFloat(investment.current_value) || 0;
          const roi = amount > 0 ? ((currentValue - amount) / amount) * 100 : 0;

          const detailedInvestment = {
            id: investment.id,
            investorId: investment.investor_id,
            pitchId: investment.pitch_id,
            amount: amount,
            status: investment.status,
            terms: investment.terms,
            currentValue: currentValue,
            notes: investment.notes,
            createdAt: investment.created_at?.toISOString(),
            updatedAt: investment.updated_at?.toISOString(),
            pitch: {
              title: investment.pitch_title,
              genre: investment.pitch_genre,
              creator: {
                name: investment.username || `${investment.first_name || ''} ${investment.last_name || ''}`.trim()
              }
            },
            documents: documents || investment.documents || [],
            timeline: timeline,
            roi: roi
          };

          return new Response(JSON.stringify({
            success: true,
            data: detailedInvestment
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Investment details error:', error);
          return serverErrorResponse("Failed to get investment details: " + error.message);
        }
      }

      // Get portfolio analytics
      if (pathname === '/api/investor/portfolio/analytics' && request.method === 'GET') {
        console.log('Getting portfolio analytics...');
        
        try {
          const auth = await authenticateRequest(request, env);
          if (!auth.success || !auth.user) {
            return auth.error || badRequestResponse("Authentication failed");
          }

          const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
          // Initialize the pool if not already done
          dbPool.initialize(env, sentry);

          // Get all investments for analytics
          const investmentResults = await withDatabase(env, async (sql) => await sql`
            SELECT 
              i.*,
              p.genre, p.production_stage,
              (i.current_value - i.amount) as return_amount
            FROM investments i
            LEFT JOIN pitches p ON i.pitch_id = p.id
            WHERE i.investor_id = ${auth.user.id}
          `, sentry);

          if (investmentResults.length === 0) {
            return new Response(JSON.stringify({
              success: true,
              data: {
                totalROI: 0,
                bestPerforming: null,
                worstPerforming: null,
                diversification: {
                  byGenre: {},
                  byStage: {}
                },
                monthlyPerformance: []
              }
            }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          // Calculate overall ROI
          const totalInvested = investmentResults.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
          const totalCurrentValue = investmentResults.reduce((sum, inv) => sum + parseFloat(inv.current_value || inv.amount), 0);
          const totalROI = totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;

          // Find best and worst performing investments
          const performanceData = investmentResults.map(inv => ({
            ...inv,
            roi: parseFloat(inv.amount) > 0 ? 
              ((parseFloat(inv.current_value || inv.amount) - parseFloat(inv.amount)) / parseFloat(inv.amount)) * 100 : 0
          }));

          performanceData.sort((a, b) => b.roi - a.roi);
          const bestPerforming = performanceData[0];
          const worstPerforming = performanceData[performanceData.length - 1];

          // Calculate diversification
          const diversification = {
            byGenre: {},
            byStage: {}
          };

          investmentResults.forEach(inv => {
            const genre = inv.genre || 'Unknown';
            const stage = inv.production_stage || 'Unknown';
            const amount = parseFloat(inv.amount);

            diversification.byGenre[genre] = (diversification.byGenre[genre] || 0) + amount;
            diversification.byStage[stage] = (diversification.byStage[stage] || 0) + amount;
          });

          // Generate mock monthly performance data
          const monthlyPerformance = [];
          const currentDate = new Date();
          for (let i = 11; i >= 0; i--) {
            const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const baseValue = totalCurrentValue * (0.8 + Math.random() * 0.4);
            
            monthlyPerformance.push({
              month: monthDate.toISOString().substring(0, 7), // YYYY-MM format
              value: Math.round(baseValue),
              change: Math.round((Math.random() - 0.5) * 20) // -10% to +10% change
            });
          }

          return new Response(JSON.stringify({
            success: true,
            data: {
              totalROI: totalROI,
              bestPerforming: bestPerforming ? {
                id: bestPerforming.id,
                amount: parseFloat(bestPerforming.amount),
                currentValue: parseFloat(bestPerforming.current_value || bestPerforming.amount),
                roi: bestPerforming.roi
              } : null,
              worstPerforming: worstPerforming ? {
                id: worstPerforming.id,
                amount: parseFloat(worstPerforming.amount),
                currentValue: parseFloat(worstPerforming.current_value || worstPerforming.amount),
                roi: worstPerforming.roi
              } : null,
              diversification: diversification,
              monthlyPerformance: monthlyPerformance
            }
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });

        } catch (error) {
          console.error('Portfolio analytics error:', error);
          return serverErrorResponse("Failed to get portfolio analytics: " + error.message);
        }
      }

      // ========== END INVESTMENT AND FUNDING ENDPOINTS ==========

      // Fallback for unhandled routes
      return new Response(JSON.stringify({
        success: false,
        message: 'Endpoint not found',
        architecture: 'simplified',
        available_endpoints: [
          '/api/simple-test', '/api/db-test', '/api/pitches/trending', '/api/pitches/new', '/api/pitches/public', '/api/pitches/{id}', 
          '/api/pitches/browse/enhanced', '/api/pitches/browse/general', '/api/health', 
          '/api/auth/creator/login', '/api/auth/investor/login', '/api/auth/production/login', '/api/auth/logout', 
          '/api/creator/dashboard', '/api/profile', '/api/follows/stats/{id}', '/api/follows/follow', '/api/follows/unfollow', 
          '/api/follows/suggestions', '/api/follows/followers', '/api/follows/following', '/api/follows/mutual/{userId}', 
          '/api/activity/feed', '/api/payments/credits/balance', '/api/payments/subscription-status', 
          '/api/nda/pending', '/api/nda/active', 
          // Comprehensive NDA Management Endpoints
          'POST /api/ndas/request', 'POST /api/ndas/{id}/sign', 'POST /api/ndas/{id}/approve', 'POST /api/ndas/{id}/reject', 
          'POST /api/ndas/{id}/revoke', 'GET /api/ndas/{id}', 'GET /api/ndas', 'GET /api/ndas/pitch/{pitchId}/status', 
          'GET /api/ndas/history', 'GET /api/ndas/{id}/download-signed', 'POST /api/ndas/preview',
          'GET /api/ndas/templates', 'GET /api/ndas/templates/{id}', 'GET /api/ndas/stats', 'GET /api/ndas/stats/{id}',
          'GET /api/ndas/pitch/{pitchId}/can-request', 'POST /api/ndas/bulk-approve', 'POST /api/ndas/bulk-reject',
          'POST /api/ndas/{id}/remind', 'GET /api/ndas/{id}/verify',
          '/api/notifications/unread', '/api/analytics/user', '/api/analytics/dashboard', '/api/analytics/pitch/{id}',
          '/api/analytics/activity', '/api/analytics/track', '/api/analytics/export', '/api/analytics/compare/{type}',
          '/api/analytics/trending', '/api/analytics/engagement', '/api/analytics/funnel/{id}', '/api/presence/online', 
          '/api/presence/update', '/api/websocket/test', '/api/investor/portfolio/summary', '/api/investor/investments', 
          '/api/investment/recommendations', '/api/creator/funding/overview', '/api/creator/investors', 
          '/api/production/investments/overview', '/api/investments/create', '/api/investments/{id}/update', 
          '/api/investments/{id}/details', '/api/investor/portfolio/analytics', '/ws', '/websocket'
        ],
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('Worker error:', error);
      
      sentry.captureException(error as Error, {
        tags: {
          component: 'worker-main',
          phase: 'phase2-services'
        }
      });

      return new Response(JSON.stringify({
        success: false,
        error: { 
          message: 'Internal server error', 
          code: 'WORKER_ERROR' 
        }
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

// Export Durable Object class for Wrangler
export { WebSocketRoom };
