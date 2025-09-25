#!/usr/bin/env -S deno run --allow-all
// Final Production Test and Report

import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");
const BACKEND_URL = "https://pitchey-backend.deno.dev";
const FRONTEND_URL = "https://pitchey-frontend.deno.dev";

console.log("=" .repeat(60));
console.log("📊 FINAL PRODUCTION TEST REPORT");
console.log("=" .repeat(60));
console.log(`Date: ${new Date().toISOString()}`);
console.log(`Backend: ${BACKEND_URL}`);
console.log(`Frontend: ${FRONTEND_URL}`);
console.log("");

const results = {
  authentication: {},
  database: {},
  api: {},
  features: {}
};

// Test 1: Authentication
console.log("🔐 AUTHENTICATION TESTS");
console.log("-".repeat(40));

const testAuth = async (portal: string, email: string, password: string) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/${portal}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    const success = data.success && data.token;
    
    console.log(`${success ? "✅" : "❌"} ${portal} portal: ${email}`);
    results.authentication[portal] = success;
    return data.token;
  } catch (error) {
    console.log(`❌ ${portal} portal: ERROR - ${error.message}`);
    results.authentication[portal] = false;
    return null;
  }
};

const creatorToken = await testAuth("creator", "alex.creator@demo.com", "Demo123");
const investorToken = await testAuth("investor", "sarah.investor@demo.com", "Demo123");
const productionToken = await testAuth("production", "stellar.production@demo.com", "Demo123");

// Test 2: Database Health
console.log("\n💾 DATABASE HEALTH");
console.log("-".repeat(40));

try {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  
  console.log(`✅ Connected to database`);
  console.log(`   Tables: ${tables.length}`);
  
  const criticalTables = ['users', 'pitches', 'ndas', 'nda_requests', 'notifications'];
  for (const table of criticalTables) {
    const exists = tables.some(t => t.table_name === table);
    console.log(`   ${exists ? "✅" : "❌"} ${table}`);
    results.database[table] = exists;
  }
  
  // Check pitch data
  const pitchCount = await sql`SELECT COUNT(*) as count FROM pitches`;
  const publishedCount = await sql`SELECT COUNT(*) as count FROM pitches WHERE status = 'published'`;
  
  console.log(`   📊 Pitches: ${pitchCount[0].count} total, ${publishedCount[0].count} published`);
  results.database.pitchCount = parseInt(pitchCount[0].count);
  results.database.publishedCount = parseInt(publishedCount[0].count);
  
} catch (error) {
  console.log(`❌ Database connection failed: ${error.message}`);
  results.database.connected = false;
}

// Test 3: API Endpoints
console.log("\n🌐 API ENDPOINTS");
console.log("-".repeat(40));

const testEndpoint = async (name: string, method: string, path: string, token?: string, body?: any) => {
  try {
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    const data = await response.json();
    const success = response.status < 400 && !data.error;
    
    console.log(`${success ? "✅" : "⚠️"} ${method} ${path}`);
    if (!success && data.error) {
      console.log(`   Error: ${data.error}`);
    }
    
    results.api[name] = { success, status: response.status, error: data.error };
    return data;
  } catch (error) {
    console.log(`❌ ${method} ${path}: ${error.message}`);
    results.api[name] = { success: false, error: error.message };
    return null;
  }
};

await testEndpoint("pitches_list", "GET", "/api/pitches", investorToken);
await testEndpoint("pitch_detail", "GET", "/api/pitches/1", investorToken);
await testEndpoint("nda_request", "POST", "/api/pitches/1/request-nda", investorToken, {
  ndaType: "basic",
  requestMessage: "Test NDA request"
});
await testEndpoint("user_profile", "GET", "/api/user/profile", creatorToken);

// Test 4: Feature Status
console.log("\n🚀 FEATURE STATUS");
console.log("-".repeat(40));

const features = [
  { name: "User Authentication", status: Object.values(results.authentication).every(v => v) },
  { name: "Database Connection", status: results.database.users && results.database.pitches },
  { name: "NDA Workflow", status: results.api.nda_request?.success || results.api.nda_request?.error?.includes("already") },
  { name: "Pitch Browsing", status: results.api.pitch_detail?.success },
  { name: "Pitch Listing", status: results.api.pitches_list?.success },
];

features.forEach(f => {
  console.log(`${f.status ? "✅" : "❌"} ${f.name}`);
  results.features[f.name] = f.status;
});

// Test 5: Known Issues
console.log("\n⚠️  KNOWN ISSUES");
console.log("-".repeat(40));

const issues = [];

if (!results.api.pitches_list?.success) {
  issues.push("Pitch listing endpoint returns error (likely Drizzle ORM relation issue)");
}

if (results.database.publishedCount === 0) {
  issues.push("No published pitches (all pitches need status='published' for public listing)");
}

if (issues.length === 0) {
  console.log("✅ No critical issues detected");
} else {
  issues.forEach(issue => console.log(`• ${issue}`));
}

// Final Summary
console.log("\n" + "=".repeat(60));
console.log("📈 OVERALL STATUS");
console.log("=".repeat(60));

const criticalFeatures = [
  "User Authentication",
  "Database Connection", 
  "NDA Workflow",
  "Pitch Browsing"
];

const workingCount = criticalFeatures.filter(f => results.features[f]).length;
const percentage = Math.round((workingCount / criticalFeatures.length) * 100);

console.log(`Critical Features: ${workingCount}/${criticalFeatures.length} working (${percentage}%)`);

if (percentage === 100) {
  console.log("\n🎉 PRODUCTION READY - All critical features operational!");
} else if (percentage >= 75) {
  console.log("\n✅ MOSTLY OPERATIONAL - Minor issues to address");
} else if (percentage >= 50) {
  console.log("\n⚠️  PARTIALLY OPERATIONAL - Several issues need attention");
} else {
  console.log("\n❌ CRITICAL ISSUES - Immediate attention required");
}

console.log("\n" + "=".repeat(60));
console.log("📝 RECOMMENDATIONS");
console.log("=".repeat(60));

const recommendations = [];

if (!results.api.pitches_list?.success) {
  recommendations.push("1. Fix Drizzle ORM relations in pitch listing query");
  recommendations.push("   - Check that relations match actual database columns");
  recommendations.push("   - Consider simplifying the query or using raw SQL");
}

if (results.database.publishedCount === 0) {
  recommendations.push("2. Update pitch statuses to 'published' for public visibility");
}

if (recommendations.length > 0) {
  recommendations.forEach(r => console.log(r));
} else {
  console.log("✅ No immediate recommendations - system fully operational");
}

console.log("\n" + "=".repeat(60));
console.log("END OF REPORT");
console.log("=" .repeat(60));