export default {
  async fetch(_request, _env, _ctx) {
    return new Response(JSON.stringify({
      message: 'Test worker is running',
      timestamp: new Date().toISOString()
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  },
};