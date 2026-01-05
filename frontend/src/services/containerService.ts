/**
 * Container Processing Services
 * Handles video, document, AI, and media processing via container endpoints
 */

import { getApiUrl } from '../config';

// ===== TYPE DEFINITIONS =====

export interface ProcessingJob {
  jobId: string;
  type: 'video' | 'document' | 'ai' | 'media' | 'code';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startTime: string;
  endTime?: string;
  inputFile?: string;
  outputFiles?: string[];
  metadata?: Record<string, any>;
  error?: string;
  websocketUrl?: string;
}

export interface VideoProcessingRequest {
  videoFile: File | string;
  outputFormat?: 'mp4' | 'mov' | 'webm';
  quality?: '480p' | '720p' | '1080p' | '4k';
  generateThumbnails?: boolean;
  thumbnailCount?: number;
  extractAudio?: boolean;
  compress?: boolean;
  watermark?: {
    text?: string;
    image?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  };
}

export interface DocumentProcessingRequest {
  documentFile: File | string;
  outputFormat?: 'pdf' | 'docx' | 'html' | 'text';
  extractText?: boolean;
  generateThumbnails?: boolean;
  performOCR?: boolean;
  language?: string;
  mergePDFs?: string[];
}

export interface AIInferenceRequest {
  type: 'pitch-analysis' | 'sentiment-analysis' | 'text-summary' | 'content-extraction';
  inputText?: string;
  inputFile?: File | string;
  model?: string;
  parameters?: Record<string, any>;
  batchProcess?: boolean;
}

export interface MediaTranscodingRequest {
  mediaFile: File | string;
  outputFormat: string;
  quality?: 'low' | 'medium' | 'high' | 'lossless';
  resolution?: string;
  bitrate?: number;
  audioCodec?: string;
  videoCodec?: string;
  preset?: 'web-optimized' | 'mobile-optimized' | 'hd-quality';
}

export interface CodeExecutionRequest {
  language: 'javascript' | 'python' | 'typescript';
  code: string;
  inputs?: Record<string, any>;
  timeout?: number;
  memoryLimit?: number;
}

// ===== CONTAINER SERVICE CLASS =====

