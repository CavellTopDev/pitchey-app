#!/usr/bin/env -S deno run --allow-all

/**
 * Migration script to move local files to AWS S3
 * Run with: deno run --allow-all scripts/migrate-to-s3.ts
 */

import { walk } from "https://deno.land/std@0.220.0/fs/walk.ts";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { CloudFrontClient, CreateInvalidationCommand } from "npm:@aws-sdk/client-cloudfront@3";
import { db } from "../src/db/client.ts";
import { pitches, users, ndas } from "../src/db/schema.ts";
import { eq, like } from "drizzle-orm";

// Configuration
const DRY_RUN = Deno.args.includes("--dry-run");
const BATCH_SIZE = parseInt(Deno.env.get("MIGRATION_BATCH_SIZE") || "10");
const LOCAL_PATH = "./static/uploads";
const BACKUP_PATH = "./static/uploads.backup";

// S3 Configuration
const s3Client = new S3Client({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
});

const cfClient = Deno.env.get("CLOUDFRONT_DISTRIBUTION_ID") ? new CloudFrontClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
}) : null;

const BUCKET = Deno.env.get("AWS_S3_BUCKET")!;
const CDN_URL = Deno.env.get("CLOUDFRONT_URL") || "";
const DISTRIBUTION_ID = Deno.env.get("CLOUDFRONT_DISTRIBUTION_ID") || "";

// Migration tracking
interface MigrationResult {
  success: boolean;
  localPath: string;
  s3Key?: string;
  cdnUrl?: string;
  error?: string;
}

const results: MigrationResult[] = [];

/**
 * Scan local files that need migration
 */
async function scanLocalFiles(): Promise<string[]> {
  const files: string[] = [];
  
  try {
    for await (const entry of walk(LOCAL_PATH)) {
      if (entry.isFile) {
        files.push(entry.path);
      }
    }
  } catch (error) {
    console.error("Error scanning local files:", error);
  }
  
  return files;
}

/**
 * Upload file to S3
 */
