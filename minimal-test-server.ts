// Minimal test server to isolate deployment issues

console.log('🚀 Starting minimal test server...');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`DATABASE_URL: ${Deno.env.get('DATABASE_URL') ? 'Set' : 'Missing'}`);
console.log(`JWT_SECRET: ${Deno.env.get('JWT_SECRET') ? 'Set' : 'Missing'}`);
console.log(`DENO_ENV: ${Deno.env.get('DENO_ENV')}`);
console.log(`NODE_ENV: ${Deno.env.get('NODE_ENV')}`);

// Basic server
const port = parseInt(Deno.env.get('PORT') || '8001');

console.log(`🌐 Starting server on port ${port}...`);

Deno.serve({ port }, (request) => {
  const url = new URL(request.url);
  console.log(`📝 ${request.method} ${url.pathname}`);
  
  if (url.pathname === '/api/health') {
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: {
        DATABASE_URL: Deno.env.get('DATABASE_URL') ? 'Set' : 'Missing',
        JWT_SECRET: Deno.env.get('JWT_SECRET') ? 'Set' : 'Missing',
        DENO_ENV: Deno.env.get('DENO_ENV'),
        NODE_ENV: Deno.env.get('NODE_ENV')
      }
    });
  }
  
  if (url.pathname === '/') {
    return Response.json({
      message: 'Minimal test server is running',
      timestamp: new Date().toISOString()
    });
  }
  
  return Response.json({ error: 'Not Found' }, { status: 404 });
});