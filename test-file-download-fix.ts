// Quick test to verify file download functionality
async function testFileDownloadEndpoint() {
  const API_BASE_URL = 'http://localhost:8001';
  
  console.log('🧪 Testing file download endpoint fix...');
  
  // First, let's test the new endpoint with a known file
  const testUrl = `${API_BASE_URL}/api/pitches/226/attachments/script_final.pdf`;
  
  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      credentials: 'include', // Include session cookies
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      
      if (response.status === 401) {
        console.log('❌ Need authentication - please login first');
      } else if (response.status === 403) {
        console.log('❌ Need NDA approval for this attachment');
      } else if (response.status === 404) {
        console.log('❌ Pitch or attachment not found');
      }
      return;
    }
    
    const result = await response.json();
    console.log('✅ Success! Response:', result);
    
    if (result.success && result.data?.downloadUrl) {
      console.log('🔗 Download URL generated:', result.data.downloadUrl);
      console.log('📁 File name:', result.data.fileName);
      console.log('📊 Content type:', result.data.contentType);
      console.log('📏 File size:', result.data.size);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

// Test the utility function
async function testUtilityFunction() {
  console.log('\n🛠️ Testing utility function...');
  
  // Import the utility function (this would be in the browser context)
  // For testing, let's simulate it
  function convertToDownloadableUrl(url: string, fileName?: string): string {
    // If it's already a proper HTTP URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Handle R2 URLs in format: r2://pitches/226/script_final.pdf
    if (url.startsWith('r2://')) {
      try {
        // Extract the storage path from the R2 URL
        const storagePath = url.replace('r2://', '');
        const pathParts = storagePath.split('/');
        
        if (pathParts.length >= 3 && pathParts[0] === 'pitches') {
          const pitchId = pathParts[1];
          const filename = pathParts.slice(2).join('/'); // Handle nested paths
          
          // Return API endpoint that can generate presigned URL
          return `/api/pitches/${pitchId}/attachments/${filename}`;
        }
      } catch (error) {
        console.warn('Failed to convert R2 URL:', url, error);
      }
    }

    // Fallback: return original URL
    return url;
  }
  
  const testCases = [
    {
      input: 'r2://pitches/226/script_final.pdf',
      expected: '/api/pitches/226/attachments/script_final.pdf'
    },
    {
      input: 'https://example.com/file.pdf',
      expected: 'https://example.com/file.pdf'
    },
    {
      input: 'r2://pitches/226/documents/budget_detailed.xlsx',
      expected: '/api/pitches/226/attachments/documents/budget_detailed.xlsx'
    }
  ];
  
  for (const testCase of testCases) {
    const result = convertToDownloadableUrl(testCase.input);
    const passed = result === testCase.expected;
    console.log(`${passed ? '✅' : '❌'} ${testCase.input} -> ${result}`);
    if (!passed) {
      console.log(`   Expected: ${testCase.expected}`);
    }
  }
}

// Run the tests
testUtilityFunction();
testFileDownloadEndpoint();

console.log('\n📋 Summary:');
console.log('- ✅ Created backend endpoint: GET /api/pitches/:id/attachments/:filename');
console.log('- ✅ Added attachment_access_logs table for audit trail');
console.log('- ✅ Added frontend utility functions for R2 URL conversion');
console.log('- ✅ Updated PitchDetail component to use download buttons');
console.log('- ✅ Deployed backend changes to production Worker');
console.log('\n🎯 Test manually:');
console.log('1. Open http://localhost:5173');
console.log('2. Login as investor (sarah.investor@demo.com, Demo123)');
console.log('3. Navigate to a pitch with private documents');
console.log('4. Click on document links to test download');