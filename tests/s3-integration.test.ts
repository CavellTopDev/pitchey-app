/**
 * S3 Integration Tests
 * Run with: deno test --allow-all tests/s3-integration.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.220.0/testing/asserts.ts";
import { UploadService } from "../src/services/upload.service.ts";

// Mock environment variables for testing
const setupTestEnv = () => {
  // Set to local mode for testing without AWS credentials
  Deno.env.set("STORAGE_PROVIDER", "local");
  Deno.env.set("USE_LOCAL_FALLBACK", "true");
};

Deno.test({
  name: "Upload Service - Local Storage",
  async fn() {
    setupTestEnv();
    
    const testFile = new File(
      [new TextEncoder().encode("Test content")],
      "test.txt",
      { type: "text/plain" }
    );
    
    const result = await UploadService.uploadFile(testFile, "test");
    
    assertExists(result.url);
    assertEquals(result.provider, "local");
    assertEquals(result.url.startsWith("/static/uploads/"), true);
    
    // Clean up
    if (result.url.startsWith("/static/uploads/")) {
      await Deno.remove(`.${result.url}`).catch(() => {});
    }
  },
});

Deno.test({
  name: "Upload Service - Image Validation",
  fn() {
    const validImage = new File(
      [new Uint8Array(1024)],
      "test.jpg",
      { type: "image/jpeg" }
    );
    
    const invalidImage = new File(
      [new Uint8Array(20 * 1024 * 1024)], // 20MB
      "large.jpg",
      { type: "image/jpeg" }
    );
    
    assertEquals(UploadService.validateImageFile(validImage), true);
    assertEquals(UploadService.validateImageFile(invalidImage), false);
  },
});

Deno.test({
  name: "Upload Service - Document Validation",
  fn() {
    const validPDF = new File(
      [new Uint8Array(1024)],
      "document.pdf",
      { type: "application/pdf" }
    );
    
    const validWord = new File(
      [new Uint8Array(1024)],
      "document.docx",
      { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
    );
    
    const invalidType = new File(
      [new Uint8Array(1024)],
      "script.sh",
      { type: "application/x-sh" }
    );
    
    assertEquals(UploadService.validateDocumentFile(validPDF), true);
    assertEquals(UploadService.validateDocumentFile(validWord), true);
    assertEquals(UploadService.validateDocumentFile(invalidType), false);
  },
});

Deno.test({
  name: "Upload Service - Video Validation",
  fn() {
    const validMP4 = new File(
      [new Uint8Array(1024)],
      "video.mp4",
      { type: "video/mp4" }
    );
    
    const oversizedVideo = new File(
      [new Uint8Array(600 * 1024 * 1024)], // 600MB
      "large.mp4",
      { type: "video/mp4" }
    );
    
    assertEquals(UploadService.validateVideoFile(validMP4), true);
    assertEquals(UploadService.validateVideoFile(oversizedVideo), false);
  },
});

Deno.test({
  name: "Upload Service - File Signature Validation",
  async fn() {
    // JPEG signature
    const jpegSignature = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    const jpegValid = await UploadService.validateFileSignature(
      jpegSignature.buffer,
      "image/jpeg"
    );
    assertEquals(jpegValid, true);
    
    // PNG signature
    const pngSignature = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    ]);
    const pngValid = await UploadService.validateFileSignature(
      pngSignature.buffer,
      "image/png"
    );
    assertEquals(pngValid, true);
    
    // Invalid signature
    const invalidSignature = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const invalidValid = await UploadService.validateFileSignature(
      invalidSignature.buffer,
      "image/jpeg"
    );
    assertEquals(invalidValid, false);
  },
});

Deno.test({
  name: "Upload Service - Multiple Files",
  async fn() {
    setupTestEnv();
    
    const files = [
      new File([new TextEncoder().encode("Content 1")], "file1.txt", { type: "text/plain" }),
      new File([new TextEncoder().encode("Content 2")], "file2.txt", { type: "text/plain" }),
      new File([new TextEncoder().encode("Content 3")], "file3.txt", { type: "text/plain" }),
    ];
    
    const results = await Promise.all(
      files.map(file => UploadService.uploadFile(file, "test-batch"))
    );
    
    assertEquals(results.length, 3);
    results.forEach(result => {
      assertExists(result.url);
      assertEquals(result.provider, "local");
    });
    
    // Clean up
    for (const result of results) {
      if (result.url.startsWith("/static/uploads/")) {
        await Deno.remove(`.${result.url}`).catch(() => {});
      }
    }
  },
});

// S3-specific tests (only run if AWS credentials are configured)
if (Deno.env.get("AWS_ACCESS_KEY_ID") && Deno.env.get("AWS_SECRET_ACCESS_KEY")) {
  Deno.test({
    name: "Upload Service - S3 Presigned URL Generation",
    async fn() {
      const { uploadUrl, key } = await UploadService.getPresignedUploadUrl(
        "test/presigned-test.pdf",
        "application/pdf",
        { testMetadata: "value" }
      );
      
      assertExists(uploadUrl);
      assertExists(key);
      assertEquals(uploadUrl.includes("X-Amz-Signature"), true);
      assertEquals(key, "test/presigned-test.pdf");
    },
  });
  
  Deno.test({
    name: "Upload Service - S3 File Existence Check",
    async fn() {
      const exists = await UploadService.fileExists("non-existent-file.txt");
      assertEquals(exists, false);
    },
  });
  
  Deno.test({
    name: "Upload Service - S3 Upload with Metadata",
    sanitizeOps: false,
    sanitizeResources: false,
    async fn() {
      Deno.env.set("STORAGE_PROVIDER", "s3");
      
      const testFile = new File(
        [new TextEncoder().encode("S3 test content")],
        "s3-test.txt",
        { type: "text/plain" }
      );
      
      const result = await UploadService.uploadFile(testFile, "test", {
        metadata: {
          uploadedBy: "test-suite",
          purpose: "integration-test",
        },
        encrypt: true,
      });
      
      assertExists(result.url);
      assertEquals(result.provider, "s3");
      assertEquals(result.url.includes(".amazonaws.com/"), true);
      if (result.cdnUrl) {
        assertEquals(result.cdnUrl.includes("cdn.pitchey.com"), true);
      }
      
      // Clean up - delete from S3
      await UploadService.deleteFile(result.url);
    },
  });
  
  Deno.test({
    name: "Upload Service - S3 Large File Multipart Upload",
    ignore: true, // Ignore by default as it's slow
    async fn() {
      Deno.env.set("STORAGE_PROVIDER", "s3");
      
      // Create a 150MB file
      const largeContent = new Uint8Array(150 * 1024 * 1024);
      const largeFile = new File(
        [largeContent],
        "large-test.bin",
        { type: "application/octet-stream" }
      );
      
      const result = await UploadService.uploadFile(largeFile, "test-large");
      
      assertExists(result.url);
      assertEquals(result.provider, "s3");
      
      // Clean up
      await UploadService.deleteFile(result.url);
    },
  });
}

// Performance test
Deno.test({
  name: "Upload Service - Performance Test",
  ignore: true, // Ignore by default
  async fn() {
    setupTestEnv();
    
    const iterations = 100;
    const start = performance.now();
    
    const promises = [];
    for (let i = 0; i < iterations; i++) {
      const file = new File(
        [new TextEncoder().encode(`Performance test ${i}`)],
        `perf-test-${i}.txt`,
        { type: "text/plain" }
      );
      promises.push(UploadService.uploadFile(file, "performance"));
    }
    
    const results = await Promise.all(promises);
    const end = performance.now();
    
    console.log(`Uploaded ${iterations} files in ${(end - start).toFixed(2)}ms`);
    console.log(`Average: ${((end - start) / iterations).toFixed(2)}ms per file`);
    
    // Clean up
    for (const result of results) {
      if (result.url.startsWith("/static/uploads/")) {
        await Deno.remove(`.${result.url}`).catch(() => {});
      }
    }
  },
});