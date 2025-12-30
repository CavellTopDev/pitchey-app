const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/lib/apiServices.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix line 68 - request NDA
content = content.replace(
  /const response = await \s*\n\s*credentials: 'include'[^}]*?\n\s*method: 'POST',\s*\n\s*headers: getAuthHeaders\(\),\s*\n\s*body: JSON\.stringify\({ pitchId, \.\.\.data }\),/,
  `const response = await fetch(\`\${API_URL}/api/nda/request\`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pitchId, ...data }),
      credentials: 'include' // Send cookies for Better Auth session`
);

// Fix line 80 - get NDA requests
content = content.replace(
  /const response = await \s*\n\s*credentials: 'include'[^}]*?\n\s*headers: getAuthHeaders\(\),/g,
  `const response = await fetch(\`\${API_URL}/api/nda/\${type}\`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include' // Send cookies for Better Auth session`
);

// Look for other patterns and fix them
const lines = content.split('\n');
let fixed = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'const response = await') {
    fixed = true;
    
    // Look at context to determine the URL
    let url = '';
    let method = 'GET';
    
    // Check previous lines for context
    for (let j = Math.max(0, i - 10); j < i; j++) {
      // Check function names and comments
      if (lines[j].includes('getRequests')) {
        url = '`${API_URL}/api/nda/${type}`';
      } else if (lines[j].includes('approve') || lines[j].includes('Approve')) {
        url = '`${API_URL}/api/nda/${requestId}/approve`';
        method = 'PUT';
      } else if (lines[j].includes('reject') || lines[j].includes('Reject')) {
        url = '`${API_URL}/api/nda/${requestId}/reject`';
        method = 'PUT';
      } else if (lines[j].includes('getSigned')) {
        url = '`${API_URL}/api/nda/signed`';
      } else if (lines[j].includes('pitch history')) {
        url = '`${API_URL}/api/nda/pitch/${pitchId}`';
      } else if (lines[j].includes('getDocumentRequests')) {
        url = '`${API_URL}/api/documents/${documentId}/requests`';
      } else if (lines[j].includes('requestDocumentAccess')) {
        url = '`${API_URL}/api/documents/${documentId}/request-access`';
        method = 'POST';
      } else if (lines[j].includes('getDocumentNdaStatus')) {
        url = '`${API_URL}/api/documents/${documentId}/nda-status`';
      }
    }
    
    // Check next lines for method clues
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].includes('method: \'POST\'')) {
        method = 'POST';
      } else if (lines[j].includes('method: \'PUT\'')) {
        method = 'PUT';
      } else if (lines[j].includes('method: \'DELETE\'')) {
        method = 'DELETE';
      }
      
      if (lines[j].includes('body:')) {
        // Has body, likely POST or PUT
        if (method === 'GET') method = 'POST';
      }
    }
    
    if (url) {
      // Build proper fetch call
      let newFetch = `    const response = await fetch(${url}, {`;
      lines[i] = newFetch;
      
      // Fix the next line to have proper formatting
      if (lines[i + 1].includes('credentials:')) {
        // Move credentials to end
        let hasBody = false;
        let hasHeaders = false;
        
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('body:')) hasBody = true;
          if (lines[j].includes('headers:')) hasHeaders = true;
        }
        
        let newLines = [`      method: '${method}',`];
        if (hasHeaders) newLines.push('      headers: getAuthHeaders(),');
        if (hasBody) {
          // Find body line
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            if (lines[j].includes('body:')) {
              newLines.push(`      ${lines[j].trim()}`);
              break;
            }
          }
        }
        newLines.push('      credentials: \'include\' // Send cookies for Better Auth session');
        
        // Replace the broken lines
        let endIndex = i + 1;
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('});')) {
            endIndex = j;
            break;
          }
        }
        
        lines.splice(i + 1, endIndex - i - 1, ...newLines);
      }
    }
  }
}

if (fixed) {
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('✅ Fixed apiServices.ts fetch calls');
}

// Also check if there are any remaining Authorization header references that should be removed
content = fs.readFileSync(filePath, 'utf8');
if (content.includes('\'Authorization\': token ? `Bearer ${token}` :')) {
  // Better Auth uses cookies, but keep backwards compatibility for now
  console.log('Note: Authorization headers still present for backwards compatibility');
}

console.log('✅ apiServices.ts fixes complete!');