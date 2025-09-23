import { migrate } from "npm:drizzle-orm/postgres-js/migrator";
import { db, migrationClient } from "./client.ts";

console.log("Running migrations...");

await migrate(db, { migrationsFolder: "./drizzle" });

await migrationClient.end();

console.log("Migrations completed!");