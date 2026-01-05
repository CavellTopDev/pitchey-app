/**
 * Document Processor Container
 * 
 * Handles PDF generation, text extraction, and watermarking using
 * ReportLab, PyPDF2, and other document processing libraries.
 */

import { BaseContainer } from './base-container';
import { ContainerConfig } from './index';

export interface DocumentProcessingJob {
  type: 'generate' | 'extract' | 'watermark' | 'merge' | 'split' | 'convert';
  inputUrl?: string;
  template?: string;
  data?: Record<string, any>;
  watermark?: {
    text?: string;
    imageUrl?: string;
    position: 'header' | 'footer' | 'center' | 'background';
    opacity: number;
    fontSize?: number;
    color?: string;
  };
  options?: {
    pageNumbers?: boolean;
    encryption?: {
      userPassword?: string;
      ownerPassword?: string;
      permissions?: string[];
    };
    compression?: boolean;
    quality?: number;
  };
}

export interface DocumentProcessingResult {
  outputUrls: string[];
  metadata: {
    pageCount: number;
    fileSize: number;
    format: string;
    encrypted: boolean;
    hasText: boolean;
    hasImages: boolean;
  };
  extractedText?: string;
  extractedImages?: string[];
  processingTime: number;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'nda' | 'contract' | 'pitch-deck' | 'report' | 'invoice' | 'custom';
  fields: Array<{
    name: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'image' | 'table';
    required: boolean;
    validation?: string;
  }>;
  layout: {
    pageSize: 'A4' | 'LETTER' | 'LEGAL';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; bottom: number; left: number; right: number; };
    fonts: Record<string, string>;
    styles: Record<string, any>;
  };
}

export interface TextExtractionOptions {
  pages?: number[]; // Extract from specific pages
  preserveLayout?: boolean;
  extractTables?: boolean;
  extractImages?: boolean;
  language?: string; // For OCR
  ocrEnabled?: boolean;
}

export class DocumentProcessorContainer extends BaseContainer {
  private pythonPath: string = '/usr/bin/python3';
  private tempDir: string = '/tmp/document-processing';
  private templatesDir: string = '/app/templates';
  private maxConcurrentJobs: number = 5;
  private activeJobs = new Set<string>();
  private templates = new Map<string, DocumentTemplate>();
  
  constructor() {
    super('document-processor', {
      defaultPort: 8081,
      sleepAfter: 180, // 3 minutes
      maxConcurrency: 5,
      memoryLimit: '1GB',
      environment: {
        PYTHON_PATH: '/usr/bin/python3',
        TEMP_DIR: '/tmp/document-processing',
        TEMPLATES_DIR: '/app/templates',
        MAX_FILE_SIZE: '100MB',
        SUPPORTED_FORMATS: 'pdf,docx,txt,html,rtf',
        TESSERACT_PATH: '/usr/bin/tesseract',
        POPPLER_PATH: '/usr/bin'
      }
    });
  }
  
  protected async onStart(): Promise<void> {
    this.log('info', 'Initializing document processor container');
    
    // Verify Python and dependencies
    await this.verifyDependencies();
    
    // Load document templates
    await this.loadTemplates();
    
    // Create temp directory
    await this.ensureTempDirectory();
    
    // Start HTTP server
    await this.startHttpServer();
    
    this.log('info', 'Document processor container ready');
  }
  
  protected async onStop(): Promise<void> {
    this.log('info', 'Stopping document processor container');
    
    // Cancel running jobs
    for (const jobId of this.activeJobs) {
      await this.cancelJob(jobId);
    }
    
    // Cleanup temp files
    await this.cleanupTempFiles();
    
    this.log('info', 'Document processor container stopped');
  }
  
  protected async onError(error: Error): Promise<void> {
    this.log('error', 'Document processor container error', error);
    
    try {
      await this.cleanupTempFiles();
      await this.ensureTempDirectory();
    } catch (recoveryError) {
      this.log('error', 'Failed to recover from error', recoveryError);
    }
  }
  
