#!/usr/bin/env node
/**
 * Script to fix all SQL queries in worker-service-optimized.ts
 * Wraps them with withDatabase() for proper connection pooling
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/worker-service-optimized.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Track replacements for reporting
let replacementCount = 0;
const replacements = [];

/**
 * Fix simple SQL queries (single line or simple multiline)
 */
function fixSimpleQueries(content) {
  // Pattern 1: const/let variable = await sql`...`;
  const pattern1 = /(const|let)\s+(\w+)\s*=\s*await\s+sql(`[^`]*`);/g;
  content = content.replace(pattern1, (match, varType, varName, sqlQuery) => {
    if (!match.includes('withDatabase')) {
      replacementCount++;
      replacements.push(`Fixed: ${varType} ${varName} = await sql...`);
      return `${varType} ${varName} = await withDatabase(env, async (sql) => await sql${sqlQuery}, sentry);`;
    }
    return match;
  });
  
  // Pattern 2: Direct await sql`...`; without assignment
  const pattern2 = /(\s+)await\s+sql(`[^`]*`);/g;
  content = content.replace(pattern2, (match, indent, sqlQuery) => {
    if (!match.includes('withDatabase')) {
      replacementCount++;
      replacements.push(`Fixed: await sql...`);
      return `${indent}await withDatabase(env, async (sql) => await sql${sqlQuery}, sentry);`;
    }
    return match;
  });
  
  return content;
}

/**
 * Fix multiline SQL queries that span multiple lines
 */
function fixMultilineQueries(content) {
  const lines = content.split('\n');
  const result = [];
  let inSqlQuery = false;
  let sqlStartIndex = -1;
  let sqlBuffer = [];
  let indentLevel = '';
  let varDeclaration = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect start of SQL query
    if (!inSqlQuery && line.includes('await sql`') && !line.includes('withDatabase')) {
      inSqlQuery = true;
      sqlStartIndex = i;
      sqlBuffer = [line];
      
      // Extract indentation
      indentLevel = line.match(/^(\s*)/)[1];
      
      // Check if it's a variable assignment
      if (line.includes('=')) {
        const parts = line.split('=');
        varDeclaration = parts[0].trim();
        
        // Start the withDatabase wrapper
        result.push(`${indentLevel}${varDeclaration} = await withDatabase(env, async (sql) => await sql\``);
      } else {
        // Direct await without assignment
        const leadingPart = line.split('await sql`')[0];
        result.push(`${leadingPart}await withDatabase(env, async (sql) => await sql\``);
      }
      
      // Check if query ends on same line
      if (line.includes('`;')) {
        inSqlQuery = false;
        const sqlContent = line.split('`')[1];
        result[result.length - 1] = result[result.length - 1].replace('sql`', `sql\`${sqlContent}\``) + ', sentry);';
        replacementCount++;
        replacements.push(`Fixed multiline query at line ${i + 1}`);
      }
      continue;
    }
    
    // Handle middle of SQL query
    if (inSqlQuery) {
      if (line.includes('`;')) {
        // End of SQL query
        inSqlQuery = false;
        result.push(line.replace('`;', '`, sentry);'));
        replacementCount++;
        replacements.push(`Fixed multiline query from line ${sqlStartIndex + 1} to ${i + 1}`);
      } else {
        // Continue SQL query
        result.push(line);
      }
      continue;
    }
    
    // Normal line - no changes needed
    result.push(line);
  }
  
  return result.join('\n');
}

/**
 * Fix special cases where SQL is used in different patterns
 */
function fixSpecialCases(content) {
  // Fix sql.unsafe patterns (shouldn't exist after our sed replacement, but just in case)
  content = content.replace(/sql\.unsafe\(/g, 'sql(');
  
  // Fix patterns like: return sql`...`
  const returnPattern = /(\s+)return\s+sql(`[^`]*`);/g;
  content = content.replace(returnPattern, (match, indent, sqlQuery) => {
    if (!match.includes('withDatabase')) {
      replacementCount++;
      replacements.push(`Fixed: return sql...`);
      return `${indent}return withDatabase(env, async (sql) => await sql${sqlQuery}, sentry);`;
    }
    return match;
  });
  
  return content;
}

console.log('🔧 Starting comprehensive SQL query fix...\n');

// Apply fixes
console.log('📝 Applying simple query fixes...');
content = fixSimpleQueries(content);

console.log('📝 Applying multiline query fixes...');
content = fixMultilineQueries(content);

console.log('📝 Applying special case fixes...');
content = fixSpecialCases(content);

// Write the fixed content back
fs.writeFileSync(filePath, content);

// Report results
console.log('\n✅ SQL Query Fix Complete!');
console.log(`📊 Total replacements: ${replacementCount}`);

if (replacements.length > 0) {
  console.log('\n🔍 Sample of fixes applied:');
  replacements.slice(0, 10).forEach(r => console.log(`  - ${r}`));
  if (replacements.length > 10) {
    console.log(`  ... and ${replacements.length - 10} more`);
  }
}

// Verify no direct sql queries remain
const remainingDirectQueries = (content.match(/await sql`/g) || [])
  .filter(match => !content.includes('withDatabase'));

if (remainingDirectQueries.length > 0) {
  console.log(`\n⚠️  Warning: ${remainingDirectQueries.length} direct SQL queries may still remain.`);
  console.log('   These may need manual review.');
} else {
  console.log('\n✅ All SQL queries are now using the connection pool!');
}

console.log('\n📌 Next steps:');
console.log('1. Review the changes: git diff src/worker-service-optimized.ts');
console.log('2. Test locally: npm run dev');
console.log('3. Deploy: wrangler deploy');