/**
 * MediaPublishingWorkflow - Media transcoding, optimization, and publishing
 * 
 * Features:
 * - Multi-format video transcoding (MP4, WebM, HLS)
 * - Adaptive bitrate streaming generation
 * - Image optimization and resizing
 * - CDN distribution and caching
 * - Thumbnail and preview generation
 * - Watermarking and DRM protection
 * - Progress tracking and notifications
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

// Media interfaces
interface MediaInput {
  sourceUrl: string;
  mediaType: 'video' | 'image' | 'audio' | 'document';
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  duration?: number; // for video/audio
  dimensions?: { width: number; height: number }; // for video/image
  metadata: {
    uploadedBy: string;
    projectId: string;
    pitchId?: string;
    accessLevel: 'public' | 'private' | 'restricted';
    tags: string[];
    description?: string;
  };
}

interface TranscodingProfile {
  name: string;
  format: 'mp4' | 'webm' | 'hls' | 'dash';
  video?: {
    codec: 'h264' | 'h265' | 'vp9' | 'av1';
    bitrate: number; // kbps
    resolution: string; // e.g., '1920x1080'
    framerate: number;
    profile: string; // e.g., 'main', 'high'
  };
  audio?: {
    codec: 'aac' | 'mp3' | 'opus';
    bitrate: number; // kbps
    sampleRate: number;
    channels: number;
  };
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

interface OptimizationConfig {
  enableWatermark: boolean;
  watermarkConfig?: {
    text?: string;
    imageUrl?: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity: number; // 0-1
  };
  enableDRM: boolean;
  drmConfig?: {
    provider: 'widevine' | 'fairplay' | 'playready';
    keyRotationInterval: number; // hours
  };
  generateThumbnails: boolean;
  thumbnailConfig?: {
    count: number;
    times: number[]; // seconds into video
    dimensions: { width: number; height: number }[];
  };
  generatePreviews: boolean;
  previewConfig?: {
    duration: number; // seconds
    startTime: number; // seconds
    quality: 'low' | 'medium' | 'high';
  };
}

interface PublishingConfig {
  destinations: PublishingDestination[];
  cdnConfig: {
    enableCaching: boolean;
    cacheTTL: number; // seconds
    purgeOnUpdate: boolean;
    enableCompression: boolean;
  };
  accessControl: {
    requireAuthentication: boolean;
    allowedDomains: string[];
    geoblocking?: {
      allowedCountries?: string[];
      blockedCountries?: string[];
    };
    tokenExpiration?: number; // seconds
  };
  analytics: {
    enableTracking: boolean;
    trackingProvider: 'cloudflare' | 'google' | 'custom';
  };
}

interface PublishingDestination {
  name: string;
  type: 'r2' | 'youtube' | 'vimeo' | 's3' | 'cdn';
  config: {
    bucket?: string;
    region?: string;
    credentials?: any;
    apiKey?: string;
    privacy?: 'public' | 'unlisted' | 'private';
  };
  priority: number; // 1 = highest
}

interface MediaOutput {
  originalUrl: string;
  transcodedVersions: TranscodedVersion[];
  thumbnails: ThumbnailOutput[];
  previews: PreviewOutput[];
  metadata: {
    totalSize: number;
    processingTime: number;
    qualityScore: number;
    compressionRatio: number;
  };
  publishedUrls: PublishedUrl[];
  streamingManifests?: {
    hlsUrl?: string;
    dashUrl?: string;
  };
}

interface TranscodedVersion {
  profile: string;
  format: string;
  url: string;
  fileSize: number;
  bitrate: number;
  resolution: string;
  duration?: number;
  checksum: string;
}

interface ThumbnailOutput {
  url: string;
  width: number;
  height: number;
  timestamp?: number; // for video thumbnails
  fileSize: number;
}

interface PreviewOutput {
  url: string;
  duration: number;
  fileSize: number;
  format: string;
}

interface PublishedUrl {
  destination: string;
  url: string;
  accessUrl?: string; // with authentication if required
  status: 'published' | 'failed' | 'pending';
}

interface WorkflowParams {
  input: MediaInput;
  profiles: TranscodingProfile[];
  optimization: OptimizationConfig;
  publishing: PublishingConfig;
  userId?: string;
  notificationWebhook?: string;
}

export class MediaPublishingWorkflow extends WorkflowEntrypoint<{}, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { input, profiles, optimization, publishing, userId } = event.payload;
    
    try {
      // Step 1: Validate and prepare input
      const validatedInput = await step.do("validate-input", async () => {
        console.log(`🎬 Starting media processing: ${input.originalFilename}`);
        console.log(`📁 Media type: ${input.mediaType}, Size: ${(input.fileSize / 1024 / 1024).toFixed(2)}MB`);
        
        await this.validateMediaInput(input);
        await this.downloadAndVerifySource(input.sourceUrl);
        
        return input;
      });
      
      // Step 2: Generate thumbnails and previews
      const visualAssets = await step.do("generate-visual-assets", async () => {
        if (input.mediaType === 'video' && optimization.generateThumbnails) {
          console.log(`📸 Generating thumbnails and previews`);
          return await this.generateVisualAssets(validatedInput, optimization);
        }
        return { thumbnails: [], previews: [] };
      });
      
      // Step 3: Transcode to multiple formats
      const transcodedVersions = await step.do("transcode-media", async () => {
        console.log(`🔄 Transcoding to ${profiles.length} profiles`);
        return await this.transcodeMedia(validatedInput, profiles, optimization);
      });
      
      // Step 4: Generate adaptive streaming manifests
      const streamingManifests = await step.do("generate-manifests", async () => {
        if (input.mediaType === 'video') {
          console.log(`📺 Generating streaming manifests`);
          return await this.generateStreamingManifests(transcodedVersions);
        }
        return undefined;
      });
      
      // Step 5: Optimize and apply post-processing
      const optimizedVersions = await step.do("optimize-media", async () => {
        console.log(`⚡ Optimizing media files`);
        return await this.optimizeMedia(transcodedVersions, optimization);
      });
      
      // Step 6: Publish to destinations
      const publishResults = await step.do("publish-media", async () => {
        console.log(`🚀 Publishing to ${publishing.destinations.length} destinations`);
        return await this.publishToDestinations(
          optimizedVersions,
          visualAssets,
          streamingManifests,
          publishing
        );
      });
      
      // Step 7: Setup CDN and caching
      const cdnConfig = await step.do("configure-cdn", async () => {
        if (publishing.cdnConfig.enableCaching) {
          console.log(`🌐 Configuring CDN and caching`);
          return await this.configureCDN(publishResults, publishing.cdnConfig);
        }
        return null;
      });
      
      // Step 8: Setup analytics and monitoring
      await step.do("setup-analytics", async () => {
        if (publishing.analytics.enableTracking) {
          console.log(`📊 Setting up analytics tracking`);
          await this.setupAnalytics(publishResults, publishing.analytics);
        }
      });
      
      // Step 9: Generate final output and cleanup
      const finalOutput = await step.do("finalize-output", async () => {
        const output: MediaOutput = {
          originalUrl: input.sourceUrl,
          transcodedVersions: optimizedVersions,
          thumbnails: visualAssets.thumbnails,
          previews: visualAssets.previews,
          metadata: {
            totalSize: optimizedVersions.reduce((sum, v) => sum + v.fileSize, 0),
            processingTime: Date.now(),
            qualityScore: this.calculateQualityScore(optimizedVersions),
            compressionRatio: this.calculateCompressionRatio(input.fileSize, optimizedVersions)
          },
          publishedUrls: publishResults,
          streamingManifests
        };
        
        // Cleanup temporary files
        await this.cleanupTempFiles(input.sourceUrl);
        
        console.log(`✅ Media processing completed: ${input.originalFilename}`);
        console.log(`📈 Compression ratio: ${output.metadata.compressionRatio.toFixed(2)}x`);
        console.log(`⭐ Quality score: ${output.metadata.qualityScore.toFixed(1)}/10`);
        
        return output;
      });
      
      // Step 10: Send completion notification
      await step.do("send-notification", async () => {
        await this.sendCompletionNotification(finalOutput, event.payload.notificationWebhook);
      });
      
      return finalOutput;
      
    } catch (error) {
      console.error(`❌ Media processing failed: ${input.originalFilename}`, error);
      
      await step.do("handle-failure", async () => {
        await this.sendErrorNotification(input, error as Error, event.payload.notificationWebhook);
        throw error;
      });
    }
  }
  
  private async validateMediaInput(input: MediaInput): Promise<void> {
    // Validate file size limits
    const maxSizes = {
      video: 5 * 1024 * 1024 * 1024, // 5GB
      image: 100 * 1024 * 1024, // 100MB
      audio: 1024 * 1024 * 1024, // 1GB
      document: 500 * 1024 * 1024 // 500MB
    };
    
    if (input.fileSize > maxSizes[input.mediaType]) {
      throw new Error(`File size exceeds limit for ${input.mediaType}: ${input.fileSize}`);
    }
    
    // Validate MIME type
    const allowedMimes = {
      video: ['video/mp4', 'video/webm', 'video/mov', 'video/avi'],
      image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      audio: ['audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg'],
      document: ['application/pdf', 'application/msword', 'text/plain']
    };
    
    if (!allowedMimes[input.mediaType].includes(input.mimeType)) {
      throw new Error(`Unsupported MIME type for ${input.mediaType}: ${input.mimeType}`);
    }
  }
  
  private async downloadAndVerifySource(sourceUrl: string): Promise<void> {
    try {
      const response = await fetch(sourceUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Source file not accessible: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Failed to verify source file: ${error}`);
    }
  }
  
  private async generateVisualAssets(
    input: MediaInput,
    optimization: OptimizationConfig
  ): Promise<{ thumbnails: ThumbnailOutput[]; previews: PreviewOutput[] }> {
    const thumbnails: ThumbnailOutput[] = [];
    const previews: PreviewOutput[] = [];
    
    if (optimization.generateThumbnails && optimization.thumbnailConfig) {
      const config = optimization.thumbnailConfig;
      
      for (let i = 0; i < config.count; i++) {
        for (const dimensions of config.dimensions) {
          // Simulate thumbnail generation
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const timestamp = config.times[i] || (input.duration! * i / config.count);
          const thumbnailUrl = `https://r2.bucket.dev/thumbnails/${input.metadata.projectId}/${Date.now()}_${dimensions.width}x${dimensions.height}.jpg`;
          
          thumbnails.push({
            url: thumbnailUrl,
            width: dimensions.width,
            height: dimensions.height,
            timestamp,
            fileSize: Math.floor(Math.random() * 50000 + 10000) // Simulate file size
          });
        }
      }
    }
    
    if (optimization.generatePreviews && optimization.previewConfig) {
      // Simulate preview generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const previewUrl = `https://r2.bucket.dev/previews/${input.metadata.projectId}/${Date.now()}_preview.mp4`;
      
      previews.push({
        url: previewUrl,
        duration: optimization.previewConfig.duration,
        fileSize: Math.floor(Math.random() * 5000000 + 1000000),
        format: 'mp4'
      });
    }
    
    return { thumbnails, previews };
  }
  
  private async transcodeMedia(
    input: MediaInput,
    profiles: TranscodingProfile[],
    optimization: OptimizationConfig
  ): Promise<TranscodedVersion[]> {
    const versions: TranscodedVersion[] = [];
    
    for (const profile of profiles) {
      console.log(`🔄 Transcoding to ${profile.name} (${profile.format})`);
      
      // Simulate transcoding time based on profile complexity
      const processingTime = this.estimateTranscodingTime(input, profile);
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      const outputUrl = `https://r2.bucket.dev/transcoded/${input.metadata.projectId}/${Date.now()}_${profile.name}.${profile.format}`;
      
      versions.push({
        profile: profile.name,
        format: profile.format,
        url: outputUrl,
        fileSize: this.estimateOutputSize(input.fileSize, profile),
        bitrate: profile.video?.bitrate || profile.audio?.bitrate || 0,
        resolution: profile.video?.resolution || '',
        duration: input.duration,
        checksum: this.generateChecksum()
      });
    }
    
    return versions;
  }
  
  private async generateStreamingManifests(
    versions: TranscodedVersion[]
  ): Promise<{ hlsUrl?: string; dashUrl?: string }> {
    const manifests: { hlsUrl?: string; dashUrl?: string } = {};
    
    // Generate HLS manifest if we have multiple bitrates
    const mp4Versions = versions.filter(v => v.format === 'mp4').sort((a, b) => b.bitrate - a.bitrate);
    
    if (mp4Versions.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      manifests.hlsUrl = `https://r2.bucket.dev/manifests/${Date.now()}/playlist.m3u8`;
    }
    
    // Generate DASH manifest if we have DASH profiles
    const dashVersions = versions.filter(v => v.format === 'dash');
    
    if (dashVersions.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      manifests.dashUrl = `https://r2.bucket.dev/manifests/${Date.now()}/manifest.mpd`;
    }
    
    return manifests;
  }
  
  private async optimizeMedia(
    versions: TranscodedVersion[],
    optimization: OptimizationConfig
  ): Promise<TranscodedVersion[]> {
    const optimizedVersions: TranscodedVersion[] = [];
    
    for (const version of versions) {
      console.log(`⚡ Optimizing ${version.profile}`);
      
      // Apply watermark if enabled
      let processedVersion = { ...version };
      
      if (optimization.enableWatermark && optimization.watermarkConfig) {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`🔖 Applying watermark to ${version.profile}`);
      }
      
      // Apply DRM if enabled
      if (optimization.enableDRM && optimization.drmConfig) {
        await new Promise(resolve => setTimeout(resolve, 800));
        console.log(`🔒 Applying DRM protection to ${version.profile}`);
        
        // Update file size to account for DRM overhead
        processedVersion.fileSize = Math.floor(processedVersion.fileSize * 1.05);
      }
      
      optimizedVersions.push(processedVersion);
    }
    
    return optimizedVersions;
  }
  
  private async publishToDestinations(
    versions: TranscodedVersion[],
    visualAssets: { thumbnails: ThumbnailOutput[]; previews: PreviewOutput[] },
    manifests?: { hlsUrl?: string; dashUrl?: string },
    publishing: PublishingConfig
  ): Promise<PublishedUrl[]> {
    const publishResults: PublishedUrl[] = [];
    
    // Sort destinations by priority
    const sortedDestinations = publishing.destinations.sort((a, b) => a.priority - b.priority);
    
    for (const destination of sortedDestinations) {
      console.log(`🚀 Publishing to ${destination.name} (${destination.type})`);
      
      try {
        const result = await this.publishToSingleDestination(
          destination,
          versions,
          visualAssets,
          manifests
        );
        
        publishResults.push({
          destination: destination.name,
          url: result.url,
          accessUrl: result.accessUrl,
          status: 'published'
        });
        
        console.log(`✅ Successfully published to ${destination.name}`);
        
      } catch (error) {
        console.error(`❌ Failed to publish to ${destination.name}:`, error);
        
        publishResults.push({
          destination: destination.name,
          url: '',
          status: 'failed'
        });
      }
    }
    
    return publishResults;
  }
  
  private async publishToSingleDestination(
    destination: PublishingDestination,
    versions: TranscodedVersion[],
    visualAssets: { thumbnails: ThumbnailOutput[]; previews: PreviewOutput[] },
    manifests?: { hlsUrl?: string; dashUrl?: string }
  ): Promise<{ url: string; accessUrl?: string }> {
    
    // Simulate publishing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    switch (destination.type) {
      case 'r2':
        return {
          url: `https://r2.bucket.dev/published/${destination.config.bucket}/${Date.now()}/`,
          accessUrl: `https://cdn.domain.com/published/${Date.now()}/`
        };
        
      case 'youtube':
        return {
          url: `https://youtube.com/watch?v=${this.generateYouTubeId()}`,
          accessUrl: `https://youtube.com/watch?v=${this.generateYouTubeId()}`
        };
        
      case 'vimeo':
        return {
          url: `https://vimeo.com/${Math.floor(Math.random() * 900000000 + 100000000)}`,
          accessUrl: `https://vimeo.com/${Math.floor(Math.random() * 900000000 + 100000000)}`
        };
        
      case 's3':
        return {
          url: `https://${destination.config.bucket}.s3.${destination.config.region}.amazonaws.com/${Date.now()}/`,
          accessUrl: `https://cdn.domain.com/s3/${Date.now()}/`
        };
        
      case 'cdn':
        return {
          url: `https://cdn.domain.com/media/${Date.now()}/`,
          accessUrl: `https://cdn.domain.com/media/${Date.now()}/`
        };
        
      default:
        throw new Error(`Unsupported destination type: ${destination.type}`);
    }
  }
  
  private async configureCDN(
    publishResults: PublishedUrl[],
    cdnConfig: PublishingConfig['cdnConfig']
  ): Promise<any> {
    console.log(`🌐 Configuring CDN with TTL: ${cdnConfig.cacheTTL}s`);
    
    // Simulate CDN configuration
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      cacheConfiguration: {
        ttl: cdnConfig.cacheTTL,
        compressionEnabled: cdnConfig.enableCompression,
        purgeOnUpdate: cdnConfig.purgeOnUpdate
      },
      endpoints: publishResults.map(result => ({
        origin: result.url,
        cached: result.accessUrl
      }))
    };
  }
  
  private async setupAnalytics(
    publishResults: PublishedUrl[],
    analytics: PublishingConfig['analytics']
  ): Promise<void> {
    if (!analytics.enableTracking) return;
    
    console.log(`📊 Setting up ${analytics.trackingProvider} analytics`);
    
    // Simulate analytics setup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Would integrate with actual analytics providers
  }
  
  private async cleanupTempFiles(sourceUrl: string): Promise<void> {
    console.log(`🧹 Cleaning up temporary files`);
    
    // Simulate cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  private calculateQualityScore(versions: TranscodedVersion[]): number {
    // Calculate quality score based on bitrates, compression efficiency, etc.
    const avgBitrate = versions.reduce((sum, v) => sum + v.bitrate, 0) / versions.length;
    return Math.min(10, Math.max(1, avgBitrate / 1000)); // Simplified calculation
  }
  
  private calculateCompressionRatio(originalSize: number, versions: TranscodedVersion[]): number {
    const totalCompressedSize = versions.reduce((sum, v) => sum + v.fileSize, 0);
    return originalSize / totalCompressedSize;
  }
  
  private estimateTranscodingTime(input: MediaInput, profile: TranscodingProfile): number {
    // Estimate transcoding time based on file size, duration, and profile complexity
    const baseTime = (input.fileSize / 1024 / 1024) * 100; // 100ms per MB
    const qualityMultiplier = { low: 0.5, medium: 1, high: 1.5, ultra: 2 }[profile.quality];
    return Math.floor(baseTime * qualityMultiplier);
  }
  
  private estimateOutputSize(originalSize: number, profile: TranscodingProfile): number {
    // Estimate output file size based on profile settings
    const compressionRatio = { low: 0.3, medium: 0.5, high: 0.7, ultra: 0.9 }[profile.quality];
    return Math.floor(originalSize * compressionRatio);
  }
  
  private generateChecksum(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  private generateYouTubeId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 11; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  private async sendCompletionNotification(output: MediaOutput, webhookUrl?: string): Promise<void> {
    if (!webhookUrl) return;
    
    console.log(`📧 Sending completion notification`);
    
    const notification = {
      event: 'media_processing_completed',
      data: {
        originalUrl: output.originalUrl,
        versionsCreated: output.transcodedVersions.length,
        thumbnailsCreated: output.thumbnails.length,
        totalSize: output.metadata.totalSize,
        qualityScore: output.metadata.qualityScore,
        compressionRatio: output.metadata.compressionRatio,
        publishedUrls: output.publishedUrls
      },
      timestamp: new Date().toISOString()
    };
    
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
      });
    } catch (error) {
      console.error('Failed to send completion notification:', error);
    }
  }
  
  private async sendErrorNotification(input: MediaInput, error: Error, webhookUrl?: string): Promise<void> {
    if (!webhookUrl) return;
    
    console.log(`📧 Sending error notification`);
    
    const notification = {
      event: 'media_processing_failed',
      data: {
        filename: input.originalFilename,
        mediaType: input.mediaType,
        error: error.message,
        sourceUrl: input.sourceUrl
      },
      timestamp: new Date().toISOString()
    };
    
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
      });
    } catch (error) {
      console.error('Failed to send error notification:', error);
    }
  }
}

export default MediaPublishingWorkflow;