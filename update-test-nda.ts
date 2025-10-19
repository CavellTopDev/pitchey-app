#!/usr/bin/env -S deno run --allow-all

// Update test NDA to have correct status
import { db } from './src/db/client.ts';
import { ndas } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function updateTestNDA() {
  try {
    console.log("🔧 Updating test NDA status to 'signed'...\n");

    const updatedNDA = await db.update(ndas)
      .set({ status: 'signed' })
      .where(eq(ndas.id, 1))
      .returning();

    if (updatedNDA.length > 0) {
      console.log("✅ Test NDA updated:", updatedNDA[0]);
    } else {
      console.log("❌ No NDA found with ID 1");
    }
  } catch (error) {
    console.error("❌ Error updating test NDA:", error.message);
  }
}

if (import.meta.main) {
  updateTestNDA();
}