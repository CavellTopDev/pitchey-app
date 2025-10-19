#!/usr/bin/env -S deno run --allow-all

// Test script to check database table existence
import { db } from './src/db/client.ts';

async function checkTables() {
  try {
    console.log("🔍 Checking database table existence...\n");

    // Check if info_requests table exists
    try {
      const infoRequestsResult = await db.execute(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = 'info_requests';
      `);
      console.log("✅ info_requests table check:", infoRequestsResult);
    } catch (error) {
      console.log("❌ Error checking info_requests table:", error.message);
    }

    // Check if info_request_attachments table exists
    try {
      const attachmentsResult = await db.execute(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = 'info_request_attachments';
      `);
      console.log("✅ info_request_attachments table check:", attachmentsResult);
    } catch (error) {
      console.log("❌ Error checking info_request_attachments table:", error.message);
    }

    // Check table structure
    try {
      const tableStructure = await db.execute(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'info_requests'
        ORDER BY ordinal_position;
      `);
      console.log("📋 info_requests table structure:", tableStructure);
    } catch (error) {
      console.log("❌ Error checking info_requests structure:", error.message);
    }

    // Try a simple select to see if table is accessible
    try {
      const simpleSelect = await db.execute(`SELECT 1 as test FROM info_requests LIMIT 1;`);
      console.log("✅ info_requests table is accessible");
    } catch (error) {
      console.log("❌ Error accessing info_requests table:", error.message);
    }

  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
}

if (import.meta.main) {
  checkTables();
}