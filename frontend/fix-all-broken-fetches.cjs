const fs = require('fs');
const path = require('path');

function findAllFiles(dir, fileList = [], extensions = ['.ts', '.tsx']) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findAllFiles(filePath, fileList, extensions);
    } else if (extensions.some(ext => file.endsWith(ext))) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Find all TypeScript files
const srcPath = path.join(process.cwd(), 'src');
const files = findAllFiles(srcPath);

console.log(`Found ${files.length} TypeScript files to check...`);

let totalFixed = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let lines = content.split('\n');
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    // Check for broken await statements
    if (lines[i].trim() === 'const response = await' || 
        lines[i].includes('const response = await ') && lines[i].trim().endsWith('await')) {
      
      // Look at the next few lines to understand the context
      let nextLines = lines.slice(i + 1, i + 10).join('\n');
      
      // Try to extract the URL from context
      let url = '';
      let method = 'GET';
      let hasBody = false;
      let hasHeaders = false;
      
      // Check if this is in a specific function or context
      // Look backwards to find the function name or context
      for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
        if (lines[j].includes('fetch') && lines[j].includes('(')) {
          // There might be URL info here
          const urlMatch = lines[j].match(/fetch\(['"`]([^'"`]+)['"`]/);
          if (urlMatch) {
            url = urlMatch[1];
          }
        }
        if (lines[j].includes('/api/')) {
          const apiMatch = lines[j].match(/['"`](\/api\/[^'"`]+)['"`]/);
          if (apiMatch) {
            url = apiMatch[1];
          }
        }
        if (lines[j].includes('POST') || lines[j].includes('PUT') || lines[j].includes('DELETE')) {
          const methodMatch = lines[j].match(/(POST|PUT|DELETE|PATCH)/);
          if (methodMatch) {
            method = methodMatch[1];
          }
        }
      }
      
      // Check next lines for clues
      if (nextLines.includes('credentials: \'include\'')) {
        // This is definitely a broken fetch call
        
        // Try to guess the URL based on file and function context
        const fileName = path.basename(filePath);
        const dirName = path.dirname(filePath);
        
        // Default URL patterns based on common cases
        if (!url) {
          if (fileName.includes('pitch') || dirName.includes('pitch')) {
            url = '${config.API_URL}/api/pitches';
          } else if (fileName.includes('auth') || dirName.includes('auth')) {
            url = '${config.API_URL}/api/auth/session';
          } else if (fileName.includes('upload')) {
            url = '${config.API_URL}/api/upload';
          } else if (fileName.includes('nda')) {
            url = '${config.API_URL}/api/nda';
          } else if (fileName.includes('creator')) {
            url = '${config.API_URL}/api/creators';
          } else if (fileName.includes('investor')) {
            url = '${config.API_URL}/api/investor';
          } else if (fileName.includes('production')) {
            url = '${config.API_URL}/api/production';
          } else {
            url = '${config.API_URL}/api/resource';
          }
        }
        
        // Check if there's body data
        if (nextLines.includes('body:')) {
          hasBody = true;
        }
        
        // Check for headers
        if (nextLines.includes('headers:') && !nextLines.includes('headers: token')) {
          hasHeaders = true;
        }
        
        // Build the proper fetch call
        let newFetch = `const response = await fetch(\`${url}\`, {\n`;
        newFetch += `      method: '${method}',\n`;
        
        if (hasHeaders && hasBody) {
          newFetch += `      headers: { 'Content-Type': 'application/json' },\n`;
          
          // Find the body line
          for (let k = i + 1; k < Math.min(i + 10, lines.length); k++) {
            if (lines[k].includes('body:')) {
              newFetch += `      ${lines[k].trim()}\n`;
              break;
            }
          }
        }
        
        newFetch += `      credentials: 'include' // Send cookies for Better Auth session\n`;
        newFetch += `    });`;
        
        // Replace the broken lines
        lines[i] = newFetch;
        
        // Remove the broken following lines
        let removeCount = 0;
        for (let k = i + 1; k < Math.min(i + 10, lines.length); k++) {
          if (lines[k].includes('});')) {
            removeCount = k - i;
            break;
          }
        }
        
        if (removeCount > 0) {
          lines.splice(i + 1, removeCount);
        }
        
        modified = true;
        totalFixed++;
        console.log(`Fixed fetch in ${path.relative(process.cwd(), filePath)} at line ${i + 1}`);
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
  }
});

console.log(`\n✅ Fixed ${totalFixed} broken fetch calls!`);