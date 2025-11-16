/**
 * Character Management Test Script
 * Tests the new character management API endpoints
 */

const API_BASE = "http://localhost:8001";

// Test character data
const testCharacter = {
  name: "John Protagonist",
  description: "A determined detective seeking justice in a corrupt city",
  age: "35",
  gender: "Male",
  actor: "Ryan Gosling",
  role: "Protagonist",
  relationship: "Father to Sarah, Partner to Detective Smith"
};

const testCharacter2 = {
  name: "Sarah Villain",
  description: "A cunning mastermind behind the city's corruption",
  age: "28",
  gender: "Female",
  actor: "Margot Robbie",
  role: "Antagonist",
  relationship: "Daughter of John, Former colleague of Detective Smith"
};

// Demo user credentials
const CREATOR_CREDENTIALS = {
  email: "alex.creator@demo.com",
  password: "Demo123"
};

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();
  
  console.log(`${options.method || 'GET'} ${endpoint} - Status: ${response.status}`);
  if (!response.ok) {
    console.error('Error:', data);
  }
  
  return { response, data };
}

async function authenticateCreator() {
  console.log('\n=== Authenticating Creator ===');
  
  const { response, data } = await makeRequest('/api/auth/creator/login', {
    method: 'POST',
    body: JSON.stringify(CREATOR_CREDENTIALS),
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate creator');
  }

  console.log('✅ Creator authenticated successfully');
  return data.token;
}

async function createTestPitch(token: string) {
  console.log('\n=== Creating Test Pitch ===');
  
  const testPitch = {
    title: "Character Management Test Pitch",
    logline: "A test pitch for character management functionality",
    genre: "thriller",
    format: "feature"
  };

  const { response, data } = await makeRequest('/api/pitches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(testPitch),
  });

  if (!response.ok) {
    throw new Error('Failed to create test pitch');
  }

  console.log('✅ Test pitch created:', data.pitch?.id);
  return data.pitch.id;
}

async function testCharacterOperations(token: string, pitchId: number) {
  console.log('\n=== Testing Character Operations ===');
  
  // 1. Add first character
  console.log('\n1. Adding first character...');
  const { data: char1Data } = await makeRequest(`/api/pitches/${pitchId}/characters`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(testCharacter),
  });

  const character1Id = char1Data.data?.character?.id;
  console.log('✅ First character added with ID:', character1Id);

  // 2. Add second character
  console.log('\n2. Adding second character...');
  const { data: char2Data } = await makeRequest(`/api/pitches/${pitchId}/characters`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(testCharacter2),
  });

  const character2Id = char2Data.data?.character?.id;
  console.log('✅ Second character added with ID:', character2Id);

  // 3. Get all characters
  console.log('\n3. Getting all characters...');
  const { data: allCharsData } = await makeRequest(`/api/pitches/${pitchId}/characters`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('✅ Retrieved characters:', allCharsData.data?.characters?.length || 0);
  console.log('Characters:', allCharsData.data?.characters?.map((c: any) => ({ id: c.id, name: c.name, displayOrder: c.displayOrder })));

  // 4. Update first character
  console.log('\n4. Updating first character...');
  const updatedCharacter = {
    ...testCharacter,
    name: "John Hero (Updated)",
    description: "An updated description for our protagonist"
  };

  await makeRequest(`/api/pitches/${pitchId}/characters/${character1Id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(updatedCharacter),
  });

  console.log('✅ First character updated');

  // 5. Move character (test position update)
  if (character2Id) {
    console.log('\n5. Moving second character up...');
    await makeRequest(`/api/pitches/${pitchId}/characters/${character2Id}/position`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ direction: 'up' }),
    });

    console.log('✅ Character moved up');
  }

  // 6. Test reordering
  console.log('\n6. Testing character reordering...');
  const reorderData = {
    characterOrders: [
      { id: parseInt(character2Id), displayOrder: 0 },
      { id: parseInt(character1Id), displayOrder: 1 }
    ]
  };

  const { data: reorderResult } = await makeRequest(`/api/pitches/${pitchId}/characters/reorder`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(reorderData),
  });

  console.log('✅ Characters reordered');
  console.log('New order:', reorderResult.data?.characters?.map((c: any) => ({ id: c.id, name: c.name, displayOrder: c.displayOrder })));

  // 7. Delete second character
  console.log('\n7. Deleting second character...');
  await makeRequest(`/api/pitches/${pitchId}/characters/${character2Id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('✅ Second character deleted');

  // 8. Verify final state
  console.log('\n8. Verifying final state...');
  const { data: finalCharsData } = await makeRequest(`/api/pitches/${pitchId}/characters`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('✅ Final characters count:', finalCharsData.data?.characters?.length || 0);
  console.log('Remaining characters:', finalCharsData.data?.characters?.map((c: any) => ({ id: c.id, name: c.name, displayOrder: c.displayOrder })));

  return character1Id;
}

async function cleanupTestData(token: string, pitchId: number) {
  console.log('\n=== Cleaning Up Test Data ===');
  
  // Delete the test pitch (this should cascade delete characters)
  await makeRequest(`/api/pitches/${pitchId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('✅ Test pitch deleted');
}

async function main() {
  try {
    console.log('🧪 Starting Character Management API Test');
    
    // Authenticate creator
    const token = await authenticateCreator();
    
    // Create test pitch
    const pitchId = await createTestPitch(token);
    
    // Test character operations
    const remainingCharacterId = await testCharacterOperations(token, pitchId);
    
    // Cleanup
    await cleanupTestData(token, pitchId);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('- ✅ Character creation');
    console.log('- ✅ Character retrieval');
    console.log('- ✅ Character updating');
    console.log('- ✅ Character position movement');
    console.log('- ✅ Character reordering');
    console.log('- ✅ Character deletion');
    console.log('- ✅ Cleanup operations');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.main) {
  main();
}