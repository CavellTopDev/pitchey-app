/**
 * Video Processor Container
 * 
 * Handles FFmpeg video processing, transcoding, and thumbnail generation
 * within a containerized environment with scale-to-zero capabilities.
 */

import { BaseContainer } from './base-container';
import { ContainerConfig, JobResult } from './index';

export interface VideoProcessingJob {
  inputUrl: string;
  outputFormat: 'mp4' | 'webm' | 'hls' | 'thumbnail';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  resolution?: string; // e.g., "1920x1080"
  bitrate?: string; // e.g., "2000k"
  framerate?: number;
  thumbnailTimes?: number[]; // timestamps for thumbnails in seconds
  watermark?: {
    text?: string;
    imageUrl?: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity: number;
  };
}

export interface VideoProcessingResult {
  outputUrls: string[];
  metadata: {
    duration: number;
    width: number;
    height: number;
    fileSize: number;
    codec: string;
    bitrate: number;
  };
  thumbnails?: string[];
  processingTime: number;
}

export interface VideoAnalysisResult {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
  codec: string;
  audioCodec?: string;
  audioChannels?: number;
  hasAudio: boolean;
  fileSize: number;
  scenes?: Array<{
    start: number;
    end: number;
    confidence: number;
  }>;
}

export class VideoProcessorContainer extends BaseContainer {
  private ffmpegPath: string = '/usr/bin/ffmpeg';
  private ffprobePath: string = '/usr/bin/ffprobe';
  private tempDir: string = '/tmp/video-processing';
  private maxConcurrentJobs: number = 3;
  private activeJobs = new Set<string>();
  
  constructor() {
    super('video-processor', {
      defaultPort: 8080,
      sleepAfter: 300, // 5 minutes
      maxConcurrency: 3,
      memoryLimit: '2GB',
      environment: {
        FFMPEG_PATH: '/usr/bin/ffmpeg',
        FFPROBE_PATH: '/usr/bin/ffprobe',
        TEMP_DIR: '/tmp/video-processing',
        MAX_FILE_SIZE: '500MB',
        SUPPORTED_FORMATS: 'mp4,avi,mov,mkv,webm,flv'
      }
    });
  }
  
  protected async onStart(): Promise<void> {
    this.log('info', 'Initializing video processor container');
    
    // Verify FFmpeg installation
    await this.verifyFFmpeg();
    
    // Create temp directory
    await this.ensureTempDirectory();
    
    // Start HTTP server for processing requests
    await this.startHttpServer();
    
    this.log('info', 'Video processor container ready');
  }
  
  protected async onStop(): Promise<void> {
    this.log('info', 'Stopping video processor container');
    
    // Cancel any running jobs
    for (const jobId of this.activeJobs) {
      await this.cancelJob(jobId);
    }
    
    // Cleanup temp files
    await this.cleanupTempFiles();
    
    this.log('info', 'Video processor container stopped');
  }
  
  protected async onError(error: Error): Promise<void> {
    this.log('error', 'Video processor container error', error);
    
    // Attempt recovery
    try {
      await this.cleanupTempFiles();
      await this.ensureTempDirectory();
    } catch (recoveryError) {
      this.log('error', 'Failed to recover from error', recoveryError);
    }
  }
  
  protected async processJobInternal<T>(jobType: string, payload: any): Promise<T> {
    switch (jobType) {
      case 'transcode':
        return await this.transcodeVideo(payload) as T;
      
      case 'thumbnail':
        return await this.generateThumbnails(payload) as T;
      
      case 'analyze':
        return await this.analyzeVideo(payload) as T;
      
      case 'watermark':
        return await this.addWatermark(payload) as T;
      
      case 'extract-audio':
        return await this.extractAudio(payload) as T;
      
      case 'compress':
        return await this.compressVideo(payload) as T;
      
      default:
        throw new Error(`Unsupported job type: ${jobType}`);
    }
  }
  
  // Public processing methods
  async transcodeVideo(job: VideoProcessingJob): Promise<VideoProcessingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      this.log('info', `Starting video transcode: ${job.inputUrl}`);
      
      // Download input video
      const inputFile = await this.downloadVideo(job.inputUrl, jobId);
      
      // Prepare output configuration
      const outputConfig = this.buildFFmpegConfig(job);
      const outputFile = `${this.tempDir}/${jobId}_output.${this.getFileExtension(job.outputFormat)}`;
      
