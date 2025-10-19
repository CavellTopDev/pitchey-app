#!/usr/bin/env deno run --allow-all

const API_BASE = "http://localhost:8001";

// Helper function to login and get auth token
async function loginUser(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  
  console.log("Login response status:", response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log("Login error:", errorText);
    throw new Error(`Login failed: ${response.status}`);
  }
  
  const data = await response.json();
  console.log("Login response:", data);
  return data.token;
}

// Helper function to create a test pitch
async function createTestPitch(token: string): Promise<void> {
  const pitchData = {
    title: "Test Pitch for Document Upload Debug",
    logline: "A test pitch to debug pitch creation response",
    genre: "Drama",
    format: "Feature Film",
    shortSynopsis: "Test synopsis for debug",
    visibility: "public"
  };
  
  console.log("Creating pitch with data:", pitchData);
  
  const response = await fetch(`${API_BASE}/api/pitches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(pitchData)
  });
  
  console.log("Pitch creation response status:", response.status);
  
  const responseText = await response.text();
  console.log("Pitch creation response body:", responseText);
  
  if (!response.ok) {
    throw new Error(`Failed to create pitch: ${response.status} - ${responseText}`);
  }
  
  try {
    const data = JSON.parse(responseText);
    console.log("Parsed pitch response:", data);
    console.log("Pitch ID:", data.pitch?.id);
  } catch (e) {
    console.log("Failed to parse response as JSON:", e.message);
  }
}

// Run debug
async function runDebug() {
  try {
    console.log("🔍 Debugging pitch creation response format...\n");
    
    const token = await loginUser("alex.creator@demo.com", "Demo123");
    console.log("✅ Login successful, token received\n");
    
    await createTestPitch(token);
    console.log("✅ Pitch creation test completed");
    
  } catch (error) {
    console.error("❌ Debug failed:", error.message);
  }
}

if (import.meta.main) {
  await runDebug();
}