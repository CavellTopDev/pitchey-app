#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Add health endpoint to worker-integrated.ts
 */

const filePath = './src/worker-integrated.ts';
const content = await Deno.readTextFile(filePath);

// Find the handle method where routes are processed
const handleMethodIndex = content.indexOf('async handle(request: Request): Promise<Response>');

if (handleMethodIndex === -1) {
  console.error('Could not find handle method');
  Deno.exit(1);
}

// Find where to insert the health check
const insertPoint = content.indexOf('// Handle authentication routes', handleMethodIndex);

if (insertPoint === -1) {
  console.error('Could not find insertion point');
  Deno.exit(1);
}

// Add health endpoint check
const healthEndpointCode = `
    // Health check endpoint
    if (path === '/api/health' && method === 'GET') {
      try {
        // Test database connection
        let dbStatus = 'error';
        let dbTime = null;
        let dbError = null;
        
        if (this.db) {
          try {
            const result = await this.db.query('SELECT NOW() as time');
            if (result && result.length > 0) {
              dbStatus = 'connected';
              dbTime = result[0].time;
            }
          } catch (err) {
            dbError = err.message;
          }
        }
        
        return new Response(JSON.stringify({
          status: dbStatus === 'connected' ? 'ok' : 'degraded',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          services: {
            database: {
              status: dbStatus,
              time: dbTime,
              error: dbError
            },
            email: {
              status: this.emailService ? 'configured' : 'not configured'
            },
            rateLimit: {
              status: 'active'
            }
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

`;

// Insert the health endpoint code
const updatedContent = 
  content.slice(0, insertPoint) +
  healthEndpointCode +
  content.slice(insertPoint);

// Write the updated content
await Deno.writeTextFile(filePath, updatedContent);

console.log('✅ Added health endpoint to worker-integrated.ts');
console.log('   The endpoint will test database connectivity at /api/health');
console.log('\nNext steps:');
console.log('1. Deploy the updated worker: wrangler deploy');
console.log('2. Test the health endpoint: curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health');