const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/services/upload.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the broken fetch calls from the previous script
// Line 120-127: Fix uploadMultipleDocumentsEnhanced
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
      method: 'POST',
      
      body: formData,
      signal: uploadOptions.signal
    });`,
  `const response = await fetch(\`\${this.baseUrl}/api/upload/multiple\`, {
      method: 'POST',
      body: formData,
      signal: uploadOptions.signal,
      credentials: 'include' // Send cookies for Better Auth session
    });`
);

// Line 166-173: Fix uploadMultipleMediaEnhanced
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
      method: 'POST',
      
      body: formData,
      signal: options.signal
    });`,
  `const response = await fetch(\`\${this.baseUrl}/api/upload/media-batch\`, {
      method: 'POST',
      body: formData,
      signal: options.signal,
      credentials: 'include' // Send cookies for Better Auth session
    });`
);

// Line 490-495: Fix deleteDocument
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
      method: 'DELETE',
      
    });`,
  `const response = await fetch(\`\${this.baseUrl}/api/documents/\${documentId}\`, {
      method: 'DELETE',
      credentials: 'include' // Send cookies for Better Auth session
    });`
);

// Line 507-512: Fix deleteFile
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
      method: 'DELETE',
      
    });`,
  `const response = await fetch(\`\${this.baseUrl}/api/files/\${filename}\`, {
      method: 'DELETE',
      credentials: 'include' // Send cookies for Better Auth session
    });`
);

// Line 527-532: Fix getDocumentDownloadUrl
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
      method: 'GET',
      
    });`,
  `const response = await fetch(\`\${url}\${queryParams}\`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });`
);

// Line 563-574: Fix getPresignedUploadUrl  
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
      method: 'POST',
      
      body: JSON.stringify({
        fileName,
        contentType,
        folder: options.folder || 'uploads',
        fileSize: options.fileSize
      })
    });`,
  `const response = await fetch(\`\${this.baseUrl}/api/upload/presigned\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName,
        contentType,
        folder: options.folder || 'uploads',
        fileSize: options.fileSize
      }),
      credentials: 'include' // Send cookies for Better Auth session
    });`
);

// Line 601-606: Fix getStorageQuota
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
      method: 'GET',
      
    });`,
  `const response = await fetch(\`\${this.baseUrl}/api/storage/quota\`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });`
);

// Line 738-742: Fix getUploadInfo
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
      
    });`,
  `const response = await fetch(\`\${this.baseUrl}/api/upload/info\`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });`
);

// Line 762-766: Fix getUploadAnalytics
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
      
    });`,
  `const response = await fetch(\`\${this.baseUrl}/api/upload/analytics?timeframe=\${timeframe}\`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });`
);

// Line 812-816: Fix checkFileExists
content = content.replace(
  `const response = await 
      credentials: 'include', // Send cookies for Better Auth session
      
        
      });`,
  `const response = await fetch(\`\${this.baseUrl}/api/files/check/\${hash}\`, {
        method: 'GET',
        credentials: 'include' // Send cookies for Better Auth session
      });`
);

// Remove the empty token check block (lines 401-405)
content = content.replace(
  `// Add authentication if available
      const token = localStorage.getItem('authToken');
      if (token) {
        
      }`,
  `// Better Auth uses cookies, not Authorization headers
      // Authentication is handled via withCredentials = true`
);

fs.writeFileSync(filePath, content);
console.log('✅ Fixed upload.service.ts - all Better Auth fixes applied');