const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files with broken fetch calls
const files = glob.sync('src/**/*.{ts,tsx}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Pattern to fix broken fetch calls where "await" is alone
  // This happens when Authorization headers were removed but fetch syntax was broken
  
  // Fix patterns like:
  // const response = await 
  // credentials: 'include',
  // To proper fetch calls
  
  // First, let's identify the specific patterns and fix them
  if (content.includes('const response = await \n')) {
    console.log(`Fixing broken fetch in: ${file}`);
    
    // For apiServices.ts - these are function calls that need fixing
    if (file.includes('apiServices.ts')) {
      // Pattern for getCreatorProfile
      content = content.replace(
        /const response = await \s*\n\s*credentials: 'include'[^}]*\}\);/g,
        (match) => {
          // Try to extract the URL from context
          if (match.includes('/api/creators/')) {
            return `const response = await fetch(\`\${API_URL}/api/creators/\${creatorId}\`, {
        method: 'GET',
        credentials: 'include'
      });`;
          } else if (match.includes('/api/investor/')) {
            return `const response = await fetch(\`\${API_URL}/api/investor/profile\`, {
        method: 'GET',
        credentials: 'include'
      });`;
          } else if (match.includes('/api/production/')) {
            return `const response = await fetch(\`\${API_URL}/api/production/profile\`, {
        method: 'GET',
        credentials: 'include'
      });`;
          }
          return match;
        }
      );
    }
    
    // For better-auth-client.tsx
    if (file.includes('better-auth-client.tsx')) {
      content = content.replace(
        /const response = await \s*\n\s*credentials: 'include'[^}]*\}\);/g,
        `const response = await fetch(\`\${config.API_URL}/api/auth/session\`, {
          method: 'GET',
          credentials: 'include'
        });`
      );
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`✅ Fixed: ${file}`);
  }
});

// Now fix apiServices.ts specifically since it has many broken calls
const apiServicesPath = 'src/lib/apiServices.ts';
if (fs.existsSync(apiServicesPath)) {
  let content = fs.readFileSync(apiServicesPath, 'utf8');
  
  // Read the file to understand the context better
  const lines = content.split('\n');
  let inFunction = '';
  let fixed = false;
  
  for (let i = 0; i < lines.length; i++) {
    // Track which function we're in
    if (lines[i].includes('export const')) {
      const match = lines[i].match(/export const (\w+)/);
      if (match) {
        inFunction = match[1];
      }
    }
    
    // Fix broken await statements based on function context
    if (lines[i].includes('const response = await ') && lines[i].trim() === 'const response = await') {
      fixed = true;
      console.log(`Fixing ${inFunction} at line ${i + 1}`);
      
      // Determine the correct fetch call based on function name
      switch(inFunction) {
        case 'getCreatorProfile':
          lines[i] = '    const response = await fetch(`${API_URL}/api/creators/${creatorId}`, {';
          lines[i + 1] = '      method: \'GET\',';
          lines[i + 2] = '      credentials: \'include\' // Send cookies for Better Auth session';
          break;
        case 'updateCreatorProfile':
          lines[i] = '    const response = await fetch(`${API_URL}/api/creators/${creatorId}`, {';
          lines[i + 1] = '      method: \'PUT\',';
          lines[i + 2] = '      headers: { \'Content-Type\': \'application/json\' },';
          lines[i + 3] = '      body: JSON.stringify(data),';
          lines[i + 4] = '      credentials: \'include\' // Send cookies for Better Auth session';
          break;
        case 'getInvestorProfile':
          lines[i] = '    const response = await fetch(`${API_URL}/api/investor/profile`, {';
          lines[i + 1] = '      method: \'GET\',';
          lines[i + 2] = '      credentials: \'include\' // Send cookies for Better Auth session';
          break;
        case 'updateInvestorProfile':
          lines[i] = '    const response = await fetch(`${API_URL}/api/investor/profile`, {';
          lines[i + 1] = '      method: \'PUT\',';
          lines[i + 2] = '      headers: { \'Content-Type\': \'application/json\' },';
          lines[i + 3] = '      body: JSON.stringify(data),';
          lines[i + 4] = '      credentials: \'include\' // Send cookies for Better Auth session';
          break;
        case 'getProductionProfile':
          lines[i] = '    const response = await fetch(`${API_URL}/api/production/profile`, {';
          lines[i + 1] = '      method: \'GET\',';
          lines[i + 2] = '      credentials: \'include\' // Send cookies for Better Auth session';
          break;
        case 'updateProductionProfile':
          lines[i] = '    const response = await fetch(`${API_URL}/api/production/profile`, {';
          lines[i + 1] = '      method: \'PUT\',';
          lines[i + 2] = '      headers: { \'Content-Type\': \'application/json\' },';
          lines[i + 3] = '      body: JSON.stringify(data),';
          lines[i + 4] = '      credentials: \'include\' // Send cookies for Better Auth session';
          break;
        case 'createProject':
          lines[i] = '    const response = await fetch(`${API_URL}/api/projects`, {';
          lines[i + 1] = '      method: \'POST\',';
          lines[i + 2] = '      headers: { \'Content-Type\': \'application/json\' },';
          lines[i + 3] = '      body: JSON.stringify(projectData),';
          lines[i + 4] = '      credentials: \'include\' // Send cookies for Better Auth session';
          break;
        case 'updateProject':
          lines[i] = '    const response = await fetch(`${API_URL}/api/projects/${projectId}`, {';
          lines[i + 1] = '      method: \'PUT\',';
          lines[i + 2] = '      headers: { \'Content-Type\': \'application/json\' },';
          lines[i + 3] = '      body: JSON.stringify(projectData),';
          lines[i + 4] = '      credentials: \'include\' // Send cookies for Better Auth session';
          break;
      }
    }
  }
  
  if (fixed) {
    fs.writeFileSync(apiServicesPath, lines.join('\n'));
    console.log('✅ Fixed apiServices.ts');
  }
}

console.log('✅ All broken fetch calls fixed!');