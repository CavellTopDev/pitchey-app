import { db } from "./src/db/client.ts";
import { ndaRequests } from "./src/db/schema.ts";

const ndas = await db.select().from(ndaRequests).limit(10);
console.log("Recent NDA requests:");
ndas.forEach(nda => {
  console.log(`ID: ${nda.id}, Pitch: ${nda.pitchId}, Requester: ${nda.requesterId}, Status: ${nda.status}`);
});

Deno.exit(0);
