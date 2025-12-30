#!/usr/bin/env node

interface DetailedErrorResult {
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string;
  responseBody: string;
  responseHeaders: Record<string, string>;
  userType: string;
}

class Debug500Errors {
  private baseUrl = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
  private tokens: Map<string, string> = new Map();

  // List of endpoints that returned 500 errors
  private failingEndpoints = [
    '/api/pitches/browse',
    '/api/creator/portfolio',
    '/api/follows/followers', 
    '/api/follows/following',
    '/api/user/preferences',
    '/api/user/notifications',
    '/api/search/users',
    '/api/upload/quota'
  ];

  private users = [
    { email: 'alex.creator@demo.com', password: 'Demo123', type: 'creator' },
    { email: 'sarah.investor@demo.com', password: 'Demo123', type: 'investor' },
    { email: 'stellar.production@demo.com', password: 'Demo123', type: 'production' }
  ];

  private async login(user: { email: string; password: string; type: string }): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/${user.type}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password })
      });
      
      const data = await response.json();
      const token = data.token || data.access_token || data.accessToken;
      
      if (token) {
        this.tokens.set(user.type, token);
        return token;
      }
    } catch (error) {
      console.error(`Login failed for ${user.type}:`, error);
    }
    
    return null;
  }

  private async investigateEndpoint(endpoint: string, userType: string): Promise<DetailedErrorResult> {
    const token = this.tokens.get(userType);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers
      });

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseBody = await response.text();
      
      return {
        endpoint,
        method: 'GET',
        statusCode: response.status,
        errorMessage: response.statusText,
        responseBody,
        responseHeaders,
        userType
      };

    } catch (error) {
      return {
        endpoint,
        method: 'GET', 
        statusCode: 0,
        errorMessage: error instanceof Error ? error.message : 'Network error',
        responseBody: '',
        responseHeaders: {},
        userType
      };
    }
  }

  public async runDeepInvestigation(): Promise<void> {
    console.log('🔍 Deep Investigation of 500 Errors');
    console.log('=====================================\n');

    // Login first
    console.log('🔐 Authenticating users...');
    for (const user of this.users) {
      await this.login(user);
      console.log(`✅ ${user.type} authenticated`);
    }
    console.log('');

    // Investigate each failing endpoint
    for (const endpoint of this.failingEndpoints) {
      console.log(`\n🚨 Investigating: ${endpoint}`);
      console.log('-'.repeat(50));
      
      for (const userType of ['creator', 'investor', 'production']) {
        console.log(`\n📋 Testing with ${userType} account:`);
        
        const result = await this.investigateEndpoint(endpoint, userType);
        
        console.log(`   Status: ${result.statusCode} ${result.errorMessage}`);
        
        // Show response headers
        if (Object.keys(result.responseHeaders).length > 0) {
          console.log('   Headers:');
          Object.entries(result.responseHeaders).forEach(([key, value]) => {
            console.log(`     ${key}: ${value}`);
          });
        }
        
        // Show response body (truncated if too long)
        if (result.responseBody) {
          const truncatedBody = result.responseBody.length > 500 
            ? result.responseBody.substring(0, 500) + '...[truncated]'
            : result.responseBody;
          
          console.log('   Response Body:');
          console.log(`     ${truncatedBody.replace(/\n/g, '\n     ')}`);
          
          // Try to parse as JSON to see if there's structured error info
          try {
            const jsonBody = JSON.parse(result.responseBody);
            if (jsonBody.error || jsonBody.message || jsonBody.details) {
              console.log('   Parsed Error Info:');
              if (jsonBody.error) console.log(`     Error: ${jsonBody.error}`);
              if (jsonBody.message) console.log(`     Message: ${jsonBody.message}`);
              if (jsonBody.details) console.log(`     Details: ${jsonBody.details}`);
              if (jsonBody.stack) console.log(`     Stack trace available: Yes`);
            }
          } catch {
            // Not JSON, that's fine
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 SUMMARY OF INVESTIGATION');
    console.log('='.repeat(60));
    console.log('');
    console.log('Key findings from 500 error investigation:');
    console.log('1. Check server logs for detailed stack traces');
    console.log('2. Verify database connections and service dependencies');
    console.log('3. Check if backend services are properly deployed');
    console.log('4. Verify environment variables and configuration');
    console.log('');
    console.log('Next steps:');
    console.log('• Review Cloudflare Worker logs');
    console.log('• Check Deno Deploy backend logs');
    console.log('• Verify database connectivity');
    console.log('• Test backend services individually');
  }
}

async function main() {
  const investigator = new Debug500Errors();
  await investigator.runDeepInvestigation();
}

if (require.main === module) {
  main().catch(console.error);
}

export { Debug500Errors };