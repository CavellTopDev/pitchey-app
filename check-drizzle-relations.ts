#!/usr/bin/env -S deno run --allow-read

// Script to identify all Drizzle ORM relation usages that might fail in production

const searchPatterns = [
  /db\.query\.\w+\.findFirst\([^)]*with:/gm,
  /db\.query\.\w+\.findMany\([^)]*with:/gm,
];

const criticalServices = [
  "src/services/ndaService.ts",
  "src/services/analytics.service.ts",
  "src/services/investment.service.ts",
  "src/services/production.service.ts",
  "src/services/userService.ts",
  "src/services/message.service.ts",
  "src/services/notification.service.ts",
  "src/services/pitch.service.ts",
];

async function findRelationsInFile(filePath: string) {
  try {
    const content = await Deno.readTextFile(filePath);
    const matches: Array<{line: number, code: string}> = [];
    
    // Split into lines for line number tracking
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check if line contains relation patterns
      if (line.includes('db.query.') && line.includes('.find')) {
        // Look ahead for 'with:' in next few lines
        let contextEnd = Math.min(index + 10, lines.length);
        let context = lines.slice(index, contextEnd).join('\n');
        
        if (context.includes('with:')) {
          matches.push({
            line: index + 1,
            code: line.trim()
          });
        }
      }
    });
    
    return matches;
  } catch (error) {
    return [];
  }
}

console.log("Checking for Drizzle ORM relations that may fail in production...\n");

for (const service of criticalServices) {
  const matches = await findRelationsInFile(service);
  
  if (matches.length > 0) {
    console.log(`\n📁 ${service}:`);
    console.log(`   Found ${matches.length} relation queries:`);
    matches.forEach(match => {
      console.log(`   Line ${match.line}: ${match.code.substring(0, 60)}...`);
    });
  }
}

console.log("\n✅ Analysis complete!");
console.log("\nThese queries use Drizzle relations (with:) that may fail in production.");
console.log("They should be replaced with simple joins for production compatibility.");