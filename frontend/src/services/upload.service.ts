import { config } from './config.service';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  type: string;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
  timeout?: number;
}

class UploadService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.API_URL;
  }

  /**
   * Upload a single document file
   */
  async uploadDocument(
    file: File, 
    documentType: string = 'document',
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', documentType);

    return this.uploadFile('/api/upload/document', formData, options);
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
   * Upload multiple files in batch
   */
  async uploadMultipleDocuments(
    files: File[],
    documentTypes: string[] = [],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    const uploads = files.map((file, index) => {
      const type = documentTypes[index] || 'document';
      return this.uploadDocument(file, type, {
        ...options,
        onProgress: options.onProgress ? (progress) => {
          // Calculate overall progress across all files
          const overallProgress = {
            ...progress,
            percentage: ((index / files.length) * 100) + (progress.percentage / files.length)
          };
          options.onProgress!(overallProgress);
        } : undefined
      });
    });

    return Promise.all(uploads);
  }

  /**
   * Core upload method with progress tracking
   */
  private uploadFile(
    endpoint: string, 
    formData: FormData, 
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const { onProgress, signal, timeout = 300000 } = options; // 5 minute default timeout

      // Set up progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            };
            onProgress(progress);
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.message || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed: Network error'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload failed: Request timeout'));
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
      xhr.timeout = timeout;

      // Add authentication if available
      const token = localStorage.getItem('auth_token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
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
   * Delete uploaded file
   */
  async deleteFile(filename: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/${filename}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to delete file');
    }
  }

  /**
   * Get upload status/info
   */
  async getUploadInfo(): Promise<{
    maxFileSize: number;
    allowedTypes: string[];
    maxFiles: number;
    totalStorage: number;
    usedStorage: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/upload/info`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get upload info');
    }

    return response.json();
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
}

export const uploadService = new UploadService();