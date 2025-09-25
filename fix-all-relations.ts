#!/usr/bin/env -S deno run --allow-read --allow-write

// Script to fix all Drizzle ORM relations to use simple joins instead

const fixes = [
  {
    file: "src/services/ndaService.ts",
    description: "Fix remaining NDA service relations",
    replacements: [
      {
        old: `  static async getRequestsForOwner(ownerId: number) {
    try {
      return await db.query.ndaRequests.findMany({
        where: eq(ndaRequests.ownerId, ownerId),
        orderBy: [desc(ndaRequests.requestedAt)],
        with: {
          pitch: {
            columns: {
              id: true,
              title: true,
            },
          },
          requester: {
            columns: {
              id: true,
              username: true,
              email: true,
              companyName: true,
              userType: true,
            },
          },
        },
      });
    } catch (error) {
      console.log("NDA requests table not available or error:", error);
      // Return empty array as fallback
      return [];
    }
  }`,
        new: `  static async getRequestsForOwner(ownerId: number) {
    try {
      const requests = await db
        .select({
          request: ndaRequests,
          pitch: {
            id: pitches.id,
            title: pitches.title,
          },
          requester: {
            id: users.id,
            username: users.username,
            email: users.email,
            companyName: users.companyName,
            userType: users.userType,
          },
        })
        .from(ndaRequests)
        .leftJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .leftJoin(users, eq(ndaRequests.requesterId, users.id))
        .where(eq(ndaRequests.ownerId, ownerId))
        .orderBy(desc(ndaRequests.requestedAt));
      
      // Transform to match expected format
      return requests.map(r => ({
        ...r.request,
        pitch: r.pitch,
        requester: r.requester,
      }));
    } catch (error) {
      console.log("NDA requests table not available or error:", error);
      // Return empty array as fallback
      return [];
    }
  }`
      }
    ]
  }
];

console.log("🔧 Starting to fix Drizzle ORM relations...\n");

for (const fix of fixes) {
  console.log(`📁 Processing ${fix.file}...`);
  console.log(`   ${fix.description}`);
  
  try {
    let content = await Deno.readTextFile(fix.file);
    
    for (const replacement of fix.replacements) {
      if (content.includes(replacement.old)) {
        content = content.replace(replacement.old, replacement.new);
        console.log(`   ✅ Fixed relation query`);
      } else {
        console.log(`   ⚠️  Pattern not found (may have been already fixed)`);
      }
    }
    
    await Deno.writeTextFile(fix.file, content);
    console.log(`   ✅ File saved\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
}

console.log("✅ All fixes completed!");