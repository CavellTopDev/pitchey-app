const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all files with broken fetch patterns
const result = execSync('grep -r "const response = await $" src --include="*.tsx" --include="*.ts" | cut -d: -f1 | sort -u', { encoding: 'utf8' });
const files = result.split('\n').filter(f => f.trim());

console.log(`Found ${files.length} files to fix...`);

files.forEach(filePath => {
  if (!filePath.trim()) return;
  
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping non-existent file: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    // Check for broken await statement
    if (lines[i].trim() === 'const response = await' || 
        (lines[i].includes('const response = await ') && lines[i].trim().endsWith('await'))) {
      
      // Look at next lines to understand what's happening
      if (i + 1 < lines.length && lines[i + 1].includes('credentials:')) {
        console.log(`Fixing line ${i + 1} in ${filePath}`);
        
        // Determine the endpoint based on file context
        let endpoint = '${config.API_URL}/api/endpoint';
        let method = 'GET';
        let hasBody = false;
        let hasHeaders = false;
        
        // Try to guess endpoint from file path and context
        const fileName = path.basename(filePath);
        const dirName = path.dirname(filePath);
        
        if (fileName.includes('Analytics')) {
          endpoint = '${config.API_URL}/api/analytics';
        } else if (fileName.includes('Settings')) {
          endpoint = '${config.API_URL}/api/user/settings';
        } else if (fileName.includes('Profile')) {
          endpoint = '${config.API_URL}/api/user/profile';
        } else if (fileName.includes('Following')) {
          endpoint = '${config.API_URL}/api/follows';
        } else if (fileName.includes('Calendar')) {
          endpoint = '${config.API_URL}/api/calendar';
        } else if (fileName.includes('NDA')) {
          endpoint = '${config.API_URL}/api/nda';
        } else if (dirName.includes('admin')) {
          endpoint = '${config.API_URL}/api/admin';
        } else if (dirName.includes('production')) {
          endpoint = '${config.API_URL}/api/production';
        }
        
        // Check for method in next few lines
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes("method: 'POST'")) {
            method = 'POST';
          } else if (lines[j].includes("method: 'PUT'")) {
            method = 'PUT';
          } else if (lines[j].includes("method: 'DELETE'")) {
            method = 'DELETE';
          }
          if (lines[j].includes('body:')) {
            hasBody = true;
          }
          if (lines[j].includes('headers:') && !lines[j].includes('headers: {')) {
            hasHeaders = true;
          }
        }
        
        // Build the correct fetch call
        let newFetch = `    const response = await fetch(\`${endpoint}\`, {`;
        let newLines = [`      method: '${method}',`];
        
        if (hasHeaders || hasBody) {
          newLines.push(`      headers: { 'Content-Type': 'application/json' },`);
        }
        
        // Find and add body if it exists
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('body:')) {
            newLines.push(`      ${lines[j].trim()}`);
            break;
          }
        }
        
        newLines.push(`      credentials: 'include' // Send cookies for Better Auth session`);
        newLines.push(`    });`);
        
        // Replace the broken lines
        lines[i] = newFetch;
        
        // Find where the fetch call ends
        let endIndex = i + 1;
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          if (lines[j].includes('});')) {
            endIndex = j + 1;
            break;
          }
        }
        
        // Replace with new lines
        lines.splice(i + 1, endIndex - i - 1, ...newLines);
        modified = true;
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(fullPath, lines.join('\n'));
    console.log(`✅ Fixed: ${filePath}`);
  }
});

console.log('\n✅ All fetch calls fixed!');
console.log('📝 Note: Some endpoints may need adjustment based on actual API routes');