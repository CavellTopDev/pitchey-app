// Test API Client directly to see what's happening
async function testAPIClient() {
    try {
        console.log('Testing API client directly...');
        
        // Test 1: Direct fetch to backend
        const directResponse = await fetch('http://localhost:8001/api/pitches/public');
        const directData = await directResponse.json();
        
        console.log('=== DIRECT FETCH RESULTS ===');
        console.log('Status:', directResponse.status);
        console.log('Total pitches:', directData.pitches?.length || 0);
        
        const stellarPitches = directData.pitches?.filter(p => p.creator?.username === 'stellarproduction') || [];
        console.log('Stellar pitches found:', stellarPitches.length);
        stellarPitches.forEach(pitch => {
            console.log(`- ${pitch.title} (ID: ${pitch.id})`);
        });
        
        // Test 2: Simulate the frontend's API wrapper
        console.log('\n=== SIMULATING FRONTEND API CLIENT ===');
        
        const response = await fetch('http://localhost:8001/api/pitches/public', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Response text:', responseText.substring(0, 200));
            return;
        }
        
        // Simulate what apiClient.get() does
        const apiClientResponse = {
            success: response.ok,
            data: data.data || data
        };
        
        console.log('API Client Response Success:', apiClientResponse.success);
        console.log('API Client Data Structure:', typeof apiClientResponse.data);
        
        // Simulate what pitch.service.ts does
        const pitches = apiClientResponse.data?.pitches || [];
        console.log('Pitch Service Extraction - Pitches:', pitches.length);
        
        const stellarFromService = pitches.filter(p => p.creator?.username === 'stellarproduction');
        console.log('Stellar pitches from service:', stellarFromService.length);
        
        if (stellarFromService.length === 0 && stellarPitches.length > 0) {
            console.error('❌ ISSUE FOUND: Direct API has Stellar pitches but service extraction loses them!');
            console.log('Data structure analysis:');
            console.log('Direct data.pitches:', Array.isArray(directData.pitches));
            console.log('API client data.pitches:', Array.isArray(apiClientResponse.data?.pitches));
            console.log('API client data structure:', Object.keys(apiClientResponse.data || {}));
        } else if (stellarFromService.length > 0) {
            console.log('✅ Stellar pitches correctly extracted through service layer');
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testAPIClient();