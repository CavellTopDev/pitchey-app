import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

/**
 * Video Infrastructure Service
 * Handles video uploads, transcoding, streaming, and analytics
 */

export interface VideoAsset {
  id: string;
  pitchId: string;
  userId: string;
  type: 'trailer' | 'pitch' | 'demo' | 'behind_scenes' | 'sizzle_reel';
  title: string;
  description?: string;
  originalUrl: string;
  transcodedUrls: TranscodedVideo[];
  thumbnailUrl?: string;
  duration: number; // seconds
  fileSize: number; // bytes
  format: string;
  resolution: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed' | 'deleted';
  metadata: VideoMetadata;
  analytics: VideoAnalytics;
  createdAt: Date;
  processedAt?: Date;
}

export interface TranscodedVideo {
  quality: '360p' | '480p' | '720p' | '1080p' | '4k';
  url: string;
  bitrate: number;
  fileSize: number;
  codec: string;
  format: string;
}

export interface VideoMetadata {
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
  audioCodec?: string;
  audioBitrate?: number;
  chapters?: VideoChapter[];
  subtitles?: SubtitleTrack[];
  tags?: string[];
}

export interface VideoChapter {
  title: string;
  startTime: number;
  endTime: number;
  thumbnailUrl?: string;
}

export interface SubtitleTrack {
  language: string;
  url: string;
  type: 'vtt' | 'srt';
  isDefault: boolean;
}

export interface VideoAnalytics {
  views: number;
  uniqueViewers: number;
  totalWatchTime: number; // seconds
  averageWatchTime: number;
  completionRate: number; // percentage
  engagement: EngagementMetrics;
  heatmap?: number[]; // Watch position histogram
}

export interface EngagementMetrics {
  likes: number;
  shares: number;
  comments: number;
  bookmarks: number;
}

export interface StreamingSession {
  id: string;
  videoId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  watchedDuration: number;
  bufferingEvents: number;
  qualityChanges: QualityChange[];
  seekEvents: SeekEvent[];
  ipAddress?: string;
  userAgent?: string;
  location?: string;
}

export interface QualityChange {
  timestamp: Date;
  fromQuality: string;
  toQuality: string;
  reason: 'manual' | 'auto_bandwidth' | 'auto_buffer';
}

export interface SeekEvent {
  timestamp: Date;
  fromPosition: number;
  toPosition: number;
}

export interface UploadProgress {
  videoId: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  estimatedTimeRemaining: number; // seconds
  uploadSpeed: number; // bytes per second
}

export class VideoService {
  private db: Client;
  private cdnBaseUrl: string;
  private transcodingApiUrl: string;
  private storageProvider: 'r2' | 's3' | 'cloudflare_stream';

  constructor(databaseUrl: string) {
    const url = new URL(databaseUrl);
    this.db = new Client({
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      hostname: url.hostname,
      port: parseInt(url.port || "5432"),
      tls: {
        enabled: url.searchParams.get("sslmode") === "require",
      },
    });

    // Configure CDN and storage
    this.cdnBaseUrl = Deno.env.get("CDN_BASE_URL") || "https://cdn.pitchey.com";
    this.transcodingApiUrl = Deno.env.get("TRANSCODING_API_URL") || "https://api.cloudflare.com/stream";
    this.storageProvider = (Deno.env.get("VIDEO_STORAGE_PROVIDER") as any) || 'cloudflare_stream';
  }

  async connect() {
    await this.db.connect();
  }

  async disconnect() {
    await this.db.end();
  }

