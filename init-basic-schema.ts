#!/usr/bin/env -S deno run --allow-net --allow-env

// Simple script to initialize basic schema and seed data
import { db } from "./src/db/client.ts";

console.log("🔄 Initializing basic database schema...");

try {
  // Create users first
  await db.execute(`
    INSERT INTO users (email, username, password_hash, user_type, first_name, last_name, company_name)
    VALUES 
      ('alice@example.com', 'alice', '$2b$10$hash', 'creator', 'Alice', 'Anderson', NULL),
      ('bob@example.com', 'bob', '$2b$10$hash', 'investor', 'Bob', 'Brown', 'Brown Investments'),
      ('charlie@example.com', 'charlie', '$2b$10$hash', 'production', 'Charlie', 'Chen', 'Chen Productions')
    ON CONFLICT (email) DO NOTHING
  `);

  console.log("✅ Demo users created");

  // Create demo pitches
  await db.execute(`
    INSERT INTO pitches (user_id, title, logline, genre, format, status, published_at)
    VALUES 
      (1, 'The Last Signal', 'A sci-fi thriller about humanity''s final message', 'scifi', 'feature', 'published', NOW()),
      (1, 'Coffee Shop Chronicles', 'A comedy series set in a quirky neighborhood coffee shop', 'comedy', 'tv', 'published', NOW()),
      (1, 'Digital Ghosts', 'A horror story about AI consciousness', 'horror', 'feature', 'published', NOW())
    ON CONFLICT DO NOTHING
  `);

  console.log("✅ Demo pitches created");

  console.log("🎉 Basic schema initialized successfully!");

} catch (error) {
  console.error("❌ Error during initialization:", error);
  
  // If tables don't exist, provide helpful message
  if (error.message.includes('relation') && error.message.includes('does not exist')) {
    console.log("\n📋 It looks like the basic tables don't exist yet.");
    console.log("The database needs the base migration to run first.");
    console.log("This is expected for a fresh database setup.");
  }
}