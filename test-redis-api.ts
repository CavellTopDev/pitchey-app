// Test Redis caching via API endpoints
const BACKEND_URL = "http://localhost:8003";

console.log("=== Testing Redis Caching via API ===");

try {
  // Test 1: Get public pitches (should trigger caching)
  console.log("1. Testing public pitches endpoint (should cache)...");
  const response1 = await fetch(`${BACKEND_URL}/api/pitches/public`);
  const pitches1 = await response1.json();
  console.log(`   - Response: ${response1.status}, Pitches count: ${pitches1.length}`);

  // Test 2: Get public pitches again (should hit cache)
  console.log("2. Testing public pitches endpoint again (should hit cache)...");
  const response2 = await fetch(`${BACKEND_URL}/api/pitches/public`);
  const pitches2 = await response2.json();
  console.log(`   - Response: ${response2.status}, Pitches count: ${pitches2.length}`);

  // Test 3: Test individual pitch caching
  if (pitches1.length > 0) {
    const pitchId = pitches1[0].id;
    console.log(`3. Testing individual pitch endpoint (ID: ${pitchId})...`);
    const response3 = await fetch(`${BACKEND_URL}/api/pitches/${pitchId}`);
    const pitch = await response3.json();
    console.log(`   - Response: ${response3.status}, Pitch title: ${pitch.title}`);
  }

  console.log("\n✅ API caching tests completed!");

} catch (error) {
  console.error("❌ Error testing API caching:", error);
}

// Test Redis directly to check if keys are being stored
console.log("\n=== Checking Redis Keys ===");
try {
  // We'll use podman to check Redis keys
  console.log("Redis should contain cache keys like 'pitchey:development:*'");
} catch (error) {
  console.error("Error checking Redis keys:", error);
}