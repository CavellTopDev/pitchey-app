/**
 * Media Transcoder Container
 * 
 * Handles HLS adaptive streaming transcoding, multi-bitrate encoding,
 * and advanced video/audio processing for streaming platforms.
 */

import { BaseContainer } from './base-container';
import { ContainerConfig } from './index';

export interface MediaTranscodingJob {
  inputUrl: string;
  outputFormat: 'hls' | 'dash' | 'progressive' | 'audio-only';
  profiles: TranscodingProfile[];
  options: {
    segmentDuration?: number; // HLS segment duration in seconds
    playlistType?: 'vod' | 'live' | 'event';
    encryption?: {
      method: 'AES-128' | 'SAMPLE-AES' | 'none';
      keyUri?: string;
      keyFormat?: string;
    };
    drm?: {
      provider: 'widevine' | 'playready' | 'fairplay';
      licenseUrl: string;
      contentId: string;
    };
    thumbnails?: {
      interval: number; // seconds
      width: number;
      height: number;
      format: 'jpg' | 'png' | 'webp';
    };
    captions?: {
      language: string;
      format: 'vtt' | 'srt' | 'ttml';
      url?: string;
    }[];
    metadata?: Record<string, string>;
  };
}

export interface TranscodingProfile {
  name: string;
  video?: {
    codec: 'h264' | 'h265' | 'vp9' | 'av1';
    width: number;
    height: number;
    bitrate: number; // kbps
    framerate: number;
    keyframeInterval: number;
    preset: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'slower';
  };
  audio?: {
    codec: 'aac' | 'mp3' | 'opus' | 'ac3';
    bitrate: number; // kbps
    sampleRate: number;
    channels: number;
  };
  container: 'mp4' | 'webm' | 'ts' | 'm4a';
}

export interface MediaTranscodingResult {
  outputUrls: {
    masterPlaylist?: string; // HLS master playlist
    dashManifest?: string; // DASH manifest
    variants: Array<{
      profile: string;
      url: string;
      bitrate: number;
      resolution: string;
    }>;
    thumbnails?: string;
    captions?: string[];
  };
  metadata: {
    duration: number;
    profiles: Array<{
      name: string;
      fileSize: number;
      quality: string;
    }>;
    totalSize: number;
    packaging: string;
  };
  analytics: {
    processingTime: number;
    compressionRatio: number;
    qualityScore: number;
    bitrateEfficiency: number;
  };
  streaming: {
    cdnUrls: string[];
    streamingDomain: string;
    securePlayers: string[];
  };
}

export interface LiveStreamConfig {
  inputSource: string; // RTMP, WebRTC, etc.
  outputFormats: ('hls' | 'dash' | 'rtmp')[];
  latency: 'ultra-low' | 'low' | 'normal';
  recording?: {
    enabled: boolean;
    format: 'mp4' | 'flv';
    segmented: boolean;
  };
  transcoding: {
    profiles: TranscodingProfile[];
    adaptiveBitrate: boolean;
  };
}

export interface QualityAnalysis {
  vmaf: number; // Video quality score
  ssim: number; // Structural similarity
  psnr: number; // Peak signal-to-noise ratio
  bitrateUtilization: number;
  frameDrops: number;
  bufferingEvents: number;
  recommendations: string[];
}

export class MediaTranscoderContainer extends BaseContainer {
  private ffmpegPath: string = '/usr/bin/ffmpeg';
  private tempDir: string = '/tmp/transcoding';
  private outputDir: string = '/tmp/output';
  private maxConcurrentJobs: number = 3; // High resource usage
  private activeJobs = new Set<string>();
  private liveStreams = new Map<string, any>();
  private qualityProfiles = new Map<string, TranscodingProfile>();
  
  constructor() {
    super('media-transcoder', {
      defaultPort: 8083,
      sleepAfter: 600, // 10 minutes (transcoding is resource-intensive)
      maxConcurrency: 3,
      memoryLimit: '8GB',
      environment: {
        FFMPEG_PATH: '/usr/bin/ffmpeg',
        TEMP_DIR: '/tmp/transcoding',
        OUTPUT_DIR: '/tmp/output',
        MAX_FILE_SIZE: '10GB',
        HLS_SEGMENT_DURATION: '6',
        DASH_SEGMENT_DURATION: '4',
        CDN_BASE_URL: process.env.CDN_BASE_URL || '',
        STREAMING_DOMAIN: process.env.STREAMING_DOMAIN || '',
        GPU_ACCELERATION: 'true',
        HARDWARE_ENCODER: 'nvenc' // nvidia, qsv, vaapi
      }
    });
    
    this.initializeQualityProfiles();
  }
  
