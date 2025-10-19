#!/usr/bin/env deno run --allow-all

const API_BASE = "http://localhost:8001";

async function testDocumentRetrieval() {
  try {
    // Login first
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        email: "alex.creator@demo.com", 
        password: "Demo123" 
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log("✅ Login successful");
    
    // Use pitch ID 60 which should have documents from the test
    const pitchId = 60;
    
    console.log(`🔍 Testing document retrieval for pitch ${pitchId}...`);
    
    const url = `${API_BASE}/api/pitches/${pitchId}/documents`;
    console.log(`📡 Calling: ${url}`);
    
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    console.log("📤 Response status:", response.status);
    console.log("📤 Response headers:", Object.fromEntries(response.headers));
    
    const responseText = await response.text();
    console.log("📤 Response body:", responseText);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log("✅ Documents retrieved:", data.documents?.length || 0, "documents");
        if (data.documents) {
          data.documents.forEach((doc: any, i: number) => {
            console.log(`   ${i + 1}. ${doc.fileName} (${doc.documentType}) - ${doc.fileSize} bytes`);
          });
        }
      } catch (e) {
        console.log("❌ Failed to parse response as JSON");
      }
    } else {
      console.log("❌ Document retrieval failed");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

if (import.meta.main) {
  await testDocumentRetrieval();
}