  /**
   * Initialize video upload
   */
  async initializeUpload(
    userId: string,
    pitchId: string,
    metadata: {
      title: string;
      type: VideoAsset['type'];
      description?: string;
      fileSize: number;
      format: string;
    }
  ): Promise<{ videoId: string; uploadUrl: string }> {
    try {
      const videoId = crypto.randomUUID();

      // Create video record
      await this.db.queryObject(`
        INSERT INTO video_assets (
          id, pitch_id, user_id, type, title, description,
          file_size_bytes, format, status, created_at
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, 'uploading', NOW())
      `, [
        videoId,
        pitchId,
        userId,
        metadata.type,
        metadata.title,
        metadata.description,
        metadata.fileSize,
        metadata.format
      ]);

      // Generate upload URL based on provider
      const uploadUrl = await this.generateUploadUrl(videoId, metadata);

      // Log to audit
      await this.db.queryObject(`
        INSERT INTO audit_log (
          user_id, action, resource_type, resource_id, metadata
        )
        VALUES ($1::uuid, 'video_upload_initiated', 'video', $2::uuid, $3::jsonb)
      `, [
        userId,
        videoId,
        JSON.stringify({ pitch_id: pitchId, file_size: metadata.fileSize })
      ]);

      return { videoId, uploadUrl };
    } catch (error) {
      console.error("Error initializing upload:", error);
      throw error;
    }
  }

  /**
   * Generate presigned upload URL
   */
  private async generateUploadUrl(
    videoId: string,
    metadata: any
  ): Promise<string> {
    switch (this.storageProvider) {
      case 'cloudflare_stream':
        return await this.generateCloudflareStreamUrl(videoId, metadata);
      
      case 'r2':
        return await this.generateR2UploadUrl(videoId, metadata);
      
      case 's3':
        return await this.generateS3UploadUrl(videoId, metadata);
      
      default:
        throw new Error(`Unknown storage provider: ${this.storageProvider}`);
    }
  }