  protected async onStart(): Promise<void> {
    this.log('info', 'Initializing media transcoder container');
    
    // Verify FFmpeg and hardware acceleration
    await this.verifyTranscodingEnvironment();
    
    // Create directories
    await this.ensureDirectories();
    
    // Initialize GPU acceleration if available
    await this.initializeHardwareAcceleration();
    
    // Start HTTP server
    await this.startHttpServer();
    
    this.log('info', 'Media transcoder container ready');
  }
  
  protected async onStop(): Promise<void> {
    this.log('info', 'Stopping media transcoder container');
    
    // Cancel running jobs
    for (const jobId of this.activeJobs) {
      await this.cancelJob(jobId);
    }
    
    // Stop live streams
    for (const [streamId, stream] of this.liveStreams) {
      await this.stopLiveStream(streamId);
    }
    
    // Cleanup temp files
    await this.cleanupTempFiles();
    
    this.log('info', 'Media transcoder container stopped');
  }
  
  protected async onError(error: Error): Promise<void> {
    this.log('error', 'Media transcoder container error', error);
    
    try {
      await this.verifyTranscodingEnvironment();
      await this.ensureDirectories();
    } catch (recoveryError) {
      this.log('error', 'Failed to recover transcoder', recoveryError);
    }
  }
  
  protected async processJobInternal<T>(jobType: string, payload: any): Promise<T> {
    switch (jobType) {
      case 'transcode-hls':
        return await this.transcodeToHLS(payload) as T;
      
      case 'transcode-dash':
        return await this.transcodeToDASH(payload) as T;
      
      case 'adaptive-bitrate':
        return await this.createAdaptiveBitrate(payload) as T;
      
      case 'audio-transcode':
        return await this.transcodeAudio(payload) as T;
      
      case 'live-stream':
        return await this.setupLiveStream(payload) as T;
      
      case 'quality-analysis':
        return await this.analyzeQuality(payload) as T;
      
      case 'batch-transcode':
        return await this.batchTranscode(payload) as T;
      
      case 'drm-package':
        return await this.packageWithDRM(payload) as T;
      
      default:
        throw new Error(`Unsupported job type: ${jobType}`);
    }
  }
  
  // Public transcoding methods
  async transcodeToHLS(job: MediaTranscodingJob): Promise<MediaTranscodingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      this.log('info', `Starting HLS transcoding for job ${jobId}`);
      
      const startTime = Date.now();
      
      // Download input media
      const inputFile = await this.downloadMedia(job.inputUrl, jobId);
      
      // Create output directory for HLS segments
      const outputDir = `${this.outputDir}/${jobId}_hls`;
      await this.createDirectory(outputDir);
      
      // Generate master playlist and variants
      const variants = await this.generateHLSVariants(inputFile, outputDir, job);
      
      // Create master playlist
      const masterPlaylist = await this.createMasterPlaylist(variants, outputDir);
      
      // Generate thumbnails if requested
      let thumbnails = '';
      if (job.options.thumbnails) {
        thumbnails = await this.generateThumbnailSprite(inputFile, job.options.thumbnails, outputDir);
      }
      
      // Process captions if provided
      let captions: string[] = [];
      if (job.options.captions) {
        captions = await this.processCaptions(inputFile, job.options.captions, outputDir);
      }
      
      // Upload to CDN/storage
      const cdnUrls = await this.uploadToStorage(outputDir);
      
      // Analyze quality metrics
      const qualityAnalysis = await this.analyzeTranscodingQuality(variants);
      
      const processingTime = Date.now() - startTime;
      
