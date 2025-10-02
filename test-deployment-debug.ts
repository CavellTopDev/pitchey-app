// Quick debug script to understand what's failing in production

const API_URL = "https://pitchey-backend-fresh.deno.dev";

// Test a simple endpoint that should log errors
const response = await fetch(`${API_URL}/api/health`);
const data = await response.json();

console.log("Environment:", data.data?.environment);
console.log("Version:", data.data?.version);

// The issue might be with the sql import or database connection
// Let's check if we can get more detailed error info