  /**
   * Generate Cloudflare Stream upload URL
   */
  private async generateCloudflareStreamUrl(
    videoId: string,
    metadata: any
  ): Promise<string> {
    try {
      const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
      const apiToken = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            maxDurationSeconds: 7200, // 2 hours max
            expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            requireSignedURLs: true,
            allowedOrigins: [Deno.env.get("FRONTEND_URL")],
            thumbnailTimestampPct: 0.25,
            watermark: {
              uid: Deno.env.get("CLOUDFLARE_WATERMARK_UID"),
            },
            meta: {
              videoId,
              name: metadata.title,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Cloudflare Stream error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.result.uploadURL;
    } catch (error) {
      console.error("Error generating Cloudflare Stream URL:", error);
      throw error;
    }
  }

  /**
   * Generate R2 presigned upload URL
   */
  private async generateR2UploadUrl(
    videoId: string,
    metadata: any
  ): Promise<string> {
    // Implementation for R2 presigned URLs
    const key = `videos/${videoId}/original.${metadata.format}`;
    // This would use AWS SDK or compatible library
    return `https://r2.pitchey.com/upload/${key}?presigned=true`;
  }

  /**
   * Generate S3 presigned upload URL
   */
  private async generateS3UploadUrl(
    videoId: string,
    metadata: any
  ): Promise<string> {
    // Implementation for S3 presigned URLs
    const key = `videos/${videoId}/original.${metadata.format}`;
    // This would use AWS SDK
    return `https://s3.amazonaws.com/pitchey-videos/upload/${key}?presigned=true`;
  }

  /**
   * Process uploaded video (transcoding, thumbnails, etc.)
   */
  async processVideo(videoId: string): Promise<void> {
    try {
      // Update status to processing
      await this.db.queryObject(`
        UPDATE video_assets
        SET status = 'processing',
            processing_started_at = NOW()
        WHERE id = $1::uuid
      `, [videoId]);

      // Get video details
      const video = await this.db.queryObject<any>(`
        SELECT * FROM video_assets WHERE id = $1::uuid
      `, [videoId]);

      if (!video.rows[0]) {
        throw new Error("Video not found");
      }

      // Extract metadata
      const metadata = await this.extractVideoMetadata(videoId);

      // Generate thumbnail
      const thumbnailUrl = await this.generateThumbnail(videoId, metadata);

      // Transcode video to multiple qualities
      const transcodedUrls = await this.transcodeVideo(videoId, metadata);

      // Update video record with processed data
      await this.db.queryObject(`
        UPDATE video_assets
        SET status = 'ready',
            processed_at = NOW(),
            duration_seconds = $1,
            resolution = $2,
            thumbnail_url = $3,
            metadata = $4::jsonb,
            transcoded_urls = $5::jsonb
        WHERE id = $6::uuid
      `, [
        metadata.duration,
        `${metadata.width}x${metadata.height}`,
        thumbnailUrl,
        JSON.stringify(metadata),
        JSON.stringify(transcodedUrls),
        videoId
      ]);

      // Initialize analytics
      await this.db.queryObject(`
        INSERT INTO video_analytics (
          id, video_id, views, unique_viewers, total_watch_time,
          average_watch_time, completion_rate
        )
        VALUES ($1::uuid, $2::uuid, 0, 0, 0, 0, 0)
      `, [crypto.randomUUID(), videoId]);

      // Send notification
      await this.notifyVideoReady(videoId);
    } catch (error) {
      console.error("Error processing video:", error);
      
      // Mark as failed
      await this.db.queryObject(`
        UPDATE video_assets
        SET status = 'failed',
            error_message = $1
        WHERE id = $2::uuid
      `, [error.message, videoId]);
      
      throw error;
    }
  }

  /**
   * Extract video metadata
   */
  private async extractVideoMetadata(videoId: string): Promise<VideoMetadata> {
    // This would use FFprobe or similar tool
    // For now, returning mock metadata
    return {
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      bitrate: 5000000,
      audioCodec: 'aac',
      audioBitrate: 128000,
    };
  }

  /**
   * Generate video thumbnail
   */
  private async generateThumbnail(
    videoId: string,
    metadata: VideoMetadata
  ): Promise<string> {
    if (this.storageProvider === 'cloudflare_stream') {
      // Cloudflare Stream auto-generates thumbnails
      return `${this.cdnBaseUrl}/videos/${videoId}/thumbnails/thumbnail.jpg`;
    }

    // For other providers, use FFmpeg or similar
    const thumbnailUrl = `${this.cdnBaseUrl}/videos/${videoId}/thumbnail.jpg`;
    
    // Generate thumbnail at 25% duration
    // This would use FFmpeg in production
    console.log(`Generating thumbnail for video ${videoId}`);
    
    return thumbnailUrl;
  }

  /**
   * Transcode video to multiple qualities
   */
  private async transcodeVideo(
    videoId: string,
    metadata: VideoMetadata
  ): Promise<TranscodedVideo[]> {
    const qualities = this.determineTranscodingQualities(metadata);
    const transcodedVideos: TranscodedVideo[] = [];

    for (const quality of qualities) {
      const transcoded = await this.transcodeToQuality(videoId, quality, metadata);
      transcodedVideos.push(transcoded);
    }

    return transcodedVideos;
  }

  /**
   * Determine which qualities to transcode to
   */
  private determineTranscodingQualities(
    metadata: VideoMetadata
  ): Array<'360p' | '480p' | '720p' | '1080p' | '4k'> {
    const qualities: Array<'360p' | '480p' | '720p' | '1080p' | '4k'> = ['360p', '480p'];

    if (metadata.height >= 720) qualities.push('720p');
    if (metadata.height >= 1080) qualities.push('1080p');
    if (metadata.height >= 2160) qualities.push('4k');

    return qualities;
  }

  /**
   * Transcode to specific quality
   */
  private async transcodeToQuality(
    videoId: string,
    quality: '360p' | '480p' | '720p' | '1080p' | '4k',
    metadata: VideoMetadata
  ): Promise<TranscodedVideo> {
    const qualitySettings = {
      '360p': { width: 640, height: 360, bitrate: 800000 },
      '480p': { width: 854, height: 480, bitrate: 1200000 },
      '720p': { width: 1280, height: 720, bitrate: 2500000 },
      '1080p': { width: 1920, height: 1080, bitrate: 5000000 },
      '4k': { width: 3840, height: 2160, bitrate: 15000000 },
    };

    const settings = qualitySettings[quality];
    
    // Store transcoded video info
    await this.db.queryObject(`
      INSERT INTO video_transcodes (
        id, video_id, quality, width, height, bitrate,
        codec, format, status, created_at
      )
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, 'completed', NOW())
    `, [
      crypto.randomUUID(),
      videoId,
      quality,
      settings.width,
      settings.height,
      settings.bitrate,
      'h264',
      'mp4'
    ]);

    return {
      quality,
      url: `${this.cdnBaseUrl}/videos/${videoId}/${quality}.mp4`,
      bitrate: settings.bitrate,
      fileSize: Math.round(metadata.width * metadata.height * 0.1), // Estimate
      codec: 'h264',
      format: 'mp4',
    };
  }

  /**
   * Stream video with adaptive bitrate
   */
  async getStreamingManifest(videoId: string, userId?: string): Promise<string> {
    try {
      // Get video and its transcoded versions
      const video = await this.db.queryObject<any>(`
        SELECT * FROM video_assets
        WHERE id = $1::uuid AND status = 'ready'
      `, [videoId]);

      if (!video.rows[0]) {
        throw new Error("Video not found or not ready");
      }

      // Track view if user is provided
      if (userId) {
        await this.trackVideoView(videoId, userId);
      }

      // Generate HLS manifest
      const manifest = this.generateHLSManifest(video.rows[0]);
      
      return manifest;
    } catch (error) {
      console.error("Error getting streaming manifest:", error);
      throw error;
    }
  }

  /**
   * Generate HLS manifest for adaptive streaming
   */
  private generateHLSManifest(video: any): string {
    const transcoded = JSON.parse(video.transcoded_urls || '[]');
    
    let manifest = '#EXTM3U\n';
    manifest += '#EXT-X-VERSION:3\n';
    
    for (const variant of transcoded) {
      const bandwidth = variant.bitrate;
      const resolution = this.getResolutionForQuality(variant.quality);
      
      manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}\n`;
      manifest += `${variant.url}\n`;
    }
    
    return manifest;
  }

  /**
   * Get resolution string for quality
   */
  private getResolutionForQuality(quality: string): string {
    const resolutions: Record<string, string> = {
      '360p': '640x360',
      '480p': '854x480',
      '720p': '1280x720',
      '1080p': '1920x1080',
      '4k': '3840x2160',
    };
    return resolutions[quality] || '640x360';
  }

  /**
   * Track video view
   */
  async trackVideoView(videoId: string, userId: string): Promise<void> {
    try {
      // Create viewing session
      const sessionId = crypto.randomUUID();
      
      await this.db.queryObject(`
        INSERT INTO video_viewing_sessions (
          id, video_id, user_id, started_at, last_heartbeat
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, NOW(), NOW())
      `, [sessionId, videoId, userId]);

      // Increment view count
      await this.db.queryObject(`
        UPDATE video_analytics
        SET views = views + 1,
            unique_viewers = (
              SELECT COUNT(DISTINCT user_id)
              FROM video_viewing_sessions
              WHERE video_id = $1::uuid
            )
        WHERE video_id = $1::uuid
      `, [videoId]);
    } catch (error) {
      console.error("Error tracking video view:", error);
    }
  }

  /**
   * Update video watch progress
   */
  async updateWatchProgress(
    sessionId: string,
    position: number,
    duration: number
  ): Promise<void> {
    try {
      await this.db.queryObject(`
        UPDATE video_viewing_sessions
        SET current_position = $1,
            watched_duration = $2,
            last_heartbeat = NOW()
        WHERE id = $3::uuid
      `, [position, duration, sessionId]);

      // Update analytics
      const session = await this.db.queryObject<any>(`
        SELECT video_id, watched_duration
        FROM video_viewing_sessions
        WHERE id = $1::uuid
      `, [sessionId]);

      if (session.rows[0]) {
        const completionRate = (position / duration) * 100;
        
        await this.db.queryObject(`
          UPDATE video_analytics
          SET total_watch_time = total_watch_time + $1,
              average_watch_time = (
                SELECT AVG(watched_duration)
                FROM video_viewing_sessions
                WHERE video_id = $2::uuid
              ),
              completion_rate = $3
          WHERE video_id = $2::uuid
        `, [session.rows[0].watched_duration, session.rows[0].video_id, completionRate]);
      }
    } catch (error) {
      console.error("Error updating watch progress:", error);
    }
  }

  /**
   * Get video analytics
   */
  async getVideoAnalytics(videoId: string): Promise<VideoAnalytics> {
    try {
      const analytics = await this.db.queryObject<any>(`
        SELECT * FROM video_analytics
        WHERE video_id = $1::uuid
      `, [videoId]);

      if (!analytics.rows[0]) {
        return {
          views: 0,
          uniqueViewers: 0,
          totalWatchTime: 0,
          averageWatchTime: 0,
          completionRate: 0,
          engagement: {
            likes: 0,
            shares: 0,
            comments: 0,
            bookmarks: 0,
          },
        };
      }

      // Get engagement metrics
      const engagement = await this.db.queryObject<any>(`
        SELECT 
          COUNT(CASE WHEN type = 'like' THEN 1 END) as likes,
          COUNT(CASE WHEN type = 'share' THEN 1 END) as shares,
          COUNT(CASE WHEN type = 'comment' THEN 1 END) as comments,
          COUNT(CASE WHEN type = 'bookmark' THEN 1 END) as bookmarks
        FROM video_engagements
        WHERE video_id = $1::uuid
      `, [videoId]);

      return {
        ...analytics.rows[0],
        engagement: engagement.rows[0] || {
          likes: 0,
          shares: 0,
          comments: 0,
          bookmarks: 0,
        },
      };
    } catch (error) {
      console.error("Error getting video analytics:", error);
      throw error;
    }
  }

  /**
   * Delete video
   */
  async deleteVideo(videoId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const video = await this.db.queryObject<any>(`
        SELECT user_id FROM video_assets
        WHERE id = $1::uuid
      `, [videoId]);

      if (!video.rows[0] || video.rows[0].user_id !== userId) {
        throw new Error("Unauthorized to delete this video");
      }

      // Soft delete
      await this.db.queryObject(`
        UPDATE video_assets
        SET status = 'deleted',
            deleted_at = NOW(),
            deleted_by = $1::uuid
        WHERE id = $2::uuid
      `, [userId, videoId]);

      // Clean up CDN/storage (async)
      this.cleanupVideoStorage(videoId).catch(console.error);

      // Log to audit
      await this.db.queryObject(`
        INSERT INTO audit_log (
          user_id, action, resource_type, resource_id, metadata
        )
        VALUES ($1::uuid, 'video_deleted', 'video', $2::uuid, $3::jsonb)
      `, [userId, videoId, JSON.stringify({ soft_delete: true })]);
    } catch (error) {
      console.error("Error deleting video:", error);
      throw error;
    }
  }

  /**
   * Clean up video storage
   */
  private async cleanupVideoStorage(videoId: string): Promise<void> {
    // This would delete from CDN/storage provider
    console.log(`Cleaning up storage for video ${videoId}`);
  }

  /**
   * Notify when video is ready
   */
  private async notifyVideoReady(videoId: string): Promise<void> {
    try {
      const video = await this.db.queryObject<any>(`
        SELECT v.*, u.id as user_id
        FROM video_assets v
        JOIN users u ON v.user_id = u.id
        WHERE v.id = $1::uuid
      `, [videoId]);

      if (video.rows[0]) {
        await this.db.queryObject(`
          INSERT INTO notifications (
            id, user_id, type, title, message, metadata
          )
          VALUES ($1::uuid, $2::uuid, 'video_ready', $3, $4, $5::jsonb)
        `, [
          crypto.randomUUID(),
          video.rows[0].user_id,
          'Video Processing Complete',
          `Your video "${video.rows[0].title}" is ready`,
          JSON.stringify({ video_id: videoId })
        ]);
      }
    } catch (error) {
      console.error("Error sending video ready notification:", error);
    }
  }
}