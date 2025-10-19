import { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  X, 
  FileText, 
  File as FileIcon, 
  Shield, 
  Video, 
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader,
  Plus,
  Eye,
  Download
} from 'lucide-react';
import { useToast } from '../Toast/ToastProvider';
import { uploadService } from '../../services/upload.service';

export interface DocumentFile {
  id: string;
  type: 'script' | 'treatment' | 'pitch_deck' | 'nda' | 'supporting_materials' | 'lookbook' | 'budget';
  file: File;
  title: string;
  description?: string;
  uploadProgress?: number;
  uploadStatus?: 'idle' | 'uploading' | 'completed' | 'error';
  url?: string;
}

interface DocumentUploadProps {
  documents: DocumentFile[];
  onChange: (documents: DocumentFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  disabled?: boolean;
  showProgress?: boolean;
  enableDragDrop?: boolean;
  showPreview?: boolean;
  className?: string;
}

const DOCUMENT_TYPES = [
  { value: 'script', label: 'Script', icon: FileText, color: 'blue' },
  { value: 'treatment', label: 'Treatment', icon: FileText, color: 'green' },
  { value: 'pitch_deck', label: 'Pitch Deck', icon: FileIcon, color: 'purple' },
  { value: 'lookbook', label: 'Visual Lookbook', icon: ImageIcon, color: 'pink' },
  { value: 'budget', label: 'Budget Breakdown', icon: FileText, color: 'yellow' },
  { value: 'nda', label: 'NDA Document', icon: Shield, color: 'red' },
  { value: 'supporting_materials', label: 'Supporting Materials', icon: FileIcon, color: 'gray' }
] as const;

const DEFAULT_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain'
];