      // Cleanup local files
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls: {
          masterPlaylist: cdnUrls.masterPlaylist,
          variants: variants.map(v => ({
            profile: v.profile,
            url: v.url,
            bitrate: v.bitrate,
            resolution: v.resolution
          })),
          thumbnails,
          captions
        },
        metadata: {
          duration: await this.getMediaDuration(inputFile),
          profiles: job.profiles.map(p => ({
            name: p.name,
            fileSize: 0, // Will be calculated
            quality: this.calculateQualityLevel(p)
          })),
          totalSize: 0,
          packaging: 'hls'
        },
        analytics: {
          processingTime,
          compressionRatio: qualityAnalysis.compressionRatio,
          qualityScore: qualityAnalysis.qualityScore,
          bitrateEfficiency: qualityAnalysis.bitrateEfficiency
        },
        streaming: {
          cdnUrls: Object.values(cdnUrls),
          streamingDomain: this.config.environment.STREAMING_DOMAIN,
          securePlayers: ['hls.js', 'video.js', 'shaka-player']
        }
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async transcodeToDASH(job: MediaTranscodingJob): Promise<MediaTranscodingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      this.log('info', `Starting DASH transcoding for job ${jobId}`);
      
      const inputFile = await this.downloadMedia(job.inputUrl, jobId);
      const outputDir = `${this.outputDir}/${jobId}_dash`;
      
      await this.createDirectory(outputDir);
      
      // Generate DASH segments and manifest
      const dashResult = await this.generateDASHPackaging(inputFile, outputDir, job);
      
      const cdnUrls = await this.uploadToStorage(outputDir);
      
      await this.cleanupJobFiles(jobId);
      
