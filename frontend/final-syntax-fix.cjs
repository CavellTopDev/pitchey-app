const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all files with broken syntax
const result = execSync('grep -r "credentials: \'include\'" src --include="*.tsx" --include="*.ts" | grep -v "//" | cut -d: -f1 | sort -u', { encoding: 'utf8' });
const files = result.split('\n').filter(f => f.trim());

console.log(`Checking ${files.length} files for syntax issues...`);

files.forEach(filePath => {
  if (!filePath.trim()) return;
  
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;
  
  // Fix missing commas before credentials
  content = content.replace(/body: JSON\.stringify\([^)]+\)\s*credentials:/g, 
                            'body: JSON.stringify({}),\n      credentials:');
  
  // Fix credentials appearing inside JSON.stringify
  content = content.replace(/body: JSON\.stringify\(\{[\s\S]*?credentials:[\s\S]*?\}\);/g, function(match) {
    // Move credentials outside of JSON.stringify
    return 'body: JSON.stringify({}),\n      credentials:';
  });
  
  // Fix double closing braces
  content = content.replace(/\}\)\s*credentials:/g, '}),\n      credentials:');
  
  // Fix headers without comma
  content = content.replace(/headers: \{[^}]+\}\s*credentials:/g, function(match) {
    return match.replace(/\}\s*credentials:/, '},\n      credentials:');
  });
  
  // Fix formData without comma
  content = content.replace(/body: formData\s*credentials:/g, 'body: formData,\n      credentials:');
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content);
    console.log(`✅ Fixed syntax in ${filePath}`);
  }
});

console.log('\n✅ All syntax fixes applied!');