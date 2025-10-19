export interface UploadResult {
  url: string;
  key: string;
  cdnUrl?: string;
  provider: "s3" | "local";
}

export interface UploadOptions {
  applyWatermark?: boolean;
  encrypt?: boolean;
  publicRead?: boolean;
  metadata?: Record<string, string>;
  accessLevel?: "public" | "basic" | "enhanced" | "nda";
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
}

export interface StorageProvider {
  /**
   * Upload a file to storage
   */
  uploadFile(
    file: File,
    folder: string,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Delete a file from storage
   */
  deleteFile(urlOrKey: string): Promise<void>;

  /**
   * Check if a file exists
   */
  fileExists(key: string): Promise<boolean>;

  /**
   * Generate presigned URL for upload (S3 only)
   */
  getPresignedUploadUrl?(
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
    expiresIn?: number
  ): Promise<PresignedUploadResult>;

  /**
   * Generate presigned URL for download (S3 only)
   */
  getPresignedDownloadUrl?(
    key: string,
    expiresIn?: number
  ): Promise<string>;

  /**
   * Get the provider type
   */
  getProviderType(): "s3" | "local";

  /**
   * Validate file constraints
   */
  validateFile(file: File, type: "image" | "document" | "video"): boolean;

  /**
   * Generate unique file key
   */
  generateKey(folder: string, fileName: string): string;
}