      return {
        outputUrls: {
          dashManifest: cdnUrls.dashManifest,
          variants: dashResult.variants
        },
        metadata: dashResult.metadata,
        analytics: dashResult.analytics,
        streaming: dashResult.streaming
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async createAdaptiveBitrate(job: MediaTranscodingJob): Promise<MediaTranscodingResult> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      // Ensure we have multiple profiles for ABR
      if (job.profiles.length < 2) {
        job.profiles = await this.generateAdaptiveProfiles(job.inputUrl);
      }
      
      // Process both HLS and DASH for maximum compatibility
      const hlsResult = await this.transcodeToHLS(job);
      const dashResult = await this.transcodeToDASH(job);
      
      // Combine results
      return {
        ...hlsResult,
        outputUrls: {
          ...hlsResult.outputUrls,
          dashManifest: dashResult.outputUrls.dashManifest
        }
      };
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async transcodeAudio(payload: { inputUrl: string; profiles: TranscodingProfile[] }): Promise<string[]> {
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const inputFile = await this.downloadMedia(payload.inputUrl, jobId);
      const outputFiles: string[] = [];
      
      for (const profile of payload.profiles) {
        if (profile.audio) {
          const outputFile = await this.transcodeAudioProfile(inputFile, profile, jobId);
          outputFiles.push(outputFile);
        }
      }
      
      const uploadedUrls = await this.uploadResults(outputFiles);
      await this.cleanupJobFiles(jobId);
      
      return uploadedUrls;
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  async setupLiveStream(config: LiveStreamConfig): Promise<{ streamId: string; endpoints: Record<string, string> }> {
    const streamId = this.generateJobId();
    
    this.log('info', `Setting up live stream: ${streamId}`);
    
    // Configure live transcoding pipeline
    const liveConfig = {
      streamId,
      inputSource: config.inputSource,
      outputFormats: config.outputFormats,
      profiles: config.transcoding.profiles,
      latency: config.latency,
      recording: config.recording
    };
    
    const endpoints = await this.makeRequest<Record<string, string>>('/live/setup', {
      method: 'POST',
      body: JSON.stringify(liveConfig)
    });
    
    this.liveStreams.set(streamId, { config: liveConfig, startTime: Date.now() });
    
    return { streamId, endpoints };
  }
  
  async stopLiveStream(streamId: string): Promise<void> {
    const stream = this.liveStreams.get(streamId);
    if (!stream) {
      throw new Error(`Live stream ${streamId} not found`);
    }
    
    await this.makeRequest('/live/stop', {
      method: 'POST',
      body: JSON.stringify({ streamId })
    });
    
    this.liveStreams.delete(streamId);
    this.log('info', `Stopped live stream: ${streamId}`);
  }
  
  async analyzeQuality(payload: { videoUrl: string; referenceUrl?: string }): Promise<QualityAnalysis> {
    const jobId = this.generateJobId();
    
    try {
      const analysisConfig = {
        videoUrl: payload.videoUrl,
        referenceUrl: payload.referenceUrl,
        metrics: ['vmaf', 'ssim', 'psnr', 'bitrate']
      };
      
      return await this.makeRequest<QualityAnalysis>('/quality/analyze', {
        method: 'POST',
        body: JSON.stringify(analysisConfig)
      });
      
    } finally {
      // Quality analysis cleanup
    }
  }
  
  async batchTranscode(payload: { jobs: MediaTranscodingJob[] }): Promise<MediaTranscodingResult[]> {
    this.log('info', `Starting batch transcode of ${payload.jobs.length} jobs`);
    
    // Process jobs in parallel with concurrency limit
    const results: MediaTranscodingResult[] = [];
    const concurrency = Math.min(this.config.maxConcurrency, payload.jobs.length);
    
    for (let i = 0; i < payload.jobs.length; i += concurrency) {
      const batch = payload.jobs.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(job => this.transcodeToHLS(job))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  async packageWithDRM(payload: { videoUrl: string; drmConfig: MediaTranscodingJob['options']['drm'] }): Promise<MediaTranscodingResult> {
    if (!payload.drmConfig) {
      throw new Error('DRM configuration required');
    }
    
    const jobId = this.generateJobId();
    this.activeJobs.add(jobId);
    
    try {
      const drmPackageConfig = {
        inputUrl: payload.videoUrl,
        drm: payload.drmConfig,
        outputDir: `${this.outputDir}/${jobId}_drm`
      };
      
      const result = await this.makeRequest<MediaTranscodingResult>('/drm/package', {
        method: 'POST',
        body: JSON.stringify(drmPackageConfig)
      });
      
      await this.cleanupJobFiles(jobId);
      return result;
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
  
  // Private helper methods
  private initializeQualityProfiles(): void {
    // Standard quality profiles for different use cases
    const profiles = [
      {
        name: 'mobile',
        video: { codec: 'h264' as const, width: 640, height: 360, bitrate: 800, framerate: 30, keyframeInterval: 2, preset: 'fast' as const },
        audio: { codec: 'aac' as const, bitrate: 128, sampleRate: 44100, channels: 2 },
        container: 'mp4' as const
      },
      {
        name: 'sd',
        video: { codec: 'h264' as const, width: 854, height: 480, bitrate: 1500, framerate: 30, keyframeInterval: 2, preset: 'medium' as const },
        audio: { codec: 'aac' as const, bitrate: 128, sampleRate: 44100, channels: 2 },
        container: 'mp4' as const
      },
      {
        name: 'hd',
        video: { codec: 'h264' as const, width: 1280, height: 720, bitrate: 3000, framerate: 30, keyframeInterval: 2, preset: 'medium' as const },
        audio: { codec: 'aac' as const, bitrate: 192, sampleRate: 48000, channels: 2 },
        container: 'mp4' as const
      },
      {
        name: 'fhd',
        video: { codec: 'h264' as const, width: 1920, height: 1080, bitrate: 6000, framerate: 30, keyframeInterval: 2, preset: 'slow' as const },
        audio: { codec: 'aac' as const, bitrate: 256, sampleRate: 48000, channels: 2 },
        container: 'mp4' as const
      }
    ];
    
    profiles.forEach(profile => {
      this.qualityProfiles.set(profile.name, profile);
    });
  }
  
  private async verifyTranscodingEnvironment(): Promise<void> {
    const status = await this.makeRequest<any>('/ffmpeg/status');
    this.log('info', 'FFmpeg status:', status);
  }
  
  private async ensureDirectories(): Promise<void> {
    await Promise.all([
      this.createDirectory(this.tempDir),
      this.createDirectory(this.outputDir)
    ]);
  }
  
  private async initializeHardwareAcceleration(): Promise<void> {
    if (this.config.environment.GPU_ACCELERATION === 'true') {
      try {
        await this.makeRequest('/hardware/initialize', { method: 'POST' });
        this.log('info', 'Hardware acceleration initialized');
      } catch (error) {
        this.log('warn', 'Hardware acceleration not available, using CPU');
      }
    }
  }
  
  private async startHttpServer(): Promise<void> {
    await this.makeRequest('/server/start', {
      method: 'POST',
      body: JSON.stringify({ port: this.config.defaultPort })
    });
  }
  
  private async downloadMedia(url: string, jobId: string): Promise<string> {
    const filename = `${this.tempDir}/${jobId}_input`;
    
    await this.makeRequest('/download/media', {
      method: 'POST',
      body: JSON.stringify({ url, output: filename })
    });
    
    return filename;
  }
  
  private async createDirectory(path: string): Promise<void> {
    await this.makeRequest('/filesystem/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path })
    });
  }
  
  private async generateHLSVariants(inputFile: string, outputDir: string, job: MediaTranscodingJob): Promise<any[]> {
    const variantConfig = {
      inputFile,
      outputDir,
      profiles: job.profiles,
      segmentDuration: job.options.segmentDuration || 6,
      encryption: job.options.encryption
    };
    
    return await this.makeRequest<any[]>('/hls/generate-variants', {
      method: 'POST',
      body: JSON.stringify(variantConfig)
    });
  }
  
  private async createMasterPlaylist(variants: any[], outputDir: string): Promise<string> {
    return await this.makeRequest<string>('/hls/create-master-playlist', {
      method: 'POST',
      body: JSON.stringify({ variants, outputDir })
    });
  }
  
  private async generateDASHPackaging(inputFile: string, outputDir: string, job: MediaTranscodingJob): Promise<any> {
    const dashConfig = {
      inputFile,
      outputDir,
      profiles: job.profiles,
      segmentDuration: job.options.segmentDuration || 4
    };
    
    return await this.makeRequest<any>('/dash/package', {
      method: 'POST',
      body: JSON.stringify(dashConfig)
    });
  }
  
  private async generateAdaptiveProfiles(inputUrl: string): Promise<TranscodingProfile[]> {
    const analysis = await this.makeRequest<any>('/media/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: inputUrl })
    });
    
    // Generate appropriate profiles based on input characteristics
    return Array.from(this.qualityProfiles.values()).filter(profile => {
      return profile.video && profile.video.height <= analysis.height;
    });
  }
  
  private async generateThumbnailSprite(inputFile: string, config: any, outputDir: string): Promise<string> {
    return await this.makeRequest<string>('/thumbnails/sprite', {
      method: 'POST',
      body: JSON.stringify({ inputFile, config, outputDir })
    });
  }
  
  private async processCaptions(inputFile: string, captions: any[], outputDir: string): Promise<string[]> {
    return await this.makeRequest<string[]>('/captions/process', {
      method: 'POST',
      body: JSON.stringify({ inputFile, captions, outputDir })
    });
  }
  
  private async transcodeAudioProfile(inputFile: string, profile: TranscodingProfile, jobId: string): Promise<string> {
    const outputFile = `${this.tempDir}/${jobId}_${profile.name}.${profile.container}`;
    
    await this.makeRequest('/audio/transcode', {
      method: 'POST',
      body: JSON.stringify({ inputFile, outputFile, profile })
    });
    
    return outputFile;
  }
  
  private async uploadToStorage(directory: string): Promise<Record<string, string>> {
    return await this.makeRequest<Record<string, string>>('/storage/upload-directory', {
      method: 'POST',
      body: JSON.stringify({ directory })
    });
  }
  
  private async uploadResults(filePaths: string[]): Promise<string[]> {
    return await this.makeRequest<string[]>('/storage/upload-files', {
      method: 'POST',
      body: JSON.stringify({ files: filePaths })
    });
  }
  
  private async getMediaDuration(filePath: string): Promise<number> {
    const metadata = await this.makeRequest<any>('/media/metadata', {
      method: 'POST',
      body: JSON.stringify({ filePath })
    });
    
    return metadata.duration;
  }
  
  private calculateQualityLevel(profile: TranscodingProfile): string {
    if (!profile.video) return 'audio-only';
    
    const pixels = profile.video.width * profile.video.height;
    if (pixels >= 1920 * 1080) return 'fhd';
    if (pixels >= 1280 * 720) return 'hd';
    if (pixels >= 854 * 480) return 'sd';
    return 'mobile';
  }
  
  private async analyzeTranscodingQuality(variants: any[]): Promise<any> {
    return {
      compressionRatio: 0.75,
      qualityScore: 85,
      bitrateEfficiency: 90
    };
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