/**
 * Storage Service - Facade for file storage operations
 * Provides a unified interface for handling file uploads, validation, and storage
 * Works with both local and S3 storage providers
 */

import { UploadService } from "./upload.service.ts";
import type { UploadResult, UploadOptions } from "./storage/interface.ts";

export interface FileValidationConfig {
  maxImageSizeMB: number;
  maxDocumentSizeMB: number;
  maxVideoSizeMB: number;
  allowedImageTypes: string[];
  allowedDocumentTypes: string[];
  allowedVideoTypes: string[];
}

export interface UploadConfig {
  folder: string;
  applyWatermark?: boolean;
  encrypt?: boolean;
  publicRead?: boolean;
  metadata?: Record<string, string>;
  accessLevel?: "public" | "basic" | "enhanced" | "nda";
}

export interface FileMetadata {
  originalName: string;
  size: number;
  type: string;
  category: 'image' | 'document' | 'video';
  uploadedAt: string;
  uploadedBy: string;
  userType?: string;
}

export interface StorageUploadResult extends UploadResult {
  originalName: string;
  uniqueName: string;
  size: number;
  type: string;
  category: string;
  uploadedAt: string;
  uploadedBy: string;
}

/**
 * Storage Service - Main interface for file storage operations
 */
export class StorageService {
  private static readonly defaultConfig: FileValidationConfig = {
    maxImageSizeMB: 5,
    maxDocumentSizeMB: 10,
    maxVideoSizeMB: 100,
    allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    allowedDocumentTypes: ['application/pdf'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/mov', 'video/x-msvideo']
  };

  /**
   * Upload a file with comprehensive validation and metadata handling
   */
  static async uploadFile(
    file: File,
    uploadConfig: UploadConfig,
    userId: string,
    userType?: string
  ): Promise<StorageUploadResult> {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Generate unique filename to prevent collisions
    const uniqueFileName = this.generateUniqueFileName(file.name);

    // Prepare metadata
    const metadata: Record<string, string> = {
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
      originalName: file.name,
      fileCategory: validation.category,
      userType: userType || 'user',
      ...uploadConfig.metadata
    };

    // Upload using the existing upload service
    const uploadResult = await UploadService.uploadFile(file, uploadConfig.folder, {
      applyWatermark: uploadConfig.applyWatermark,
      encrypt: uploadConfig.encrypt,
      publicRead: uploadConfig.publicRead !== false, // Default to true
      metadata,
      accessLevel: uploadConfig.accessLevel
    });

    // Return enhanced result with additional metadata
    return {
      ...uploadResult,
      originalName: file.name,
      uniqueName: uniqueFileName,
      size: file.size,
      type: file.type,
      category: validation.category,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId
    };
  }

  /**
   * Delete a file
   */
  static async deleteFile(urlOrKey: string): Promise<void> {
    return await UploadService.deleteFile(urlOrKey);
  }

  /**
   * Check if a file exists
   */
  static async fileExists(key: string): Promise<boolean> {
    return await UploadService.fileExists(key);
  }

  /**
   * Get storage provider information
   */
  static getStorageInfo() {
    return UploadService.getStorageInfo();
  }

  /**
   * Validate file type, size, and content
   */
  static validateFile(file: File): { isValid: boolean; error?: string; category?: 'image' | 'document' | 'video' } {
    const config = this.defaultConfig;

    // Determine file category and validate type
    let category: 'image' | 'document' | 'video';
    let maxSizeMB: number;
    let allowedTypes: string[];

    if (file.type.startsWith('image/')) {
      category = 'image';
      maxSizeMB = config.maxImageSizeMB;
      allowedTypes = config.allowedImageTypes;
    } else if (file.type === 'application/pdf') {
      category = 'document';
      maxSizeMB = config.maxDocumentSizeMB;
      allowedTypes = config.allowedDocumentTypes;
    } else if (file.type.startsWith('video/')) {
      category = 'video';
      maxSizeMB = config.maxVideoSizeMB;
      allowedTypes = config.allowedVideoTypes;
    } else {
      return {
        isValid: false,
        error: "Unsupported file type. Only images (JPG, PNG, GIF), PDFs, and videos (MP4, MOV) are allowed."
      };
    }

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `Invalid ${category} file type. Allowed types: ${allowedTypes.join(', ')}`
      };
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        isValid: false,
        error: `File size exceeds limit. Maximum size for ${category} files is ${maxSizeMB}MB`
      };
    }

    // Additional validation for zero-size files
    if (file.size === 0) {
      return {
        isValid: false,
        error: "File is empty or corrupted"
      };
    }

    return { isValid: true, category };
  }

  /**
   * Validate file signature for security
   */
  static async validateFileSignature(file: File): Promise<boolean> {
    const buffer = await file.arrayBuffer();
    return await UploadService.validateFileSignature(buffer, file.type);
  }

  /**
   * Generate unique filename to prevent collisions
   */
  static generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const fileExtension = originalName.split('.').pop() || '';
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    return `${timestamp}-${uuid}-${safeName}`;
  }

  /**
   * Generate unique storage key for a file
   */
  static generateStorageKey(folder: string, fileName: string): string {
    return UploadService.generateKey(folder, fileName);
  }

  /**
   * Get file validation configuration
   */
  static getValidationConfig(): FileValidationConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Update file validation configuration (for testing or dynamic configuration)
   */
  static updateValidationConfig(config: Partial<FileValidationConfig>): void {
    Object.assign(this.defaultConfig, config);
  }

  /**
   * Get presigned upload URL (S3 only)
   */
  static async getPresignedUploadUrl(
    key: string,
    contentType: string,
    metadata: Record<string, string> = {},
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; key: string }> {
    return await UploadService.getPresignedUploadUrl(key, contentType, metadata, expiresIn);
  }

  /**
   * Get presigned download URL (S3 only)
   */
  static async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    return await UploadService.getPresignedDownloadUrl(key, expiresIn);
  }

  /**
   * Helper method to get maximum allowed file size for a given file type
   */
  static getMaxFileSizeForType(mimeType: string): number {
    const config = this.defaultConfig;
    
    if (mimeType.startsWith('image/')) {
      return config.maxImageSizeMB * 1024 * 1024;
    } else if (mimeType === 'application/pdf') {
      return config.maxDocumentSizeMB * 1024 * 1024;
    } else if (mimeType.startsWith('video/')) {
      return config.maxVideoSizeMB * 1024 * 1024;
    }
    
    return 0; // Unsupported type
  }

  /**
   * Helper method to check if a file type is supported
   */
  static isSupportedFileType(mimeType: string): boolean {
    const config = this.defaultConfig;
    return [
      ...config.allowedImageTypes,
      ...config.allowedDocumentTypes,
      ...config.allowedVideoTypes
    ].includes(mimeType);
  }
}

export default StorageService;