const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? (isDev ? 'http://localhost:8001' : '');

// Export UploadProgress interface
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number;
  estimatedTimeRemaining?: number;
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  type: string;
  id?: string;
  uploadedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface UploadOptions {
  onProgress?: (_progress: UploadProgress) => void;
  signal?: AbortSignal;
  timeout?: number;
  retryCount?: number;
  metadata?: Record<string, unknown>;
  chunkSize?: number;
  priority?: 'low' | 'normal' | 'high';
}

// Response types for API calls
interface MultipleUploadResponse {
  success: boolean;
  error?: string;
  data?: {
    uploads?: Array<{
      success: boolean;
      result?: UploadResult;
      error?: string;
    }>;
  };
}

interface MediaBatchResponse {
  results?: UploadResult[];
  errors?: Array<{ error: string }>;
}

interface DocumentDeleteResponse {
  success?: boolean;
  error?: string;
}

interface PresignedUrlResponse {
  success: boolean;
  error?: string;
  data?: {
    uploadUrl: string;
    key: string;
    expiresAt: string;
    fields?: Record<string, string>;
    url?: string;
  };
}

interface StorageQuotaApiResponse {
  success: boolean;
  error?: string;
  data?: {
    currentUsage: number;
    maxQuota: number;
    remainingQuota: number;
    usagePercentage: number;
    formattedUsage: string;
    formattedQuota: string;
    formattedRemaining: string;
  };
}

interface UploadInfoResponse {
  maxFileSize: number;
  allowedTypes: string[];
  maxFiles: number;
  totalStorage: number;
  usedStorage: number;
  remainingStorage: number;
  uploadLimits: {
    hourly: number;
    daily: number;
    monthly: number;
  };
  currentUsage: {
    hourly: number;
    daily: number;
    monthly: number;
  };
  features: {
    concurrentUploads: boolean;
    chunkUpload: boolean;
    deduplication: boolean;
    previewGeneration: boolean;
  };
  provider?: string;
}

interface UploadAnalyticsResponse {
  totalUploads: number;
  totalSize: number;
  averageFileSize: number;
  successRate: number;
  popularTypes: Array<{ type: string; count: number }>;
  uploadTrends: Array<{ date: string; count: number; size: number }>;
}

interface FileCheckApiResponse {
  exists: boolean;
  url?: string;
}

