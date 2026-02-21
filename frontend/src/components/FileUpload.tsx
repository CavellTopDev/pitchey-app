import React, { useState, useRef } from 'react';
import { Upload, X, File, Image, Video, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { API_URL } from '../config';

interface FileUploadProps {
  onFilesUploaded?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  acceptedFileTypes?: string[];
  context?: 'document' | 'image' | 'video' | 'nda';
  requireNDA?: boolean;
  pitchId?: number;
  className?: string;
}

interface UploadedFile {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  thumbnailUrl?: string;
}

interface FileWithProgress extends File {
  progress?: number;
  status?: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  result?: UploadedFile;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesUploaded,
  maxFiles = 10,
  maxFileSize = 100, // 100MB default
  acceptedFileTypes,
  context = 'document',
  requireNDA = false,
  pitchId,
  className = ''
}) => {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get accepted file types based on context
  const getAcceptedTypes = () => {
    if (acceptedFileTypes) return acceptedFileTypes;
    
    switch (context) {
      case 'document':
        return ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
      case 'image':
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      case 'video':
        return ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      case 'nda':
        return ['.pdf'];
      default:
        return [];
    }
  };

  // Get file icon based on type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (mimeType.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (mimeType === 'application/pdf') return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Validate file
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    const maxSizeBytes = maxFileSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { 
        valid: false, 
        error: `File size exceeds ${maxFileSize}MB` 
      };
    }

    // Check file type
    const acceptedTypes = getAcceptedTypes();
    if (acceptedTypes.length > 0) {
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type);
        }
        return file.type === type;
      });
      
      if (!isAccepted) {
        return { 
          valid: false, 
          error: `File type not accepted. Allowed: ${acceptedTypes.join(', ')}` 
        };
      }
    }

    return { valid: true };
  };

  // Handle file selection
  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: FileWithProgress[] = [];
    const totalFiles = files.length + selectedFiles.length;

    if (totalFiles > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i] as FileWithProgress;
      const validation = validateFile(file);
      
      if (validation.valid) {
        file.status = 'pending';
        file.progress = 0;
        newFiles.push(file);
      } else {
        file.status = 'error';
        file.error = validation.error;
        newFiles.push(file);
      }
    }

    setFiles([...files, ...newFiles]);

    // Auto-upload valid files
    newFiles.forEach(file => {
      if (file.status === 'pending') {
        void uploadFile(file);
      }
    });
  };

  // Upload a single file
  const uploadFile = async (file: FileWithProgress) => {
    // For large files, use chunked upload
    if (file.size > 10 * 1024 * 1024) { // > 10MB
      await uploadChunked(file);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', context);
    formData.append('requireNDA', requireNDA.toString());
    if (pitchId !== undefined) {
      formData.append('pitchId', pitchId.toString());
    }

    // Update file status
    setFiles(prev => prev.map(f => 
      f === file ? { ...f, status: 'uploading' as const } : f
    ));

    try {
      const token = localStorage.getItem('authToken');
      const endpoint = context === 'nda' ? '/api/upload/nda' : '/api/upload';

      // Regular upload for smaller files
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setFiles(prev => prev.map(f =>
            f === file ? { ...f, progress } : f
          ));
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText) as { success?: boolean; data?: UploadedFile; error?: { message?: string } };
          if (response.success === true) {
            const uploadedData = response.data;
            setFiles(prev => prev.map(f =>
              f === file ? {
                ...f,
                status: 'completed' as const,
                progress: 100,
                result: uploadedData
              } : f
            ));

            // Notify parent component
            if (onFilesUploaded !== undefined && uploadedData !== undefined) {
              const uploadedFiles = files
                .filter(f => f.status === 'completed' && f.result)
                .map(f => f.result!);
              uploadedFiles.push(uploadedData);
              onFilesUploaded(uploadedFiles);
            }
          } else {
            throw new Error(response.error?.message ?? 'Upload failed');
          }
        } else {
          throw new Error('Upload failed');
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        setFiles(prev => prev.map(f => 
          f === file ? { 
            ...f, 
            status: 'error' as const, 
            error: 'Upload failed' 
          } : f
        ));
      });

      // Send request
      xhr.open('POST', `${API_URL}${endpoint}`);
      if (token !== null) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);

    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f =>
        f === file ? {
          ...f,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Upload failed'
        } : f
      ));
    }
  };

  // Chunked upload for large files using the new chunked upload service
  const uploadChunked = async (file: FileWithProgress) => {
    try {
      // Import the chunked upload service
      const { chunkedUploadService } = await import('../services/chunked-upload.service');
      
      // Map context to category
      const categoryMap = {
        document: 'document' as const,
        image: 'image' as const,
        video: 'video' as const,
        nda: 'nda' as const
      };
      const category = categoryMap[context] || 'document' as const;

      const result = await chunkedUploadService.uploadFile(file, category, {
        pitchId: pitchId,
        metadata: { 
          requireNDA: requireNDA,
          context: context 
        },
        onProgress: (progress) => {
          setFiles(prev => prev.map(f =>
            f === file ? { ...f, progress: progress.percentage } : f
          ));
        }
      });

      setFiles(prev => prev.map(f => 
        f === file ? { 
          ...f, 
          status: 'completed' as const, 
          progress: 100,
          result: {
            id: result.sessionId,
            filename: result.fileName,
            url: result.url,
            size: result.fileSize,
            mimeType: result.mimeType,
            uploadedAt: result.uploadedAt
          }
        } : f
      ));

      // Notify parent component
      if (onFilesUploaded !== undefined) {
        const uploadedFiles = files
          .filter(f => f.status === 'completed' && f.result)
          .map(f => f.result!);
        uploadedFiles.push({
          id: result.sessionId,
          filename: result.fileName,
          url: result.url,
          size: result.fileSize,
          mimeType: result.mimeType,
          uploadedAt: result.uploadedAt
        });
        onFilesUploaded(uploadedFiles);
      }

    } catch (error) {
      console.error('Chunked upload error:', error);
      setFiles(prev => prev.map(f =>
        f === file ? {
          ...f,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Chunked upload failed'
        } : f
      ));
    }
  };

  // Multipart upload for large files (legacy fallback)
  const _uploadMultipart = async (file: FileWithProgress) => {
    try {
      const token = localStorage.getItem('authToken');
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks

      // Initialize multipart upload
      const initResponse = await fetch(`${API_URL}/api/upload/multipart/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: file.name,
          context,
          requireNDA
        }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!initResponse.ok) throw new Error('Failed to initialize upload');

      const initData = await initResponse.json() as { data?: { uploadId?: string; key?: string } };
      const uploadId = initData.data?.uploadId;
      const key = initData.data?.key;

      // Upload chunks
      const chunks = Math.ceil(file.size / chunkSize);
      const parts: { partNumber: number; etag: string }[] = [];

      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        const partResponse = await fetch(
          `${API_URL}/api/upload/multipart/part?key=${key}&uploadId=${uploadId}&partNumber=${i + 1}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token ?? ''}`
            },
            body: chunk
          }
        );

        if (!partResponse.ok) throw new Error(`Failed to upload part ${i + 1}`);

        const partData = await partResponse.json() as { data?: { partNumber: number; etag: string } };
        if (partData.data) {
          parts.push(partData.data);
        }

        // Update progress
        const progress = Math.round(((i + 1) / chunks) * 100);
        setFiles(prev => prev.map(f =>
          f === file ? { ...f, progress } : f
        ));
      }

      // Complete multipart upload
      const completeResponse = await fetch(`${API_URL}/api/upload/complete-multipart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, uploadId, parts }),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!completeResponse.ok) throw new Error('Failed to complete upload');

      const completeData = await completeResponse.json() as { data?: UploadedFile };
      const result = completeData.data;

      setFiles(prev => prev.map(f =>
        f === file ? {
          ...f,
          status: 'completed' as const,
          progress: 100,
          result
        } : f
      ));

      // Notify parent
      if (onFilesUploaded !== undefined && result !== undefined) {
        const uploadedFiles = files
          .filter(f => f.status === 'completed' && f.result)
          .map(f => f.result!);
        uploadedFiles.push(result);
        onFilesUploaded(uploadedFiles);
      }

    } catch (error) {
      console.error('Multipart upload error:', error);
      setFiles(prev => prev.map(f =>
        f === file ? {
          ...f,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Multipart upload failed'
        } : f
      ));
    }
  };

  // Remove file
  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className={`file-upload ${className}`}>
      {/* Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-gray-500">
          Maximum {maxFiles} files, up to {maxFileSize}MB each
        </p>
        {context === 'nda' && (
          <p className="text-sm text-yellow-600 mt-2">
            Only PDF files are accepted for NDA documents
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple={context !== 'nda'}
          accept={getAcceptedTypes().join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
            >
              <div className="flex items-center space-x-3">
                {getFileIcon(file.type)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Progress/Status */}
                {file.status === 'uploading' && (
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{file.progress}%</span>
                  </div>
                )}
                
                {file.status === 'completed' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                
                {file.status === 'error' && (
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-xs text-red-500">{file.error}</span>
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;