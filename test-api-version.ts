// Quick test to check if API is updated

const API_URL = "https://pitchey-backend-fresh.deno.dev";

// Add a version endpoint to check deployment
const response = await fetch(`${API_URL}/api/health`);
const text = await response.text();
console.log("Health check response:", text);

// Try to get more info
const headers = response.headers;
console.log("\nResponse headers:");
headers.forEach((value, key) => {
  if (key.toLowerCase().includes("date") || key.toLowerCase().includes("deploy")) {
    console.log(`${key}: ${value}`);
  }
});