export default function DocumentUpload({
  documents,
  onChange,
  maxFiles = 10,
  maxFileSize = 10,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  disabled = false,
  showProgress = true,
  enableDragDrop = true,
  showPreview = true,
  className = ''
}: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error } = useToast();

  // Validate file type and size
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not supported. Please use PDF, DOC, DOCX, PPT, PPTX, or TXT files.`
      };
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return {
        valid: false,
        error: `File ${file.name} (${fileSizeMB.toFixed(1)}MB) exceeds the ${maxFileSize}MB limit.`
      };
    }

    return { valid: true };
  }, [allowedTypes, maxFileSize]);

  // Detect document type based on filename
  const detectDocumentType = useCallback((file: File): DocumentFile['type'] => {
    const name = file.name.toLowerCase();
    if (name.includes('script')) return 'script';
    if (name.includes('treatment')) return 'treatment';
    if (name.includes('deck') || name.includes('presentation')) return 'pitch_deck';
    if (name.includes('lookbook') || name.includes('visual')) return 'lookbook';
    if (name.includes('budget') || name.includes('finance')) return 'budget';
    if (name.includes('nda') || name.includes('agreement')) return 'nda';
    return 'supporting_materials';
  }, []);

  // Process files for upload
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // Check total file limit
    if (documents.length + fileArray.length > maxFiles) {
      error('Too many files', `You can only upload up to ${maxFiles} files total.`);
      return;
    }

    const validFiles: DocumentFile[] = [];
    const invalidFiles: string[] = [];

    for (const file of fileArray) {
      const validation = validateFile(file);
      
      if (validation.valid) {
        validFiles.push({
          id: crypto.randomUUID(),
          type: detectDocumentType(file),
          file,
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          description: '',
          uploadProgress: 0,
          uploadStatus: 'idle'
        });
      } else {
        invalidFiles.push(validation.error!);
      }
    }

    if (invalidFiles.length > 0) {
      invalidFiles.forEach(errorMsg => error('File validation failed', errorMsg));
    }

    if (validFiles.length > 0) {
      onChange([...documents, ...validFiles]);
      success('Files added', `${validFiles.length} file(s) ready for upload.`);
    }
  }, [documents, maxFiles, validateFile, detectDocumentType, onChange, error, success]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && enableDragDrop) {
      setIsDragOver(true);
    }
  }, [disabled, enableDragDrop]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || !enableDragDrop) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [disabled, enableDragDrop, processFiles]);

  // Update document
  const updateDocument = useCallback((id: string, updates: Partial<DocumentFile>) => {
    onChange(documents.map(doc => 
      doc.id === id ? { ...doc, ...updates } : doc
    ));
  }, [documents, onChange]);

  // Remove document
  const removeDocument = useCallback((id: string) => {
    onChange(documents.filter(doc => doc.id !== id));
  }, [documents, onChange]);

  // Get document icon and color
  const getDocumentInfo = useCallback((type: DocumentFile['type']) => {
    const docType = DOCUMENT_TYPES.find(dt => dt.value === type);
    return docType || DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1]; // Default to supporting materials
  }, []);

  // Upload document to server
  const uploadDocument = useCallback(async (document: DocumentFile) => {
    updateDocument(document.id, { uploadStatus: 'uploading', uploadProgress: 0 });
    
    try {
      const result = await uploadService.uploadDocument(
        document.file,
        document.type,
        {
          onProgress: (progress) => {
            updateDocument(document.id, { uploadProgress: progress.percentage });
          }
        }
      );
      
      updateDocument(document.id, { 
        uploadStatus: 'completed', 
        uploadProgress: 100,
        url: result.url
      });
      
      success('Upload completed', `${document.title} uploaded successfully.`);
    } catch (err: any) {
      updateDocument(document.id, { 
        uploadStatus: 'error', 
        uploadProgress: 0 
      });
      
      error('Upload failed', err.message || `Failed to upload ${document.title}`);
    }
  }, [updateDocument, success, error]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
          ${isDragOver && !disabled 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-300 hover:border-purple-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="space-y-4">
          <div className="flex justify-center">
            {isDragOver ? (
              <Upload className="w-12 h-12 text-purple-600 animate-bounce" />
            ) : (
              <Upload className="w-12 h-12 text-gray-400" />
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isDragOver ? 'Drop files here' : 'Upload Documents'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {enableDragDrop 
                ? 'Drag and drop files here, or click to browse'
                : 'Click to browse and select files'
              }
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Supported: PDF, DOC, DOCX, PPT, PPTX, TXT</p>
              <p>Max file size: {maxFileSize}MB • Max files: {maxFiles}</p>
              <p>Current: {documents.length}/{maxFiles} files</p>
            </div>
          </div>
          
          {!disabled && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Choose Files
            </button>
          )}
        </div>
      </div>

      {/* Document Types Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {DOCUMENT_TYPES.map(({ value, label, icon: Icon, color }) => {
          const colorClasses = {
            blue: 'bg-blue-50 border-blue-200 text-blue-600 text-blue-900',
            green: 'bg-green-50 border-green-200 text-green-600 text-green-900',
            purple: 'bg-purple-50 border-purple-200 text-purple-600 text-purple-900',
            pink: 'bg-pink-50 border-pink-200 text-pink-600 text-pink-900',
            yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600 text-yellow-900',
            red: 'bg-red-50 border-red-200 text-red-600 text-red-900',
            gray: 'bg-gray-50 border-gray-200 text-gray-600 text-gray-900'
          };
          
          const classes = colorClasses[color as keyof typeof colorClasses] || colorClasses.gray;
          const [bgClass, borderClass, iconClass, textClass] = classes.split(' ');
          
          return (
            <div 
              key={value}
              className={`p-3 rounded-lg text-center text-sm ${bgClass} border ${borderClass}`}
            >
              <Icon className={`w-5 h-5 mx-auto mb-1 ${iconClass}`} />
              <p className={`font-medium ${textClass}`}>{label}</p>
            </div>
          );
        })}
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Uploaded Documents ({documents.length})
            </h3>
            {documents.some(doc => doc.uploadStatus === 'idle') && (
              <button
                onClick={() => {
                  documents
                    .filter(doc => doc.uploadStatus === 'idle')
                    .forEach(doc => uploadDocument(doc));
                }}
                disabled={isUploading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Upload All
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {documents.map(document => {
              const docInfo = getDocumentInfo(document.type);
              const Icon = docInfo.icon;
              
              const colorClasses = {
                blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
                green: { bg: 'bg-green-100', text: 'text-green-600' },
                purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
                pink: { bg: 'bg-pink-100', text: 'text-pink-600' },
                yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
                red: { bg: 'bg-red-100', text: 'text-red-600' },
                gray: { bg: 'bg-gray-100', text: 'text-gray-600' }
              };
              
              const colors = colorClasses[docInfo.color as keyof typeof colorClasses] || colorClasses.gray;
              
              return (
                <div 
                  key={document.id} 
                  className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Document Icon */}
                    <div className={`p-3 rounded-lg ${colors.bg} flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    
                    {/* Document Details */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Title and Type */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={document.title}
                          onChange={(e) => updateDocument(document.id, { title: e.target.value })}
                          placeholder="Document title"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <select
                          value={document.type}
                          onChange={(e) => updateDocument(document.id, { 
                            type: e.target.value as DocumentFile['type'] 
                          })}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          {DOCUMENT_TYPES.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Description */}
                      <textarea
                        value={document.description || ''}
                        onChange={(e) => updateDocument(document.id, { description: e.target.value })}
                        placeholder="Brief description (optional)"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      
                      {/* File Info */}
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{document.file.name} • {formatFileSize(document.file.size)}</span>
                        <div className="flex items-center gap-2">
                          {document.uploadStatus === 'completed' && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                          {document.uploadStatus === 'error' && (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          {document.uploadStatus === 'uploading' && (
                            <Loader className="w-4 h-4 text-blue-600 animate-spin" />
                          )}
                        </div>
                      </div>
                      
                      {/* Upload Progress */}
                      {showProgress && document.uploadStatus === 'uploading' && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${document.uploadProgress || 0}%` }}
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {showPreview && document.url && (
                        <button
                          type="button"
                          onClick={() => window.open(document.url, '_blank')}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                          title="Preview document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      
                      {document.uploadStatus === 'completed' && document.url && (
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = document.url!;
                            link.download = document.file.name;
                            link.click();
                          }}
                          className="p-2 text-gray-500 hover:text-green-600 transition-colors"
                          title="Download document"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      
                      {document.uploadStatus === 'idle' && (
                        <button
                          type="button"
                          onClick={() => uploadDocument(document)}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                          title="Upload document"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => removeDocument(document.id)}
                        className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                        title="Remove document"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {documents.length === 0 && (
        <div className="text-center py-8">
          <FileIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded</h3>
          <p className="text-gray-600">
            Upload scripts, treatments, pitch decks, and supporting materials to complete your pitch
          </p>
        </div>
      )}
    </div>
  );
}