      // Execute FFmpeg transcoding
      const startTime = Date.now();
      await this.executeFFmpeg(inputFile, outputFile, outputConfig);
      const processingTime = Date.now() - startTime;
      
      // Analyze output file
      const metadata = await this.getVideoMetadata(outputFile);
      
      // Generate thumbnails if requested
      const thumbnails = job.thumbnailTimes ? 
        await this.generateThumbnailsFromTimes(outputFile, job.thumbnailTimes) : 
        undefined;
      
      // Upload result to storage
      const outputUrls = await this.uploadResults([outputFile]);
      
      // Cleanup local files
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata,
        thumbnails,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async generateThumbnails(payload: { inputUrl: string; times: number[]; width?: number; height?: number }): Promise<string[]> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadVideo(payload.inputUrl, jobId);
      const thumbnails = await this.generateThumbnailsFromTimes(inputFile, payload.times, payload.width, payload.height);
      
      await this.cleanupJobFiles(jobId);
      return thumbnails;
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async analyzeVideo(payload: { inputUrl: string }): Promise<VideoAnalysisResult> {
    const jobId = this.generateJobId();
    
    try {
      const inputFile = await this.downloadVideo(payload.inputUrl, jobId);
      
      // Use FFprobe to get detailed video information
      const metadata = await this.executeFFprobe(inputFile);
      
      // Scene detection (optional advanced feature)
      const scenes = await this.detectScenes(inputFile);
      
      await this.cleanupJobFiles(jobId);
      
      return {
        ...metadata,
        scenes
      };
      
    } finally {
      // Cleanup handled in try block
    }
  }
  
  async addWatermark(payload: VideoProcessingJob): Promise<VideoProcessingResult> {
    if (!payload.watermark) {
      throw new Error('Watermark configuration required');
    }
    
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadVideo(payload.inputUrl, jobId);
      const outputFile = `${this.tempDir}/${jobId}_watermarked.mp4`;
      
      // Build FFmpeg filter for watermark
      const watermarkFilter = await this.buildWatermarkFilter(payload.watermark);
      const ffmpegArgs = [
        '-i', inputFile,
        '-vf', watermarkFilter,
        '-c:a', 'copy',
        '-y', outputFile
      ];
      
      const startTime = Date.now();
      await this.executeFFmpegCommand(ffmpegArgs);
      const processingTime = Date.now() - startTime;
      
      const metadata = await this.getVideoMetadata(outputFile);
      const outputUrls = await this.uploadResults([outputFile]);
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async extractAudio(payload: { inputUrl: string; format: 'mp3' | 'wav' | 'aac' }): Promise<string[]> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadVideo(payload.inputUrl, jobId);
      const outputFile = `${this.tempDir}/${jobId}_audio.${payload.format}`;
      
      const ffmpegArgs = [
        '-i', inputFile,
        '-vn', // No video
        '-acodec', this.getAudioCodec(payload.format),
        '-y', outputFile
      ];
      
      await this.executeFFmpegCommand(ffmpegArgs);
      const outputUrls = await this.uploadResults([outputFile]);
      
      await this.cleanupJobFiles(jobId);
      return outputUrls;
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async compressVideo(payload: VideoProcessingJob & { targetSize: number }): Promise<VideoProcessingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadVideo(payload.inputUrl, jobId);
      const outputFile = `${this.tempDir}/${jobId}_compressed.mp4`;
      
      // Calculate bitrate for target file size
      const metadata = await this.getVideoMetadata(inputFile);
      const targetBitrate = Math.floor((payload.targetSize * 8) / metadata.duration);
      
      const ffmpegArgs = [
        '-i', inputFile,
        '-c:v', 'libx264',
        '-b:v', `${targetBitrate}k`,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y', outputFile
      ];
      
      const startTime = Date.now();
      await this.executeFFmpegCommand(ffmpegArgs);
      const processingTime = Date.now() - startTime;
      
      const resultMetadata = await this.getVideoMetadata(outputFile);
      const outputUrls = await this.uploadResults([outputFile]);
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls,
        metadata: resultMetadata,
        processingTime
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  // Private helper methods
  private async verifyFFmpeg(): Promise<void> {
    try {
      const result = await this.makeRequest<string>('/ffmpeg/version');
      this.log('info', `FFmpeg verified: ${result}`);
    } catch (error) {
      throw new Error('FFmpeg not available in container');
    }
  }
  
  private async ensureTempDirectory(): Promise<void> {
    await this.makeRequest('/filesystem/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path: this.tempDir })
    });
  }
  