class UploadService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Upload a single document file using the new API
   */
  async uploadDocument(
    file: File,
    documentType: string = 'document',
    options: UploadOptions & {
      pitchId?: number;
      isPublic?: boolean;
      requiresNda?: boolean;
      folder?: string;
    } = {}
  ): Promise<UploadResult> {
    const { pitchId, isPublic, requiresNda, folder, ...uploadOptions } = options;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    formData.append('folder', folder ?? 'uploads');

    if (pitchId !== undefined) {
      formData.append('pitchId', pitchId.toString());
    }
    if (isPublic !== undefined) {
      formData.append('isPublic', isPublic.toString());
    }
    if (requiresNda !== undefined) {
      formData.append('requiresNda', requiresNda.toString());
    }
    
    // For NDA uploads, use the specific NDA endpoint
    if (documentType === 'nda' || folder === 'nda-documents') {
      // Add metadata for NDA uploads
      if (uploadOptions.metadata) {
        formData.append('metadata', JSON.stringify(uploadOptions.metadata));
      }
      return this.uploadFile('/api/upload/nda', formData, uploadOptions);
    }

    return this.uploadFile('/api/upload', formData, uploadOptions);
  }

  /**
   * Upload multiple documents with enhanced features using new API
   */
  async uploadMultipleDocumentsEnhanced(
    files: Array<{
      file: File;
      documentType: string;
      title: string;
      description?: string;
    }>,
    options: UploadOptions & {
      pitchId?: number;
      isPublic?: boolean;
      requiresNda?: boolean;
      folder?: string;
    } = {}
  ): Promise<{ results: UploadResult[]; errors: Array<{ error: string }> }> {
    const { pitchId, isPublic, requiresNda, folder, ...uploadOptions } = options;

    const formData = new FormData();

    // Add all files
    files.forEach((fileData) => {
      formData.append('files', fileData.file);
    });

    // Add metadata
    formData.append('documentType', files[0]?.documentType ?? 'supporting');
    formData.append('folder', folder ?? 'uploads');

    if (pitchId !== undefined) {
      formData.append('pitchId', pitchId.toString());
    }
    if (isPublic !== undefined) {
      formData.append('isPublic', isPublic.toString());
    }
    if (requiresNda !== undefined) {
      formData.append('requiresNda', requiresNda.toString());
    }

    const response = await fetch(`${this.baseUrl}/api/upload/multiple`, {
      method: 'POST',
      body: formData,
      signal: uploadOptions.signal,
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json() as MultipleUploadResponse;
    if (result.success !== true) {
      throw new Error(result.error ?? 'Upload failed');
    }

    const uploads = result.data?.uploads ?? [];
    return {
      results: uploads.filter(u => u.success).map(u => u.result).filter((r): r is UploadResult => r !== undefined),
      errors: uploads.filter(u => !u.success).map(u => ({ error: u.error ?? 'Unknown error' }))
    };
  }

  /**
   * Upload multiple media files with enhanced features
   */
  async uploadMultipleMediaEnhanced(
    files: Array<{
      file: File;
      title: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }>,
    options: UploadOptions = {}
  ): Promise<{ results: UploadResult[]; errors: Array<{ error: string }> }> {
    const formData = new FormData();

    files.forEach((fileData) => {
      formData.append('files', fileData.file);
      formData.append('titles', fileData.title);
      formData.append('descriptions', fileData.description ?? '');
      formData.append('metadata', JSON.stringify(fileData.metadata ?? {}));
    });

    const response = await fetch(`${this.baseUrl}/api/upload/media-batch`, {
      method: 'POST',
      body: formData,
      signal: options.signal,
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json() as MediaBatchResponse;
    return {
      results: result.results ?? [],
      errors: result.errors ?? []
    };
  }

  /**
   * Upload media files for a specific pitch
   */
  async uploadPitchMedia(
    pitchId: number,
    file: File, 
    mediaType: 'image' | 'video' | 'document',
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', mediaType);

    return this.uploadFile(`/api/creator/pitches/${pitchId}/media`, formData, options);
  }

  /**
   * Upload multiple files with enhanced progress tracking (legacy method)
   */
  async uploadMultipleDocuments(
    files: File[],
    documentTypes: string[] = [],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    // Use the new enhanced method for better performance
    const fileData = files.map((file, index) => ({
      file,
      documentType: documentTypes[index] ?? 'document',
      title: file.name.replace(/\.[^/.]+$/, "")
    }));
    
    const result = await this.uploadMultipleDocumentsEnhanced(fileData, options);
    
    if (result.errors.length > 0) {
      console.warn('Some uploads failed:', result.errors);
    }
    
    return result.results;
  }

  /**
   * Upload multiple files with concurrency control
   */
  async uploadMultipleDocumentsConcurrent(
    files: File[],
    documentTypes: string[] = [],
    options: UploadOptions & { maxConcurrent?: number } = {}
  ): Promise<UploadResult[]> {
    const { maxConcurrent = 3, ...uploadOptions } = options;
    const results: UploadResult[] = [];
    const queue = [...files];
    const active = new Set<Promise<UploadResult>>();

    while (queue.length > 0 || active.size > 0) {
      // Start new uploads up to the concurrency limit
      while (queue.length > 0 && active.size < maxConcurrent) {
        const file = queue.shift()!;
        const index = files.indexOf(file);
        const type = documentTypes[index] ?? 'document';
        
        const uploadPromise = this.uploadDocument(file, type, uploadOptions)
          .then(result => {
            results[index] = result;
            return result;
          })
          .finally(() => {
            active.delete(uploadPromise);
          });
        
        active.add(uploadPromise);
      }

      // Wait for at least one upload to complete
      if (active.size > 0) {
        await Promise.race(active);
      }
    }

    return results;
  }

  /**
   * Core upload method with enhanced progress tracking and retry logic
   */
  private uploadFile(
    endpoint: string, 
    formData: FormData, 
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      onProgress, 
      signal, 
      timeout = 300000, 
      retryCount = 0,
      metadata
    } = options;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      // Enhanced progress tracking with speed calculation
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000; // seconds
            const loadedDiff = event.loaded - lastLoaded;
            
            let speed = 0;
            let estimatedTimeRemaining = 0;
            
            if (timeDiff > 0.5 && loadedDiff > 0) { // Update every 500ms
              speed = loadedDiff / timeDiff; // bytes per second
              const remainingBytes = event.total - event.loaded;
              estimatedTimeRemaining = remainingBytes / speed; // seconds
              
              lastLoaded = event.loaded;
              lastTime = now;
            }
            
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
              speed: speed > 0 ? speed : undefined,
              estimatedTimeRemaining: estimatedTimeRemaining > 0 ? estimatedTimeRemaining : undefined
            };
            
            onProgress(progress);
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText) as UploadResult;
            resolve({
              ...response,
              uploadedAt: new Date().toISOString(),
              metadata
            });
          } catch {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText) as { message?: string };
            const errorMessage = errorResponse.message ?? `Upload failed: ${xhr.status}`;
            
            // Retry logic for certain error conditions
            if (retryCount > 0 && (xhr.status >= 500 || xhr.status === 429)) {
              setTimeout(() => {
                this.uploadFile(endpoint, formData, {
                  ...options,
                  retryCount: retryCount - 1
                }).then(resolve).catch(reject);
              }, Math.pow(2, 3 - retryCount) * 1000); // Exponential backoff
            } else {
              reject(new Error(errorMessage));
            }
          } catch {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        }
      });

      // Handle errors with retry logic
      xhr.addEventListener('error', () => {
        if (retryCount > 0) {
          setTimeout(() => {
            this.uploadFile(endpoint, formData, {
              ...options,
              retryCount: retryCount - 1
            }).then(resolve).catch(reject);
          }, Math.pow(2, 3 - retryCount) * 1000);
        } else {
          reject(new Error('Upload failed: Network error'));
        }
      });

      xhr.addEventListener('timeout', () => {
        if (retryCount > 0) {
          setTimeout(() => {
            this.uploadFile(endpoint, formData, {
              ...options,
              retryCount: retryCount - 1
            }).then(resolve).catch(reject);
          }, Math.pow(2, 3 - retryCount) * 1000);
        } else {
          reject(new Error('Upload failed: Request timeout'));
        }
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
        });
      }

      // Configure request
      xhr.open('POST', `${this.baseUrl}${endpoint}`);
      xhr.withCredentials = true; // Send cookies for Better Auth session
      xhr.timeout = timeout;

      // Better Auth uses cookies, not Authorization headers
      // Authentication is handled via withCredentials = true

      // Add metadata to formData instead of headers to avoid CORS issues
      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          formData.append(`metadata_${key}`, String(value));
        });
      }

      // Start upload
      xhr.send(formData);
    });
  }

  /**
   * Validate file before upload
   */
  validateFile(
    file: File, 
    options: {
      maxSize?: number; // in bytes
      allowedTypes?: string[];
      allowedExtensions?: string[];
    } = {}
  ): { valid: boolean; error?: string } {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo'
      ],
      allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.avi']
    } = options;

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size ${fileSizeMB}MB exceeds the ${maxSizeMB}MB limit`
      };
    }

    // Check MIME type
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not supported`
      };
    }

    // Check file extension as backup
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.some(ext => ext.toLowerCase() === fileExtension)) {
      return {
        valid: false,
        error: `File extension ${fileExtension} is not supported`
      };
    }

    return { valid: true };
  }

  /**
   * Get file URL for preview/download
   */
  getFileUrl(filename: string): string {
    return `${this.baseUrl}/api/files/${filename}`;
  }

  /**
   * Delete uploaded document by ID
   */
  async deleteDocument(documentId: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/documents/${documentId}`, {
      method: 'DELETE',
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as DocumentDeleteResponse | null;
      throw new Error(errorData?.error ?? 'Failed to delete document');
    }
  }

  /**
   * Delete uploaded file (legacy method)
   */
  async deleteFile(filename: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/${filename}`, {
      method: 'DELETE',
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error !== '' ? error : 'Failed to delete file');
    }
  }

  /**
   * Get presigned download URL for a document
   */
  async getDocumentDownloadUrl(documentId: number, expiresIn?: number): Promise<string> {
    const url = `${this.baseUrl}/api/documents/${documentId}/url`;
    const queryParams = expiresIn !== undefined ? `?expires=${expiresIn}` : '';

    const response = await fetch(`${url}${queryParams}`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as PresignedUrlResponse | null;
      throw new Error(errorData?.error ?? 'Failed to get download URL');
    }

    const result = await response.json() as PresignedUrlResponse;
    if (result.success !== true) {
      throw new Error(result.error ?? 'Failed to get download URL');
    }

    return result.data?.url ?? '';
  }

  /**
   * Get presigned upload URL for direct upload
   */
  async getPresignedUploadUrl(
    fileName: string,
    contentType: string,
    options: {
      folder?: string;
      fileSize?: number;
    } = {}
  ): Promise<{
    uploadUrl: string;
    key: string;
    expiresAt: string;
    fields?: Record<string, string>;
  }> {
    const response = await fetch(`${this.baseUrl}/api/upload/presigned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName,
        contentType,
        folder: options.folder ?? 'uploads',
        fileSize: options.fileSize
      }),
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as PresignedUrlResponse | null;
      throw new Error(errorData?.error ?? 'Failed to get presigned URL');
    }

    const result = await response.json() as PresignedUrlResponse;
    if (result.success !== true) {
      throw new Error(result.error ?? 'Failed to get presigned URL');
    }

    if (result.data === undefined) {
      throw new Error('Invalid response from server');
    }

    return result.data;
  }

  /**
   * Get user storage quota information
   */
  async getStorageQuota(): Promise<{
    currentUsage: number;
    maxQuota: number;
    remainingQuota: number;
    usagePercentage: number;
    formattedUsage: string;
    formattedQuota: string;
    formattedRemaining: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/storage/quota`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as StorageQuotaApiResponse | null;
      throw new Error(errorData?.error ?? 'Failed to get storage quota');
    }

    const result = await response.json() as StorageQuotaApiResponse;
    if (result.success !== true) {
      throw new Error(result.error ?? 'Failed to get storage quota');
    }

    if (result.data === undefined) {
      throw new Error('Invalid response from server');
    }

    return result.data;
  }

  /**
   * Upload file using presigned URL (direct to storage)
   */
  async uploadFileDirectly(
    file: File,
    presignedData: {
      uploadUrl: string;
      fields?: Record<string, string>;
    },
    onProgress?: (_progress: UploadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      // Progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000;
            const loadedDiff = event.loaded - lastLoaded;
            
            let speed = 0;
            let estimatedTimeRemaining = 0;
            
            if (timeDiff > 0.5 && loadedDiff > 0) {
              speed = loadedDiff / timeDiff;
              const remainingBytes = event.total - event.loaded;
              estimatedTimeRemaining = remainingBytes / speed;
              
              lastLoaded = event.loaded;
              lastTime = now;
            }
            
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
              speed: speed > 0 ? speed : undefined,
              estimatedTimeRemaining: estimatedTimeRemaining > 0 ? estimatedTimeRemaining : undefined
            };
            
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed: Network error'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload failed: Request timeout'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Prepare form data for direct upload
      const formData = new FormData();
      
      // Add any required fields
      if (presignedData.fields) {
        Object.entries(presignedData.fields).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }
      
      // Add the file last
      formData.append('file', file);

      xhr.open('PUT', presignedData.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file); // For R2, send file directly
    });
  }

  /**
   * Get enhanced upload status/info
   */
  async getUploadInfo(): Promise<{
    maxFileSize: number;
    allowedTypes: string[];
    maxFiles: number;
    totalStorage: number;
    usedStorage: number;
    remainingStorage: number;
    uploadLimits: {
      hourly: number;
      daily: number;
      monthly: number;
    };
    currentUsage: {
      hourly: number;
      daily: number;
      monthly: number;
    };
    features: {
      concurrentUploads: boolean;
      chunkUpload: boolean;
      deduplication: boolean;
      previewGeneration: boolean;
    };
    provider?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/upload/info`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      throw new Error('Failed to get upload info');
    }

    return response.json() as Promise<UploadInfoResponse>;
  }

  /**
   * Get upload analytics
   */
  async getUploadAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<UploadAnalyticsResponse> {
    const response = await fetch(`${this.baseUrl}/api/upload/analytics?timeframe=${timeframe}`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      throw new Error('Failed to get upload analytics');
    }

    return response.json() as Promise<UploadAnalyticsResponse>;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate unique filename to prevent conflicts
   */
  generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop();
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    return `${nameWithoutExt}_${timestamp}_${random}.${extension}`;
  }

  /**
   * Calculate file hash for deduplication
   */
  async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if file already exists (by hash)
   */
  async checkFileExists(hash: string): Promise<{ exists: boolean; url?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/files/check/${hash}`, {
        method: 'GET',
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (response.ok) {
        return await response.json() as FileCheckApiResponse;
      }

      return { exists: false };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Upload with deduplication check
   */
  async uploadWithDeduplication(
    file: File,
    documentType: string = 'document',
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      // Calculate file hash
      const hash = await this.calculateFileHash(file);
      
      // Check if file already exists
      const existingFile = await this.checkFileExists(hash);
      
      if (existingFile.exists && existingFile.url !== undefined && existingFile.url !== '') {
        // File already exists, return existing URL
        return {
          url: existingFile.url,
          filename: file.name,
          size: file.size,
          type: documentType,
          id: hash,
          uploadedAt: new Date().toISOString(),
          metadata: { ...options.metadata, deduplicated: true }
        };
      }
      
      // File doesn't exist, upload normally
      return this.uploadDocument(file, documentType, {
        ...options,
        metadata: { ...options.metadata, hash }
      });
    } catch (error) {
      // If deduplication fails, fall back to normal upload
      console.warn('Deduplication check failed, proceeding with normal upload:', error);
      return this.uploadDocument(file, documentType, options);
    }
  }

  /**
   * Pause/Resume upload (for future chunked upload implementation)
   */
  pauseUpload(_uploadId: string): void {
    void _uploadId;
    // Implementation for pausing uploads
    // This would work with chunked uploads
  }

  resumeUpload(_uploadId: string): void {
    void _uploadId;
    // Implementation for resuming uploads
    // This would work with chunked uploads
  }

  /**
   * Upload files with comprehensive progress tracking for UI components
   */
  async uploadFilesWithProgress(
    files: Array<{
      file: File;
      type: 'document' | 'media';
      documentType?: string;
      title: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }>,
    _onFileProgress?: (_fileIndex: number, _progress: UploadProgress) => void,
    onFileComplete?: (_fileIndex: number, _result: UploadResult) => void,
    onFileError?: (_fileIndex: number, _error: string) => void
  ): Promise<{ results: UploadResult[]; errors: Array<{ index: number; error: string }> }> {
    const results: UploadResult[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    // Separate files by type
    const documentFiles = files
      .map((f, index) => ({ ...f, originalIndex: index }))
      .filter(f => f.type === 'document');
    const mediaFiles = files
      .map((f, index) => ({ ...f, originalIndex: index }))
      .filter(f => f.type === 'media');

    // Upload documents
    if (documentFiles.length > 0) {
      try {
        const docData = documentFiles.map(f => ({
          file: f.file,
          documentType: f.documentType ?? 'document',
          title: f.title,
          description: f.description
        }));

        const docResult = await this.uploadMultipleDocumentsEnhanced(docData);

        docResult.results.forEach((result, index) => {
          const originalIndex = documentFiles[index].originalIndex;
          results[originalIndex] = result;
          onFileComplete?.(originalIndex, result);
        });

        docResult.errors.forEach((err, index) => {
          const originalIndex = documentFiles[index].originalIndex;
          errors.push({ index: originalIndex, error: err.error });
          onFileError?.(originalIndex, err.error);
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        documentFiles.forEach(f => {
          errors.push({ index: f.originalIndex, error: errorMessage });
          onFileError?.(f.originalIndex, errorMessage);
        });
      }
    }

    // Upload media files
    if (mediaFiles.length > 0) {
      try {
        const mediaData = mediaFiles.map(f => ({
          file: f.file,
          title: f.title,
          description: f.description,
          metadata: f.metadata
        }));

        const mediaResult = await this.uploadMultipleMediaEnhanced(mediaData);

        mediaResult.results.forEach((result, index) => {
          const originalIndex = mediaFiles[index].originalIndex;
          results[originalIndex] = result;
          onFileComplete?.(originalIndex, result);
        });

        mediaResult.errors.forEach((err, index) => {
          const originalIndex = mediaFiles[index].originalIndex;
          errors.push({ index: originalIndex, error: err.error });
          onFileError?.(originalIndex, err.error);
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        mediaFiles.forEach(f => {
          errors.push({ index: f.originalIndex, error: errorMessage });
          onFileError?.(f.originalIndex, errorMessage);
        });
      }
    }
    
    return { results, errors };
  }
}

// Create and export the upload service instance
export const uploadService = new UploadService();

// Export utility functions
export { UploadService };

// Export types for use in other components
export type {
  UploadProgress,
  UploadResult,
  UploadOptions
};

// Re-export enhanced upload result type for better integration
export interface EnhancedUploadResult extends UploadResult {
  id?: string;
  title?: string;
  description?: string;
  documentType?: string;
  uploadedBy?: number;
  provider?: string;
  cdnUrl?: string;
  key?: string;
}