import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema-node.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/pitchey",
  },
  verbose: true,
  strict: true,
});