  protected async processJobInternal<T>(jobType: string, payload: any): Promise<T> {
    switch (jobType) {
      case 'generate-pdf':
        return await this.generatePDF(payload) as T;
      
      case 'extract-text':
        return await this.extractText(payload) as T;
      
      case 'add-watermark':
        return await this.addWatermark(payload) as T;
      
      case 'merge-documents':
        return await this.mergeDocuments(payload) as T;
      
      case 'split-document':
        return await this.splitDocument(payload) as T;
      
      case 'convert-document':
        return await this.convertDocument(payload) as T;
      
      case 'generate-from-template':
        return await this.generateFromTemplate(payload) as T;
      
      case 'encrypt-document':
        return await this.encryptDocument(payload) as T;
      
      case 'compress-document':
        return await this.compressDocument(payload) as T;
      
      default:
        throw new Error(`Unsupported job type: ${jobType}`);
    }
  }
  
  // Public processing methods
  async generatePDF(job: DocumentProcessingJob): Promise<DocumentProcessingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      this.log('info', `Generating PDF for job ${jobId}`);
      
      const startTime = Date.now();
      
      // Prepare data for PDF generation
      const pdfConfig = {
        template: job.template || 'default',
        data: job.data || {},
        options: job.options || {},
        outputPath: `${this.tempDir}/${jobId}_generated.pdf`
      };
      
      // Call Python service to generate PDF
      const result = await this.makeRequest<{ success: boolean; filePath: string; metadata: any }>('/pdf/generate', {
        method: 'POST',
        body: JSON.stringify(pdfConfig)
      });
      
      if (!result.success) {
        throw new Error('PDF generation failed');
      }
      
      // Apply watermark if specified
      let finalPath = result.filePath;
      if (job.watermark) {
        finalPath = await this.applyWatermarkToPDF(result.filePath, job.watermark, jobId);
      }
      
      // Upload result
      const outputUrls = await this.uploadResults([finalPath]);
      
      const processingTime = Date.now() - startTime;
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata: result.metadata,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async extractText(payload: { inputUrl: string; options?: TextExtractionOptions }): Promise<{ text: string; images?: string[] }> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      // Download document
      const inputFile = await this.downloadDocument(payload.inputUrl, jobId);
      
      // Extract text using appropriate method based on file type
      const extractConfig = {
        inputPath: inputFile,
        options: payload.options || {},
        outputDir: `${this.tempDir}/${jobId}_extracted`
      };
      
      const result = await this.makeRequest<{ text: string; images?: string[] }>('/text/extract', {
        method: 'POST',
        body: JSON.stringify(extractConfig)
      });
      
      // Upload extracted images if any
      if (result.images && result.images.length > 0) {
        result.images = await this.uploadResults(result.images);
      }
      
