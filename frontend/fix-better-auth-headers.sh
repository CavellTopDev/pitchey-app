#!/bin/bash

echo "🔧 Fixing Better Auth headers - removing JWT Authorization headers and using cookies instead..."

# Fix all fetch calls with Authorization headers
find src -type f -name "*.ts" -o -name "*.tsx" | while read -r file; do
  # Remove Authorization headers from fetch calls and add credentials: 'include'
  perl -i -0pe "s/fetch\([^)]+\)[\s\n]*{[\s\n]*method:[\s\n]*'(POST|PUT|GET|DELETE|PATCH)'[\s\n]*,[\s\n]*headers:[\s\n]*{[\s\n]*'Authorization':[\s\n]*\`Bearer[^}]+}[\s\n]*,[\s\n]*body:/fetch(\$1, {\n      method: '\$2',\n      body:/gs" "$file"
  
  # Add credentials: 'include' to all fetch calls if not present
  perl -i -pe "s/(fetch\([^)]+,\s*{)(?![^}]*credentials:)/$1\n      credentials: 'include', \/\/ Send cookies for Better Auth session\n      /g" "$file"
done

# Specifically fix upload.service.ts
cat > /tmp/fix-upload.js << 'EOF'
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/services/upload.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Remove all Authorization headers
content = content.replace(/headers:\s*{\s*['"]Authorization['"]:.*?\n\s*},?/gs, '');
content = content.replace(/['"]Authorization['"]:\s*`Bearer.*?`,?\n/g, '');
content = content.replace(/xhr\.setRequestHeader\(['"]Authorization['"],\s*`Bearer.*?\);/g, '');

// Add credentials: 'include' to all fetch calls
content = content.replace(/fetch\((.*?),\s*{([^}]+)}/gs, (match, url, options) => {
  if (!options.includes('credentials:')) {
    // Add credentials: 'include' if not present
    return `fetch(${url}, {${options},
      credentials: 'include' // Send cookies for Better Auth session
    }`;
  }
  return match;
});

// Fix XMLHttpRequest to use withCredentials
content = content.replace(/(xhr\.open\(['"]POST['"],.*?\);)/g, '$1\n      xhr.withCredentials = true; // Send cookies for Better Auth session');

// Remove any remaining token references for Authorization
content = content.replace(/const token = localStorage\.getItem\(['"]authToken['"]\);\s*if \(token\) {\s*xhr\.setRequestHeader\(['"]Authorization['"], `Bearer.*?\);\s*}/gs, '// Better Auth uses cookies, not Authorization headers');

fs.writeFileSync(filePath, content);
console.log('✅ Fixed upload.service.ts');
EOF

node /tmp/fix-upload.js

# Fix enhanced-upload.service.ts
cat > /tmp/fix-enhanced.js << 'EOF'
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/services/enhanced-upload.service.ts');
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove all Authorization headers
  content = content.replace(/['"]Authorization['"]:\s*`Bearer.*?`,?\n/g, '');
  content = content.replace(/headers:\s*{[^}]*['"]Authorization['"]:.*?}/gs, (match) => {
    // Remove Authorization but keep other headers
    const cleaned = match.replace(/['"]Authorization['"]:\s*`Bearer.*?`,?\s*/g, '');
    if (cleaned.match(/headers:\s*{\s*}/)) {
      return '';
    }
    return cleaned;
  });
  
  // Add credentials: 'include' to fetch calls
  content = content.replace(/fetch\((.*?),\s*{([^}]+)}/gs, (match, url, options) => {
    if (!options.includes('credentials:')) {
      return `fetch(${url}, {${options},
      credentials: 'include' // Send cookies for Better Auth session
    }`;
    }
    return match;
  });
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed enhanced-upload.service.ts');
}
EOF

node /tmp/fix-enhanced.js

# Fix all other services that might be using Authorization headers
for service in src/services/*.service.ts; do
  if [[ -f "$service" ]]; then
    # Use Node.js for more complex replacements
    cat > /tmp/fix-service.js << EOF
const fs = require('fs');
const content = fs.readFileSync('$service', 'utf8');
let fixed = content;

// Remove Authorization headers but keep other headers
fixed = fixed.replace(/['"]Authorization['"]:\s*\\\`Bearer.*?\\\`,?\s*/g, '');

// Add credentials: 'include' to fetch calls if not present
fixed = fixed.replace(/fetch\((.*?),\s*{([^}]+)}/gs, (match, url, options) => {
  if (!options.includes('credentials:') && !options.includes('// Local file')) {
    const hasHeaders = options.includes('headers:');
    const insertion = hasHeaders ? 
      options.replace(/(headers:\s*{[^}]*})/, '\$1,\n      credentials: "include"') :
      options + ',\n      credentials: "include" // Send cookies for Better Auth session';
    return \`fetch(\${url}, {\${insertion}}\`;
  }
  return match;
});

if (fixed !== content) {
  fs.writeFileSync('$service', fixed);
  console.log('✅ Fixed: $service');
}
EOF
    node /tmp/fix-service.js
  fi
done

echo "✅ All Better Auth header fixes applied!"
echo "📝 Authorization headers removed, using cookie-based sessions instead"