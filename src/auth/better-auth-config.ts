/**
 * Better Auth Configuration for Pitchey Platform
 * Implements modern authentication with role-based access control
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";

// Custom session configuration for different user types
const sessionConfig = {
  expiresIn: 60 * 60 * 24 * 7, // 7 days
  updateAge: 60 * 60 * 24, // Update session if older than 1 day
  cookieCache: {
    enabled: true,
    maxAge: 5 * 60 // Cache for 5 minutes
  }
};

// Initialize Better Auth with Drizzle adapter
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verificationTokens: schema.verificationTokens
    }
  }),
  
  // Email & password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
    sendResetPasswordToken: async (user, token) => {
      // Implement email sending logic here
      console.log(`Password reset token for ${user.email}: ${token}`);
    }
  },

  // Session configuration
  session: sessionConfig,

  // User configuration with custom fields
  user: {
    additionalFields: {
      userType: {
        type: "string",
        required: true,
        input: true, // Allow during registration
      },
      firstName: {
        type: "string",
        required: true,
        input: true,
      },
      lastName: {
        type: "string", 
        required: true,
        input: true,
      },
      companyName: {
        type: "string",
        required: false,
        input: true,
      },
      verified: {
        type: "boolean",
        defaultValue: false,
        input: false, // Don't allow user to set this
      },
      subscriptionTier: {
        type: "string",
        defaultValue: "free",
        input: false,
      }
    }
  },

  // Advanced features
  plugins: [
    // Two-factor authentication
    twoFactor({
      issuer: "Pitchey"
    }),
    
    // Organization/team support
    organization({
      allowUserToCreateOrganization: true,
      schema: {
        organization: {
          companyType: {
            type: "string",
            required: false
          },
          industry: {
            type: "string",
            required: false
          }
        }
      }
    }),
    
    // Admin panel
    admin({
      impersonationSessionDuration: 60 * 60 // 1 hour
    }),

    // Rate limiting
    rateLimit({
      window: 15 * 60, // 15 minutes
      max: 5, // Max 5 attempts
      storage: "memory" // Use Redis in production
    }),

    // Session impersonation for support
    impersonation(),
    
    // Magic link authentication
    magicLink({
      sendMagicLink: async (email, token, request) => {
        // Send magic link email
        console.log(`Magic link for ${email}: ${token}`);
      }
    }),

    // OAuth providers
    oauth2({
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }
    }),

    // Passkeys/WebAuthn
    passkey({
      rpName: "Pitchey",
      rpID: "pitchey.pages.dev",
      origin: "https://pitchey.pages.dev"
    })
  ],

  // Custom authorization rules
  access: {
    user: {
      // Users can only update their own profile
      update: ({ user, data }) => {
        return user.id === data.id;
      },
      // Admins can delete users
      delete: ({ user }) => {
        return user.role === "admin";
      }
    },
    pitch: {
      // Creators can manage their own pitches
      create: ({ user }) => {
        return user.userType === "creator";
      },
      update: ({ user, data }) => {
        return user.id === data.userId;
      },
      delete: ({ user, data }) => {
        return user.id === data.userId || user.role === "admin";
      },
      // Anyone can view public pitches
      read: ({ data }) => {
        return data.visibility === "public";
      }
    },
    nda: {
      // Investors and production companies can request NDAs
      request: ({ user }) => {
        return user.userType === "investor" || user.userType === "production";
      },
      // Creators can approve/reject their pitch NDAs
      approve: ({ user, data }) => {
        return user.id === data.ownerId;
      },
      reject: ({ user, data }) => {
        return user.id === data.ownerId;
      }
    },
    investment: {
      // Only investors can create investments
      create: ({ user }) => {
        return user.userType === "investor";
      }
    }
  },

  // Email verification templates
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async (user, token) => {
      // Implement email sending
      console.log(`Verification token for ${user.email}: ${token}`);
    }
  },

  // Security headers
  security: {
    headers: {
      crossOriginEmbedderPolicy: "require-corp",
      crossOriginOpenerPolicy: "same-origin",
      crossOriginResourcePolicy: "same-origin",
      originAgentCluster: "?1",
      referrerPolicy: "no-referrer",
      strictTransportSecurity: "max-age=31536000; includeSubDomains",
      xContentTypeOptions: "nosniff",
      xDnsPreFetchControl: "off",
      xDownloadOptions: "noopen",
      xFrameOptions: "SAMEORIGIN",
      xPermittedCrossDomainPolicies: "none",
      xXssProtection: "0"
    }
  },

  // Trusted origins for CORS
  trustedOrigins: [
    "https://pitchey.pages.dev",
    "https://pitchey-production.cavelltheleaddev.workers.dev",
    "http://localhost:5173", // Local development
    "http://localhost:8001"
  ],

  // Advanced security options
  advanced: {
    generateCustomUserId: async () => {
      // Generate unique user IDs
      return crypto.randomUUID();
    },
    cookiePrefix: "pitchey",
    defaultRole: "user",
    disableDefaultEndpoints: false,
    useSecureCookies: true, // Always use secure cookies in production
    crossSubDomainCookies: {
      enabled: true,
      domain: ".pitchey.pages.dev"
    }
  }
});

// Export typed auth client
export type Auth = typeof auth;

// Export auth handlers for different portals
export const authHandlers = {
  // Creator portal authentication
  creatorSignIn: async (email: string, password: string) => {
    const result = await auth.signIn.email({
      email,
      password,
      additionalChecks: async (user) => {
        if (user.userType !== 'creator') {
          throw new Error('Invalid portal access');
        }
        return true;
      }
    });
    return result;
  },

  // Investor portal authentication
  investorSignIn: async (email: string, password: string) => {
    const result = await auth.signIn.email({
      email,
      password,
      additionalChecks: async (user) => {
        if (user.userType !== 'investor') {
          throw new Error('Invalid portal access');
        }
        return true;
      }
    });
    return result;
  },

  // Production portal authentication
  productionSignIn: async (email: string, password: string) => {
    const result = await auth.signIn.email({
      email,
      password,
      additionalChecks: async (user) => {
        if (user.userType !== 'production') {
          throw new Error('Invalid portal access');
        }
        return true;
      }
    });
    return result;
  },

  // Sign out
  signOut: async (sessionToken: string) => {
    return await auth.signOut({ sessionToken });
  },

  // Get session
  getSession: async (sessionToken: string) => {
    return await auth.session.get({ sessionToken });
  },

  // Verify email
  verifyEmail: async (token: string) => {
    return await auth.verifyEmail({ token });
  }
};

// Export middleware for protecting routes
export const requireAuth = (userType?: string) => {
  return async (request: Request) => {
    const session = await auth.session.get({
      headers: request.headers
    });

    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (userType && session.user.userType !== userType) {
      return new Response('Forbidden', { status: 403 });
    }

    return session;
  };
};

// Helper function to check permissions
export const checkPermission = async (
  action: string,
  resource: string,
  userId: string,
  data?: any
) => {
  const accessRules = auth.access[resource];
  if (!accessRules || !accessRules[action]) {
    return false;
  }

  const user = await auth.user.get({ id: userId });
  if (!user) return false;

  return accessRules[action]({ user, data });
};