async function uploadToS3(localPath: string): Promise<{ key: string; cdnUrl: string }> {
  // Extract relative path from local path
  const relativePath = localPath.replace(LOCAL_PATH + "/", "");
  const s3Key = relativePath;
  
  // Read file
  const fileContent = await Deno.readFile(localPath);
  const stat = await Deno.stat(localPath);
  
  // Determine content type
  const ext = localPath.split(".").pop()?.toLowerCase();
  const contentType = getContentType(ext || "");
  
  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType,
    Metadata: {
      originalPath: localPath,
      migratedAt: new Date().toISOString(),
      fileSize: stat.size.toString(),
    },
  });
  
  await s3Client.send(command);
  
  const cdnUrl = CDN_URL ? `${CDN_URL}/${s3Key}` : `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;
  
  return { key: s3Key, cdnUrl };
}

/**
 * Get content type from file extension
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    // Images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    
    // Videos
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    webm: "video/webm",
    
    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    
    // Text
    txt: "text/plain",
    csv: "text/csv",
    
    // Default
    default: "application/octet-stream",
  };
  
  return types[ext] || types.default;
}

/**
 * Update database references
 */
async function updateDatabaseReferences(
  oldPath: string,
  newUrl: string,
  s3Key: string
): Promise<void> {
  // Convert local path to URL format
  const oldUrl = oldPath.replace("./static", "/static");
  
  // Update pitches table
  const pitchColumns = [
    "lookbookUrl",
    "scriptUrl",
    "trailerUrl",
    "pitchDeckUrl",
    "budgetBreakdownUrl",
    "productionTimelineUrl",
  ];
  
  for (const column of pitchColumns) {
    await db.update(pitches)
      .set({ [column]: newUrl })
      .where(eq(pitches[column as keyof typeof pitches], oldUrl));
  }
  
  // Update users table (avatars, covers)
  await db.update(users)
    .set({ avatarUrl: newUrl })
    .where(eq(users.avatarUrl, oldUrl));
    
  await db.update(users)
    .set({ coverUrl: newUrl })
    .where(eq(users.coverUrl, oldUrl));
  
  // Update NDAs table
  await db.update(ndas)
    .set({ signedDocumentUrl: newUrl })
    .where(eq(ndas.signedDocumentUrl, oldUrl));
  
  // Update additionalMedia JSON fields in pitches
  const pitchesWithMedia = await db.select()
    .from(pitches)
    .where(like(pitches.additionalMedia, `%${oldUrl}%`));
  
  for (const pitch of pitchesWithMedia) {
    if (pitch.additionalMedia && Array.isArray(pitch.additionalMedia)) {
      const updatedMedia = pitch.additionalMedia.map((media: any) => {
        if (media.url === oldUrl) {
          return { ...media, url: newUrl, s3Key };
        }
        return media;
      });
      
      await db.update(pitches)
        .set({ additionalMedia: updatedMedia })
        .where(eq(pitches.id, pitch.id));
    }
  }
}

/**
 * Invalidate CloudFront cache for migrated files
 */
async function invalidateCache(paths: string[]): Promise<void> {
  if (!cfClient || !DISTRIBUTION_ID || paths.length === 0) return;
  
  try {
    const command = new CreateInvalidationCommand({
      DistributionId: DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: Date.now().toString(),
        Paths: {
          Quantity: paths.length,
          Items: paths.map(p => `/${p}`),
        },
      },
    });
    
    await cfClient.send(command);
    console.log(`Invalidated CloudFront cache for ${paths.length} paths`);
  } catch (error) {
    console.error("CloudFront invalidation failed:", error);
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log("=".repeat(60));
  console.log("AWS S3 Migration Script");
  console.log("=".repeat(60));
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`S3 Bucket: ${BUCKET}`);
  console.log(`CDN URL: ${CDN_URL || "Not configured"}`);
  console.log("=".repeat(60));
  
  // Check configuration
  if (!BUCKET) {
    console.error("ERROR: AWS_S3_BUCKET not configured");
    Deno.exit(1);
  }
  
  if (!Deno.env.get("AWS_ACCESS_KEY_ID") || !Deno.env.get("AWS_SECRET_ACCESS_KEY")) {
    console.error("ERROR: AWS credentials not configured");
    Deno.exit(1);
  }
  
  // Scan files
  console.log("\nScanning local files...");
  const files = await scanLocalFiles();
  console.log(`Found ${files.length} files to migrate\n`);
  
  if (files.length === 0) {
    console.log("No files to migrate!");
    return;
  }
  
  // Process in batches
  const totalBatches = Math.ceil(files.length / BATCH_SIZE);
  const pathsToInvalidate: string[] = [];
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    console.log(`\nProcessing batch ${batchNum}/${totalBatches}...`);
    
    await Promise.all(
      batch.map(async (filePath) => {
        const result: MigrationResult = {
          success: false,
          localPath: filePath,
        };
        
        try {
          if (DRY_RUN) {
            console.log(`  [DRY RUN] Would migrate: ${filePath}`);
            result.success = true;
          } else {
            // Upload to S3
            const { key, cdnUrl } = await uploadToS3(filePath);
            result.s3Key = key;
            result.cdnUrl = cdnUrl;
            
            // Update database
            await updateDatabaseReferences(filePath, cdnUrl, key);
            
            pathsToInvalidate.push(key);
            
            console.log(`  ✓ Migrated: ${filePath} → ${cdnUrl}`);
            result.success = true;
          }
        } catch (error) {
          console.error(`  ✗ Failed: ${filePath} - ${error.message}`);
          result.error = error.message;
        }
        
        results.push(result);
      })
    );
    
    // Invalidate CloudFront cache for this batch
    if (!DRY_RUN && pathsToInvalidate.length > 0) {
      await invalidateCache(pathsToInvalidate.splice(0, pathsToInvalidate.length));
    }
    
    // Progress update
    const progress = Math.min((i + BATCH_SIZE) / files.length * 100, 100);
    console.log(`Progress: ${progress.toFixed(1)}%`);
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Migration Summary");
  console.log("=".repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Total Files: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log("\nFailed Files:");
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  - ${r.localPath}: ${r.error}`));
  }
  
  // Save migration report
  if (!DRY_RUN && results.length > 0) {
    const reportPath = `./migration-report-${Date.now()}.json`;
    await Deno.writeTextFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nMigration report saved to: ${reportPath}`);
  }
  
  // Backup instructions
  if (!DRY_RUN && successful > 0) {
    console.log("\n" + "=".repeat(60));
    console.log("Next Steps:");
    console.log("=".repeat(60));
    console.log("1. Test the migrated files by accessing them via CDN URLs");
    console.log("2. Monitor application for any issues");
    console.log("3. Once verified, backup local files:");
    console.log(`   mv ${LOCAL_PATH} ${BACKUP_PATH}`);
    console.log("4. After 30 days, if no issues, delete backup:");
    console.log(`   rm -rf ${BACKUP_PATH}`);
  }
}

/**
 * Rollback function (in case of issues)
 */
async function rollback() {
  console.log("=".repeat(60));
  console.log("S3 Migration Rollback");
  console.log("=".repeat(60));
  
  const reportPath = Deno.args.find(arg => arg.endsWith(".json"));
  if (!reportPath) {
    console.error("Please provide a migration report JSON file");
    Deno.exit(1);
  }
  
  const report = JSON.parse(await Deno.readTextFile(reportPath));
  
  console.log(`Rolling back ${report.length} files...`);
  
  for (const item of report) {
    if (item.success && item.cdnUrl) {
      // Restore database references
      const oldUrl = item.localPath.replace("./static", "/static");
      await updateDatabaseReferences(item.cdnUrl, oldUrl, "");
      console.log(`  ✓ Restored: ${item.cdnUrl} → ${oldUrl}`);
    }
  }
  
  console.log("\nRollback complete!");
  console.log("Note: S3 files have not been deleted. Delete manually if needed.");
}

// Main execution
if (import.meta.main) {
  const command = Deno.args[0];
  
  if (command === "rollback") {
    await rollback();
  } else {
    await migrate();
  }
  
  Deno.exit(0);
}