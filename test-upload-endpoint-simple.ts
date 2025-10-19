#!/usr/bin/env deno run --allow-all

const API_BASE = "http://localhost:8001";

async function testUploadEndpoint() {
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
    
    // Create a test pitch
    const pitchResponse = await fetch(`${API_BASE}/api/pitches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        title: "Test Pitch for Upload",
        logline: "Test logline",
        genre: "Drama",
        format: "Feature Film"
      })
    });
    
    const pitchData = await pitchResponse.json();
    const pitchId = pitchData.data.pitch.id;
    console.log("✅ Pitch created, ID:", pitchId);
    
    // Create a test file
    const testContent = "Test PDF content for upload";
    const blob = new Blob([testContent], { type: "application/pdf" });
    const file = new File([blob], "test-document.pdf", { type: "application/pdf" });
    
    // Test upload
    const formData = new FormData();
    formData.append("file", file);
    formData.append("pitchId", pitchId.toString());
    formData.append("documentType", "script");
    formData.append("isPublic", "true");
    
    console.log("📤 Testing document upload...");
    
    const uploadResponse = await fetch(`${API_BASE}/api/pitches/upload-document`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    });
    
    console.log("Upload response status:", uploadResponse.status);
    const uploadResult = await uploadResponse.text();
    console.log("Upload response:", uploadResult);
    
    if (uploadResponse.ok) {
      console.log("✅ Upload successful!");
      
      // Test retrieval
      const retrieveResponse = await fetch(`${API_BASE}/api/pitches/${pitchId}/documents`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      const documents = await retrieveResponse.json();
      console.log("📄 Retrieved documents:", documents);
    } else {
      console.log("❌ Upload failed");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

if (import.meta.main) {
  await testUploadEndpoint();
}