class ContainerService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = getApiUrl();
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Include cookies for Better Auth
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  private async uploadFile(file: File, endpoint: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // ===== VIDEO PROCESSING =====

  async processVideo(request: VideoProcessingRequest): Promise<ProcessingJob> {
    if (request.videoFile instanceof File) {
      return this.uploadFile(request.videoFile, '/api/containers/process/video');
    }

    return this.makeRequest<ProcessingJob>('/api/containers/process/video', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ===== DOCUMENT PROCESSING =====

  async processDocument(request: DocumentProcessingRequest): Promise<ProcessingJob> {
    if (request.documentFile instanceof File) {
      return this.uploadFile(request.documentFile, '/api/containers/process/document');
    }

    return this.makeRequest<ProcessingJob>('/api/containers/process/document', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ===== AI INFERENCE =====

  async processAI(request: AIInferenceRequest): Promise<ProcessingJob> {
    if (request.inputFile instanceof File) {
      return this.uploadFile(request.inputFile, '/api/containers/process/ai');
    }

    return this.makeRequest<ProcessingJob>('/api/containers/process/ai', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ===== MEDIA TRANSCODING =====

  async transcodeMedia(request: MediaTranscodingRequest): Promise<ProcessingJob> {
    if (request.mediaFile instanceof File) {
      return this.uploadFile(request.mediaFile, '/api/containers/process/media');
    }

    return this.makeRequest<ProcessingJob>('/api/containers/process/media', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ===== CODE EXECUTION =====

  async executeCode(request: CodeExecutionRequest): Promise<ProcessingJob> {
    return this.makeRequest<ProcessingJob>('/api/containers/process/code', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ===== JOB MANAGEMENT =====

  async getJobs(): Promise<ProcessingJob[]> {
    return this.makeRequest<ProcessingJob[]>('/api/containers/jobs');
  }

  async getJobStatus(jobId: string): Promise<ProcessingJob> {
    return this.makeRequest<ProcessingJob>(`/api/containers/jobs/${jobId}`);
  }

  async cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest<{ success: boolean; message: string }>(`/api/containers/jobs/${jobId}`, {
      method: 'DELETE',
    });
  }

  async createJob(jobData: Partial<ProcessingJob>): Promise<ProcessingJob> {
    return this.makeRequest<ProcessingJob>('/api/containers/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // ===== METRICS AND MONITORING =====

  async getContainerDashboard(): Promise<any> {
    return this.makeRequest<any>('/api/containers/metrics/dashboard');
  }

  async getContainerCosts(): Promise<any> {
    return this.makeRequest<any>('/api/containers/metrics/costs');
  }

  async getContainerPerformance(): Promise<any> {
    return this.makeRequest<any>('/api/containers/metrics/performance');
  }

  async getContainerHealth(): Promise<any> {
    return this.makeRequest<any>('/api/containers/metrics/health');
  }

  // ===== COST OPTIMIZATION =====

  async getCostRecommendations(): Promise<any> {
    return this.makeRequest<any>('/api/containers/optimization/recommendations');
  }

  async implementOptimization(optimizationId: string): Promise<any> {
    return this.makeRequest<any>('/api/containers/optimization/implement', {
      method: 'POST',
      body: JSON.stringify({ optimizationId }),
    });
  }

  async getContainerBudgets(): Promise<any> {
    return this.makeRequest<any>('/api/containers/budgets');
  }

  async createBudget(budget: any): Promise<any> {
    return this.makeRequest<any>('/api/containers/budgets', {
      method: 'POST',
      body: JSON.stringify(budget),
    });
  }

  // ===== WEBSOCKET SUPPORT =====

  connectToJobWebSocket(jobId: string): WebSocket {
    const wsUrl = this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    return new WebSocket(`${wsUrl}/api/containers/ws?jobId=${jobId}`);
  }

  // ===== UTILITY METHODS =====

  async pingContainerServices(): Promise<{ service: string; status: 'healthy' | 'unhealthy'; responseTime: number }[]> {
    const services = [
      '/api/containers/metrics/health',
      '/api/containers/jobs',
      '/api/containers/metrics/dashboard'
    ];

    const results = await Promise.allSettled(
      services.map(async (service) => {
        const startTime = performance.now();
        try {
          await this.makeRequest<any>(service);
          const responseTime = performance.now() - startTime;
          return {
            service,
            status: 'healthy' as const,
            responseTime: Math.round(responseTime)
          };
        } catch (error) {
          const responseTime = performance.now() - startTime;
          return {
            service,
            status: 'unhealthy' as const,
            responseTime: Math.round(responseTime)
          };
        }
      })
    );

    return results.map((result, index) => 
      result.status === 'fulfilled' 
        ? result.value 
        : { 
            service: services[index], 
            status: 'unhealthy' as const, 
            responseTime: -1 
          }
    );
  }
}

// ===== EXPORT SINGLETON INSTANCE =====

export const containerService = new ContainerService();

// ===== CONVENIENCE FUNCTIONS =====

export const processVideo = (request: VideoProcessingRequest) => containerService.processVideo(request);
export const processDocument = (request: DocumentProcessingRequest) => containerService.processDocument(request);
export const processAI = (request: AIInferenceRequest) => containerService.processAI(request);
export const transcodeMedia = (request: MediaTranscodingRequest) => containerService.transcodeMedia(request);
export const executeCode = (request: CodeExecutionRequest) => containerService.executeCode(request);

export const getJobs = () => containerService.getJobs();
export const getJobStatus = (jobId: string) => containerService.getJobStatus(jobId);
export const cancelJob = (jobId: string) => containerService.cancelJob(jobId);

export const getContainerDashboard = () => containerService.getContainerDashboard();
export const getContainerHealth = () => containerService.getContainerHealth();

export default containerService;