      await this.cleanupJobFiles(jobId);
      return result;
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async addWatermark(job: DocumentProcessingJob): Promise<DocumentProcessingResult> {
    if (!job.inputUrl || !job.watermark) {
      throw new Error('Input URL and watermark configuration required');
    }
    
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadDocument(job.inputUrl, jobId);
      const outputFile = await this.applyWatermarkToPDF(inputFile, job.watermark, jobId);
      
      const metadata = await this.getDocumentMetadata(outputFile);
      const outputUrls = await this.uploadResults([outputFile]);
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata,
        processingTime: Date.now() - this.lastActivity
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async mergeDocuments(payload: { inputUrls: string[]; outputName?: string }): Promise<DocumentProcessingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      // Download all documents
      const inputFiles = await Promise.all(
        payload.inputUrls.map((url, index) => this.downloadDocument(url, `${jobId}_${index}`))
      );
      
      const mergeConfig = {
        inputFiles,
        outputPath: `${this.tempDir}/${jobId}_merged.pdf`
      };
      
      const startTime = Date.now();
      const result = await this.makeRequest<{ success: boolean; filePath: string; metadata: any }>('/pdf/merge', {
        method: 'POST',
        body: JSON.stringify(mergeConfig)
      });
      
      if (!result.success) {
        throw new Error('Document merge failed');
      }
      
      const outputUrls = await this.uploadResults([result.filePath]);
      const processingTime = Date.now() - startTime;
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata: result.metadata,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async splitDocument(payload: { inputUrl: string; pages: number[] | { start: number; end: number }[] }): Promise<DocumentProcessingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadDocument(payload.inputUrl, jobId);
      
      const splitConfig = {
        inputPath: inputFile,
        pages: payload.pages,
        outputDir: `${this.tempDir}/${jobId}_split`
      };
      
      const startTime = Date.now();
      const result = await this.makeRequest<{ success: boolean; files: string[]; metadata: any }>('/pdf/split', {
        method: 'POST',
        body: JSON.stringify(splitConfig)
      });
      
      if (!result.success) {
        throw new Error('Document split failed');
      }
      
      const outputUrls = await this.uploadResults(result.files);
      const processingTime = Date.now() - startTime;
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata: result.metadata,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async convertDocument(payload: { inputUrl: string; targetFormat: 'pdf' | 'docx' | 'html' | 'txt' }): Promise<DocumentProcessingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadDocument(payload.inputUrl, jobId);
      
      const convertConfig = {
        inputPath: inputFile,
        targetFormat: payload.targetFormat,
        outputPath: `${this.tempDir}/${jobId}_converted.${payload.targetFormat}`
      };
      
      const startTime = Date.now();
      const result = await this.makeRequest<{ success: boolean; filePath: string; metadata: any }>('/document/convert', {
        method: 'POST',
        body: JSON.stringify(convertConfig)
      });
      
      if (!result.success) {
        throw new Error('Document conversion failed');
      }
      
      const outputUrls = await this.uploadResults([result.filePath]);
      const processingTime = Date.now() - startTime;
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata: result.metadata,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async generateFromTemplate(payload: { templateId: string; data: Record<string, any>; options?: any }): Promise<DocumentProcessingResult> {
    const template = this.templates.get(payload.templateId);
    if (!template) {
      throw new Error(`Template ${payload.templateId} not found`);
    }
    
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      // Validate data against template fields
      this.validateTemplateData(template, payload.data);
      
      const generateConfig = {
        template,
        data: payload.data,
        options: payload.options || {},
        outputPath: `${this.tempDir}/${jobId}_template.pdf`
      };
      
      const startTime = Date.now();
      const result = await this.makeRequest<{ success: boolean; filePath: string; metadata: any }>('/template/generate', {
        method: 'POST',
        body: JSON.stringify(generateConfig)
      });
      
      if (!result.success) {
        throw new Error('Template generation failed');
      }
      
      const outputUrls = await this.uploadResults([result.filePath]);
      const processingTime = Date.now() - startTime;
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata: result.metadata,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async encryptDocument(payload: { inputUrl: string; password: string; permissions?: string[] }): Promise<DocumentProcessingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadDocument(payload.inputUrl, jobId);
      
      const encryptConfig = {
        inputPath: inputFile,
        password: payload.password,
        permissions: payload.permissions || ['print', 'copy'],
        outputPath: `${this.tempDir}/${jobId}_encrypted.pdf`
      };
      
      const startTime = Date.now();
      const result = await this.makeRequest<{ success: boolean; filePath: string; metadata: any }>('/pdf/encrypt', {
        method: 'POST',
        body: JSON.stringify(encryptConfig)
      });
      
      if (!result.success) {
        throw new Error('Document encryption failed');
      }
      
      const outputUrls = await this.uploadResults([result.filePath]);
      const processingTime = Date.now() - startTime;
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata: result.metadata,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async compressDocument(payload: { inputUrl: string; quality?: number }): Promise<DocumentProcessingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadDocument(payload.inputUrl, jobId);
      
      const compressConfig = {
        inputPath: inputFile,
        quality: payload.quality || 70,
        outputPath: `${this.tempDir}/${jobId}_compressed.pdf`
      };
      
      const startTime = Date.now();
      const result = await this.makeRequest<{ success: boolean; filePath: string; metadata: any }>('/pdf/compress', {
        method: 'POST',
        body: JSON.stringify(compressConfig)
      });
      
      if (!result.success) {
        throw new Error('Document compression failed');
      }
      
      const outputUrls = await this.uploadResults([result.filePath]);
      const processingTime = Date.now() - startTime;
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata: result.metadata,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  // Template management
  async registerTemplate(template: DocumentTemplate): Promise<void> {
    this.templates.set(template.id, template);
    
    // Persist template to storage
    await this.makeRequest('/templates/register', {
      method: 'POST',
      body: JSON.stringify(template)
    });
    
    this.log('info', `Registered template: ${template.id}`);
  }
  
  async getTemplate(templateId: string): Promise<DocumentTemplate | undefined> {
    return this.templates.get(templateId);
  }
  
  async listTemplates(): Promise<DocumentTemplate[]> {
    return Array.from(this.templates.values());
  }
  
  // Private helper methods
  private async verifyDependencies(): Promise<void> {
    const deps = await this.makeRequest<{ python: string; reportlab: string; pypdf2: string }>('/dependencies/verify');
    this.log('info', `Dependencies verified:`, deps);
  }
  
  private async loadTemplates(): Promise<void> {
    try {
      const templates = await this.makeRequest<DocumentTemplate[]>('/templates/load');
      for (const template of templates) {
        this.templates.set(template.id, template);
      }
      this.log('info', `Loaded ${templates.length} document templates`);
    } catch (error) {
      this.log('warn', 'Failed to load templates', error);
    }
  }
  
  private async ensureTempDirectory(): Promise<void> {
    await this.makeRequest('/filesystem/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path: this.tempDir })
    });
  }
  
  private async startHttpServer(): Promise<void> {
    await this.makeRequest('/server/start', {
      method: 'POST',
      body: JSON.stringify({ port: this.config.defaultPort })
    });
  }
  
  private async downloadDocument(url: string, jobId: string): Promise<string> {
    const filename = `${this.tempDir}/${jobId}_input`;
    
    await this.makeRequest('/download/document', {
      method: 'POST',
      body: JSON.stringify({ url, output: filename })
    });
    
    return filename;
  }
  
  private async applyWatermarkToPDF(inputPath: string, watermark: DocumentProcessingJob['watermark'], jobId: string): Promise<string> {
    const outputPath = `${this.tempDir}/${jobId}_watermarked.pdf`;
    
    await this.makeRequest('/pdf/watermark', {
      method: 'POST',
      body: JSON.stringify({ inputPath, outputPath, watermark })
    });
    
    return outputPath;
  }
  
  private async getDocumentMetadata(filePath: string): Promise<DocumentProcessingResult['metadata']> {
    return await this.makeRequest<DocumentProcessingResult['metadata']>('/document/metadata', {
      method: 'POST',
      body: JSON.stringify({ filePath })
    });
  }
  
  private async uploadResults(filePaths: string[]): Promise<string[]> {
    return await this.makeRequest<string[]>('/upload/results', {
      method: 'POST',
      body: JSON.stringify({ files: filePaths })
    });
  }
  
  private async cleanupJobFiles(jobId: string): Promise<void> {
    await this.makeRequest('/cleanup/job', {
      method: 'POST',
      body: JSON.stringify({ jobId })
    });
  }
  
  private async cleanupTempFiles(): Promise<void> {
    await this.makeRequest('/cleanup/temp', {
      method: 'POST'
    });
  }
  
  private validateTemplateData(template: DocumentTemplate, data: Record<string, any>): void {
    for (const field of template.fields) {
      if (field.required && !(field.name in data)) {
        throw new Error(`Required field missing: ${field.name}`);
      }
      
      if (field.validation && data[field.name]) {
        const regex = new RegExp(field.validation);
        if (!regex.test(String(data[field.name]))) {
          throw new Error(`Invalid value for field ${field.name}: ${data[field.name]}`);
        }
      }
    }
  }
}