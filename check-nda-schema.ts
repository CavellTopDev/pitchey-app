#!/usr/bin/env -S deno run --allow-all

import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function checkSchema() {
  const client = new Client(DATABASE_URL);
  
  try {
    await client.connect();

    console.log('\n📋 NDA REQUESTS TABLE SCHEMA:');
    const schema = await client.queryObject(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'nda_requests' ORDER BY ordinal_position"
    );
    schema.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));

    console.log('\n📋 SIGNED NDAS TABLE SCHEMA:');
    const schema2 = await client.queryObject(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'signed_ndas' ORDER BY ordinal_position"
    );
    schema2.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));

    console.log('\n📋 CURRENT NDA REQUEST DATA:');
    const currentData = await client.queryObject(
      "SELECT * FROM nda_requests WHERE pitch_id = 226 LIMIT 1"
    );
    console.log(currentData.rows[0] || 'No data found');

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  await checkSchema();
}
