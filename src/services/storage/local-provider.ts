import type { StorageProvider, UploadResult, UploadOptions } from "./interface.ts";

/**
 * Local filesystem storage provider for development
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir = "./uploads";
  private readonly publicPath = "/uploads";
  
  // File size limits (in bytes)
  private readonly MAX_FILE_SIZE = parseInt(Deno.env.get("MAX_FILE_SIZE_MB") || "50") * 1024 * 1024;
  private readonly MAX_IMAGE_SIZE = parseInt(Deno.env.get("MAX_IMAGE_SIZE_MB") || "10") * 1024 * 1024;
  private readonly MAX_VIDEO_SIZE = parseInt(Deno.env.get("MAX_VIDEO_SIZE_MB") || "500") * 1024 * 1024;

  /**
   * Upload file to local filesystem
   */
  async uploadFile(
    file: File,
    folder: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Validate file size
    if (!this.validateFile(file, this.getFileType(file.type))) {
      const maxSize = this.getMaxSize(file.type);
      throw new Error(`File size exceeds limit (${Math.round(maxSize / 1024 / 1024)}MB)`);
    }

    // Generate unique key
    const key = this.generateKey(folder, file.name);
    const localPath = `${this.baseDir}/${key}`;
    const dir = `${this.baseDir}/${folder}`;

    // Create directory if it doesn't exist
    await Deno.mkdir(dir, { recursive: true });

    // Read and process file
    let buffer = await file.arrayBuffer();
    
    // Apply watermark if requested (placeholder implementation)
    if (options.applyWatermark) {
      buffer = await this.applyWatermark(buffer, file.type);
    }

    // Write file to local filesystem
    await Deno.writeFile(localPath, new Uint8Array(buffer));

    // Store metadata if provided
    if (options.metadata && Object.keys(options.metadata).length > 0) {
      const metadataPath = `${localPath}.meta.json`;
      await Deno.writeTextFile(metadataPath, JSON.stringify({
        ...options.metadata,
        contentType: file.type,
        size: file.size,
        uploadDate: new Date().toISOString(),
        accessLevel: options.accessLevel || "public"
      }));
    }

    return {
      url: `${this.publicPath}/${key}`,
      key,
      provider: "local"
    };
  }

  /**
   * Delete file from local filesystem
   */
  async deleteFile(urlOrKey: string): Promise<void> {
    let key: string;
    
    // Extract key from URL or use directly
    if (urlOrKey.startsWith(this.publicPath)) {
      key = urlOrKey.replace(`${this.publicPath}/`, "");
    } else if (urlOrKey.startsWith("/uploads/")) {
      key = urlOrKey.replace("/uploads/", "");
    } else {
      key = urlOrKey;
    }

    const localPath = `${this.baseDir}/${key}`;
    const metadataPath = `${localPath}.meta.json`;

    try {
      // Remove main file
      await Deno.remove(localPath);
      console.log(`Local storage: Successfully deleted file: ${localPath}`);
    } catch (error) {
      console.warn(`Local storage: Failed to delete file ${localPath}:`, error);
      throw new Error(`Failed to delete file: ${key}`);
    }

    try {
      // Remove metadata file if it exists
      await Deno.remove(metadataPath);
    } catch {
      // Metadata file might not exist, ignore error
    }
  }

  /**
   * Check if file exists in local filesystem
   */
  async fileExists(key: string): Promise<boolean> {
    const localPath = `${this.baseDir}/${key}`;
    
    try {
      const stat = await Deno.stat(localPath);
      return stat.isFile;
    } catch {
      return false;
    }
  }

  /**
   * Get provider type
   */
  getProviderType(): "local" {
    return "local";
  }

  /**
   * Validate file based on type and size constraints
   */
  validateFile(file: File, type: "image" | "document" | "video"): boolean {
    const maxSize = this.getMaxSize(file.type);
    const allowedTypes = this.getAllowedTypes(type);
    
    return allowedTypes.includes(file.type) && file.size <= maxSize;
  }

  /**
   * Generate unique file key
   */
  generateKey(folder: string, fileName: string): string {
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const ext = fileName.split('.').pop() || '';
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    return `${folder}/${timestamp}-${uuid}-${safeName}`;
  }

  /**
   * Get file metadata (local storage specific)
   */
  async getFileMetadata(key: string): Promise<Record<string, any> | null> {
    const metadataPath = `${this.baseDir}/${key}.meta.json`;
    
    try {
      const content = await Deno.readTextFile(metadataPath);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * List files in a folder (local storage specific)
   */
  async listFiles(folder: string): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    const folderPath = `${this.baseDir}/${folder}`;
    const files: Array<{ key: string; size: number; lastModified: Date }> = [];
    
    try {
      for await (const dirEntry of Deno.readDir(folderPath)) {
        if (dirEntry.isFile && !dirEntry.name.endsWith('.meta.json')) {
          const filePath = `${folderPath}/${dirEntry.name}`;
          const stat = await Deno.stat(filePath);
          
          files.push({
            key: `${folder}/${dirEntry.name}`,
            size: stat.size,
            lastModified: stat.mtime || new Date()
          });
        }
      }
    } catch {
      // Folder doesn't exist or other error
    }
    
    return files;
  }

  /**
   * Get file size and stats
   */
  async getFileStats(key: string): Promise<{ size: number; lastModified: Date } | null> {
    const localPath = `${this.baseDir}/${key}`;
    
    try {
      const stat = await Deno.stat(localPath);
      return {
        size: stat.size,
        lastModified: stat.mtime || new Date()
      };
    } catch {
      return null;
    }
  }

  private getFileType(mimeType: string): "image" | "document" | "video" {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    return "document";
  }

  private getMaxSize(mimeType: string): number {
    if (mimeType.startsWith("video/")) return this.MAX_VIDEO_SIZE;
    if (mimeType.startsWith("image/")) return this.MAX_IMAGE_SIZE;
    return this.MAX_FILE_SIZE;
  }

  private getAllowedTypes(type: "image" | "document" | "video"): string[] {
    switch (type) {
      case "image":
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      case "video":
        return ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
      case "document":
        return [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain'
        ];
    }
  }

  private async applyWatermark(
    buffer: ArrayBuffer,
    mimeType: string
  ): Promise<ArrayBuffer> {
    // Placeholder watermark implementation
    // In a real implementation, this would use image processing libraries
    console.log(`Local storage: Would apply watermark to ${mimeType} file`);
    return buffer;
  }
}