  private async startHttpServer(): Promise<void> {
    // Start the container's HTTP server for processing requests
    await this.makeRequest('/server/start', {
      method: 'POST',
      body: JSON.stringify({ port: this.config.defaultPort })
    });
  }
  
  private buildFFmpegConfig(job: VideoProcessingJob): string[] {
    const args: string[] = [];
    
    // Video codec and quality settings
    switch (job.quality) {
      case 'low':
        args.push('-crf', '28', '-preset', 'fast');
        break;
      case 'medium':
        args.push('-crf', '23', '-preset', 'medium');
        break;
      case 'high':
        args.push('-crf', '18', '-preset', 'slow');
        break;
      case 'ultra':
        args.push('-crf', '15', '-preset', 'slower');
        break;
    }
    
    // Resolution
    if (job.resolution) {
      args.push('-s', job.resolution);
    }
    
    // Bitrate
    if (job.bitrate) {
      args.push('-b:v', job.bitrate);
    }
    
    // Frame rate
    if (job.framerate) {
      args.push('-r', job.framerate.toString());
    }
    
    // Output format specific settings
    switch (job.outputFormat) {
      case 'webm':
        args.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus');
        break;
      case 'hls':
        args.push('-c:v', 'libx264', '-c:a', 'aac', '-hls_time', '10', '-hls_list_size', '0');
        break;
      default:
        args.push('-c:v', 'libx264', '-c:a', 'aac');
    }
    
    return args;
  }
  
  private getFileExtension(format: string): string {
    switch (format) {
      case 'hls': return 'm3u8';
      case 'thumbnail': return 'jpg';
      default: return format;
    }
  }
  
  private async downloadVideo(url: string, jobId: string): Promise<string> {
    const filename = `${this.tempDir}/${jobId}_input`;
    
    await this.makeRequest('/download/video', {
      method: 'POST',
      body: JSON.stringify({ url, output: filename })
    });
    
    return filename;
  }
  
  private async executeFFmpeg(input: string, output: string, config: string[]): Promise<void> {
    const args = ['-i', input, ...config, '-y', output];
    await this.executeFFmpegCommand(args);
  }
  
  private async executeFFmpegCommand(args: string[]): Promise<void> {
    const response = await this.makeRequest<{ success: boolean; output: string; error?: string }>('/ffmpeg/execute', {
      method: 'POST',
      body: JSON.stringify({ args })
    });
    
    if (!response.success) {
      throw new Error(`FFmpeg failed: ${response.error}`);
    }
  }
  
  private async getVideoMetadata(filePath: string): Promise<VideoAnalysisResult['metadata']> {
    return await this.makeRequest<VideoAnalysisResult['metadata']>('/ffprobe/metadata', {
      method: 'POST',
      body: JSON.stringify({ filePath })
    });
  }
  
  private async executeFFprobe(filePath: string): Promise<VideoAnalysisResult> {
    return await this.makeRequest<VideoAnalysisResult>('/ffprobe/analyze', {
      method: 'POST',
      body: JSON.stringify({ filePath })
    });
  }
  
  private async generateThumbnailsFromTimes(
    videoPath: string, 
    times: number[], 
    width?: number, 
    height?: number
  ): Promise<string[]> {
    const thumbnails = await this.makeRequest<string[]>('/thumbnails/generate', {
      method: 'POST',
      body: JSON.stringify({ videoPath, times, width, height })
    });
    
    return thumbnails;
  }
  
  private async detectScenes(filePath: string): Promise<VideoAnalysisResult['scenes']> {
    try {
      return await this.makeRequest<VideoAnalysisResult['scenes']>('/analysis/scenes', {
        method: 'POST',
        body: JSON.stringify({ filePath })
      });
    } catch (error) {
      this.log('warn', 'Scene detection failed, skipping', error);
      return undefined;
    }
  }
  
  private async buildWatermarkFilter(watermark: VideoProcessingJob['watermark']): Promise<string> {
    if (!watermark) throw new Error('Watermark config required');
    
    const response = await this.makeRequest<{ filter: string }>('/watermark/build-filter', {
      method: 'POST',
      body: JSON.stringify(watermark)
    });
    
    return response.filter;
  }
  
  private getAudioCodec(format: string): string {
    switch (format) {
      case 'mp3': return 'libmp3lame';
      case 'wav': return 'pcm_s16le';
      case 'aac': return 'aac';
      default: return 'aac';
    }
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
}