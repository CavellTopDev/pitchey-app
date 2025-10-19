import { getStorageProvider, validateStorageConfig } from "./storage/index.ts";
import type { UploadResult, UploadOptions } from "./storage/index.ts";

export class UploadService {
  private static storageProvider = getStorageProvider();

  /**
   * Upload file using the configured storage provider
   */
  static async uploadFile(
    file: File, 
    folder: string, 
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    console.log(`Upload Service: Using ${this.storageProvider.getProviderType()} storage provider`);
    return await this.storageProvider.uploadFile(file, folder, options);
  }

  /**
   * Delete file using the configured storage provider
   */
  static async deleteFile(urlOrKey: string): Promise<void> {
    console.log(`Upload Service: Deleting file: ${urlOrKey}`);
    return await this.storageProvider.deleteFile(urlOrKey);
  }

  /**
   * Check if file exists using the configured storage provider
   */
  static async fileExists(key: string): Promise<boolean> {
    return await this.storageProvider.fileExists(key);
  }

  /**
   * Generate presigned upload URL (S3 only)
   */
  static async getPresignedUploadUrl(
    key: string,
    contentType: string,
    metadata: Record<string, string> = {},
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; key: string }> {
    if (this.storageProvider.getPresignedUploadUrl) {
      return await this.storageProvider.getPresignedUploadUrl(key, contentType, metadata, expiresIn);
    }
    throw new Error("Presigned upload URLs are not supported by the current storage provider");
  }

  /**
   * Generate presigned download URL (S3 only)
   */
  static async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    if (this.storageProvider.getPresignedDownloadUrl) {
      return await this.storageProvider.getPresignedDownloadUrl(key, expiresIn);
    }
    throw new Error("Presigned download URLs are not supported by the current storage provider");
  }
  /**
   * Get storage provider information
   */
  static getStorageInfo() {
    return {
      provider: this.storageProvider.getProviderType(),
      ...validateStorageConfig()
    };
  }
  /**
   * Validate image file
   */
  static validateImageFile(file: File): boolean {
    return this.storageProvider.validateFile(file, "image");
  }
  
  /**
   * Validate document file
   */
  static validateDocumentFile(file: File): boolean {
    return this.storageProvider.validateFile(file, "document");
  }

  /**
   * Validate video file
   */
  static validateVideoFile(file: File): boolean {
    return this.storageProvider.validateFile(file, "video");
  }

  /**
   * Validate file signature (magic numbers)
   */
  static async validateFileSignature(buffer: ArrayBuffer, expectedType: string): Promise<boolean> {
    const bytes = new Uint8Array(buffer.slice(0, 12));
    
    const signatures: Record<string, number[][]> = {
      'image/jpeg': [[0xFF, 0xD8, 0xFF]],
      'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
      'image/gif': [[0x47, 0x49, 0x46, 0x38]],
      'image/webp': [[0x52, 0x49, 0x46, 0x46], [0x57, 0x45, 0x42, 0x50]],
      'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
      'video/mp4': [[0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]],
    };
    
    const expectedSignatures = signatures[expectedType];
    if (!expectedSignatures) return true; // Allow unknown types
    
    return expectedSignatures.some(sig => 
      sig.every((byte, index) => bytes[index] === byte)
    );
  }

  /**
   * Generate unique key for file
   */
  static generateKey(folder: string, fileName: string): string {
    return this.storageProvider.generateKey(folder, fileName);
  }
}