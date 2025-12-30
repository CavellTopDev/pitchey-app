const fs = require('fs');
const path = require('path');

// Fix apiServices.ts
const apiServicesPath = path.join(process.cwd(), 'src/lib/apiServices.ts');
console.log('Fixing apiServices.ts...');

let content = fs.readFileSync(apiServicesPath, 'utf8');

// Fix each broken fetch call specifically
const fixes = [
  {
    // getCreatorProfile
    pattern: /export const getCreatorProfile[^}]+?const response = await \s*\n\s*credentials:[^}]+?\}\);/gs,
    replacement: `export const getCreatorProfile = async (creatorId: string) => {
  try {
    const response = await fetch(\`\${API_URL}/api/creators/\${creatorId}\`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });`
  },
  {
    // updateCreatorProfile  
    pattern: /export const updateCreatorProfile[^}]+?const response = await \s*\n\s*credentials:[^}]+?\}\);/gs,
    replacement: `export const updateCreatorProfile = async (creatorId: string, data: any) => {
  try {
    const response = await fetch(\`\${API_URL}/api/creators/\${creatorId}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include' // Send cookies for Better Auth session
    });`
  },
  {
    // getInvestorProfile
    pattern: /export const getInvestorProfile[^}]+?const response = await \s*\n\s*credentials:[^}]+?\}\);/gs,
    replacement: `export const getInvestorProfile = async () => {
  try {
    const response = await fetch(\`\${API_URL}/api/investor/profile\`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });`
  },
  {
    // updateInvestorProfile
    pattern: /export const updateInvestorProfile[^}]+?const response = await \s*\n\s*credentials:[^}]+?\}\);/gs,
    replacement: `export const updateInvestorProfile = async (data: any) => {
  try {
    const response = await fetch(\`\${API_URL}/api/investor/profile\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include' // Send cookies for Better Auth session
    });`
  },
  {
    // getProductionProfile
    pattern: /export const getProductionProfile[^}]+?const response = await \s*\n\s*credentials:[^}]+?\}\);/gs,
    replacement: `export const getProductionProfile = async () => {
  try {
    const response = await fetch(\`\${API_URL}/api/production/profile\`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });`
  },
  {
    // updateProductionProfile
    pattern: /export const updateProductionProfile[^}]+?const response = await \s*\n\s*credentials:[^}]+?\}\);/gs,
    replacement: `export const updateProductionProfile = async (data: any) => {
  try {
    const response = await fetch(\`\${API_URL}/api/production/profile\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include' // Send cookies for Better Auth session
    });`
  },
  {
    // createProject
    pattern: /export const createProject[^}]+?const response = await \s*\n\s*credentials:[^}]+?\}\);/gs,
    replacement: `export const createProject = async (projectData: any) => {
  try {
    const response = await fetch(\`\${API_URL}/api/projects\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
      credentials: 'include' // Send cookies for Better Auth session
    });`
  },
  {
    // updateProject
    pattern: /export const updateProject[^}]+?const response = await \s*\n\s*credentials:[^}]+?\}\);/gs,
    replacement: `export const updateProject = async (projectId: string, projectData: any) => {
  try {
    const response = await fetch(\`\${API_URL}/api/projects/\${projectId}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
      credentials: 'include' // Send cookies for Better Auth session
    });`
  }
];

// Apply all fixes
fixes.forEach(fix => {
  if (content.match(fix.pattern)) {
    content = content.replace(fix.pattern, fix.replacement);
    console.log('✅ Fixed function:', fix.replacement.match(/export const (\w+)/)?.[1]);
  }
});

fs.writeFileSync(apiServicesPath, content);
console.log('✅ Fixed apiServices.ts');

// Fix better-auth-client.tsx
const betterAuthPath = path.join(process.cwd(), 'src/lib/better-auth-client.tsx');
if (fs.existsSync(betterAuthPath)) {
  console.log('Fixing better-auth-client.tsx...');
  let content = fs.readFileSync(betterAuthPath, 'utf8');
  
  // Fix broken fetch calls
  content = content.replace(
    /const response = await \s*\n\s*credentials: 'include'[^}]*?\}\);/g,
    `const response = await fetch(\`\${config.API_URL}/api/auth/session\`, {
        method: 'GET',
        credentials: 'include' // Send cookies for Better Auth session
      });`
  );
  
  fs.writeFileSync(betterAuthPath, content);
  console.log('✅ Fixed better-auth-client.tsx');
}

console.log('✅ All critical files fixed!');