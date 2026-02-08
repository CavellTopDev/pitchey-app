import { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { VideoService } from "../services/video.service.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * Video Management Handlers
 * Handles video uploads, streaming, transcoding, and analytics
 */

// Validation schemas
const InitializeUploadSchema = z.object({
  pitchId: z.string().uuid(),
  title: z.string().min(1).max(200),
  type: z.enum(['trailer', 'pitch', 'sizzle', 'demo', 'behind_scenes', 'interview']),
  fileSize: z.number().positive().max(5 * 1024 * 1024 * 1024), // 5GB max
  format: z.string(),
  duration: z.number().positive().optional(),
  aspectRatio: z.string().optional(),
});

const CompleteUploadSchema = z.object({
  videoId: z.string().uuid(),
  uploadId: z.string(),
  parts: z.array(z.object({
    partNumber: z.number(),
    etag: z.string(),
  })).optional(),
});

const UpdateVideoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).optional(),
  thumbnailTimestamp: z.number().optional(),
});

const TranscodingSettingsSchema = z.object({
  qualities: z.array(z.enum(['360p', '480p', '720p', '1080p', '1440p', '4k'])),
  generateThumbnails: z.boolean().default(true),
  generatePreview: z.boolean().default(true),
  optimizeForStreaming: z.boolean().default(true),
});

export class VideoHandlers {
  private videoService: VideoService;

  constructor(databaseUrl: string) {
    this.videoService = new VideoService(databaseUrl);
  }

  async initialize() {
    await this.videoService.connect();
  }

  async cleanup() {
    await this.videoService.disconnect();
  }

  /**
   * POST /api/videos/upload/initialize
   * Initialize a video upload session
   */
  async initializeUpload(c: Context) {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const validated = InitializeUploadSchema.parse(body);

      // Check pitch ownership
      const pitch = await c.env.DB.prepare(`
        SELECT user_id, title FROM pitches WHERE id = ?
      `).bind(validated.pitchId).first();

      if (!pitch || pitch.user_id !== userId) {
        return c.json({ error: "Pitch not found or unauthorized" }, 404);
      }

      // Check upload limits based on subscription
      const user = await c.env.DB.prepare(`
        SELECT subscription_tier FROM users WHERE id = ?
      `).bind(userId).first();

      const limits = {
        free: { maxVideos: 1, maxSize: 100 * 1024 * 1024 }, // 100MB
        creator: { maxVideos: 5, maxSize: 1024 * 1024 * 1024 }, // 1GB
        pro: { maxVideos: 20, maxSize: 5 * 1024 * 1024 * 1024 }, // 5GB
        enterprise: { maxVideos: -1, maxSize: 10 * 1024 * 1024 * 1024 }, // 10GB
      };

      const userLimits = limits[user?.subscription_tier || 'free'];
      
      if (validated.fileSize > userLimits.maxSize) {
        return c.json({ 
          error: `File size exceeds limit of ${userLimits.maxSize / (1024 * 1024)}MB for ${user?.subscription_tier || 'free'} tier` 
        }, 400);
      }

      // Count existing videos
      if (userLimits.maxVideos !== -1) {
        const videoCount = await c.env.DB.prepare(`
          SELECT COUNT(*) as count FROM videos 
          WHERE pitch_id = ? AND status != 'deleted'
        `).bind(validated.pitchId).first();

        if (videoCount.count >= userLimits.maxVideos) {
          return c.json({ 
            error: `Video limit reached (${userLimits.maxVideos} videos for ${user?.subscription_tier || 'free'} tier)` 
          }, 400);
        }
      }

      // Initialize upload
      const result = await this.videoService.initializeUpload(
        userId,
        validated.pitchId,
        {
          title: validated.title,
          type: validated.type,
          fileSize: validated.fileSize,
          format: validated.format,
        }
      );

      return c.json({
        success: true,
        ...result,
        maxPartSize: 5 * 1024 * 1024, // 5MB parts for multipart
      });
    } catch (error) {
      console.error("Error initializing upload:", error);
      return c.json({ error: "Failed to initialize upload" }, 500);
    }
  }

  /**
   * POST /api/videos/upload/complete
   * Complete a multipart upload
   */
  async completeUpload(c: Context) {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const validated = CompleteUploadSchema.parse(body);

      // Verify ownership
      const video = await c.env.DB.prepare(`
        SELECT v.*, p.user_id 
        FROM videos v
        JOIN pitches p ON v.pitch_id = p.id
        WHERE v.id = ? AND p.user_id = ?
      `).bind(validated.videoId, userId).first();

      if (!video) {
        return c.json({ error: "Video not found or unauthorized" }, 404);
      }

      // Complete upload based on provider
      if (video.storage_provider === 'cloudflare-stream') {
        await this.completeCloudflareUpload(validated.videoId, validated.uploadId);
      } else if (video.storage_provider === 'r2' || video.storage_provider === 's3') {
        await this.completeMultipartUpload(
          validated.videoId, 
          validated.uploadId,
          validated.parts || []
        );
      }

      // Update video status
      await c.env.DB.prepare(`
        UPDATE videos 
        SET status = 'processing',
            upload_completed_at = datetime('now')
        WHERE id = ?
      `).bind(validated.videoId).run();

      // Trigger transcoding
      await this.videoService.transcodeVideo(validated.videoId);

      return c.json({
        success: true,
        message: "Upload completed, processing video",
        videoId: validated.videoId,
      });
    } catch (error) {
      console.error("Error completing upload:", error);
      return c.json({ error: "Failed to complete upload" }, 500);
    }
  }

  /**
   * GET /api/videos/:id
   * Get video details
   */
  async getVideo(c: Context) {
    try {
      const videoId = c.req.param('id');
      const userId = c.get('userId');

      const video = await c.env.DB.prepare(`
        SELECT 
          v.*,
          p.title as pitch_title,
          p.user_id,
          u.name as creator_name,
          COUNT(DISTINCT vv.id) as view_count,
          AVG(vv.watch_duration) as avg_watch_duration
        FROM videos v
        JOIN pitches p ON v.pitch_id = p.id
        JOIN users u ON p.user_id = u.id
        LEFT JOIN video_views vv ON v.id = vv.video_id
        WHERE v.id = ?
        GROUP BY v.id
      `).bind(videoId).first();

      if (!video) {
        return c.json({ error: "Video not found" }, 404);
      }

      // Check access rights
      const hasAccess = video.visibility === 'public' ||
                       video.user_id === userId ||
                       await this.checkVideoAccess(videoId, userId, c.env.DB);

      if (!hasAccess) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      // Get video qualities
      const qualities = await c.env.DB.prepare(`
        SELECT * FROM video_qualities
        WHERE video_id = ?
        ORDER BY height DESC
      `).bind(videoId).all();

      // Record view
      if (userId !== video.user_id) {
        await this.videoService.recordView(videoId, userId, {
          referrer: c.req.header('Referer'),
          userAgent: c.req.header('User-Agent'),
        });
      }

      return c.json({
        video: {
          ...video,
          qualities: qualities.results || [],
        },
      });
    } catch (error) {
      console.error("Error getting video:", error);
      return c.json({ error: "Failed to get video" }, 500);
    }
  }

  /**
   * GET /api/videos/:id/stream
   * Get video streaming URL
   */
  async getStreamUrl(c: Context) {
    try {
      const videoId = c.req.param('id');
      const userId = c.get('userId');
      const { quality = 'auto' } = c.req.query();

      // Check access
      const video = await c.env.DB.prepare(`
        SELECT v.*, p.user_id 
        FROM videos v
        JOIN pitches p ON v.pitch_id = p.id
        WHERE v.id = ?
      `).bind(videoId).first();

      if (!video) {
        return c.json({ error: "Video not found" }, 404);
      }

      const hasAccess = video.visibility === 'public' ||
                       video.user_id === userId ||
                       await this.checkVideoAccess(videoId, userId, c.env.DB);

      if (!hasAccess) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      // Get streaming URL based on quality
      const streamingUrl = await this.videoService.getStreamingUrl(videoId, quality);

      // Generate signed URL if needed
      const signedUrl = await this.generateSignedUrl(streamingUrl, video.storage_provider);

      return c.json({
        url: signedUrl,
        type: video.format === 'm3u8' ? 'hls' : 'progressive',
        duration: video.duration,
      });
    } catch (error) {
      console.error("Error getting stream URL:", error);
      return c.json({ error: "Failed to get stream URL" }, 500);
    }
  }

  /**
   * GET /api/videos/:id/manifest.m3u8
   * Get HLS manifest
   */
  async getHLSManifest(c: Context) {
    try {
      const videoId = c.req.param('id');
      
      const manifest = await this.videoService.getHLSManifest(videoId);
      
      return new Response(manifest, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'max-age=3600',
        },
      });
    } catch (error) {
      console.error("Error getting HLS manifest:", error);
      return c.json({ error: "Failed to get manifest" }, 500);
    }
  }

  /**
   * POST /api/videos/:id/analytics
   * Update video analytics
   */
  async updateAnalytics(c: Context) {
    try {
      const videoId = c.req.param('id');
      const userId = c.get('userId');
      const { 
        watchDuration, 
        completed, 
        quality,
        bufferingEvents,
        seekEvents 
      } = await c.req.json();

      await this.videoService.updateAnalytics(videoId, {
        userId,
        watchDuration,
        completed,
        quality,
        bufferingEvents,
        seekEvents,
      });

      return c.json({ success: true });
    } catch (error) {
      console.error("Error updating analytics:", error);
      return c.json({ error: "Failed to update analytics" }, 500);
    }
  }

  /**
   * PUT /api/videos/:id
   * Update video metadata
   */
  async updateVideo(c: Context) {
    try {
      const videoId = c.req.param('id');
      const userId = c.get('userId');
      const body = await c.req.json();
      const validated = UpdateVideoSchema.parse(body);

      // Check ownership
      const video = await c.env.DB.prepare(`
        SELECT v.*, p.user_id 
        FROM videos v
        JOIN pitches p ON v.pitch_id = p.id
        WHERE v.id = ? AND p.user_id = ?
      `).bind(videoId, userId).first();

      if (!video) {
        return c.json({ error: "Video not found or unauthorized" }, 404);
      }

      // Update video
      const updates = [];
      const params = [];

      if (validated.title !== undefined) {
        updates.push('title = ?');
        params.push(validated.title);
      }
      if (validated.description !== undefined) {
        updates.push('description = ?');
        params.push(validated.description);
      }
      if (validated.tags !== undefined) {
        updates.push('tags = ?');
        params.push(JSON.stringify(validated.tags));
      }
      if (validated.visibility !== undefined) {
        updates.push('visibility = ?');
        params.push(validated.visibility);
      }

      if (updates.length > 0) {
        params.push(videoId);
        await c.env.DB.prepare(`
          UPDATE videos 
          SET ${updates.join(', ')}, updated_at = datetime('now')
          WHERE id = ?
        `).bind(...params).run();
      }

      // Generate new thumbnail if requested
      if (validated.thumbnailTimestamp !== undefined) {
        await this.videoService.generateThumbnails(
          videoId, 
          [validated.thumbnailTimestamp]
        );
      }

      return c.json({
        success: true,
        message: "Video updated successfully",
      });
    } catch (error) {
      console.error("Error updating video:", error);
      return c.json({ error: "Failed to update video" }, 500);
    }
  }

  /**
   * DELETE /api/videos/:id
   * Delete a video
   */
  async deleteVideo(c: Context) {
    try {
      const videoId = c.req.param('id');
      const userId = c.get('userId');

      // Check ownership
      const video = await c.env.DB.prepare(`
        SELECT v.*, p.user_id 
        FROM videos v
        JOIN pitches p ON v.pitch_id = p.id
        WHERE v.id = ? AND p.user_id = ?
      `).bind(videoId, userId).first();

      if (!video) {
        return c.json({ error: "Video not found or unauthorized" }, 404);
      }

      // Delete from storage
      await this.videoService.deleteVideo(videoId);

      // Soft delete from database
      await c.env.DB.prepare(`
        UPDATE videos 
        SET status = 'deleted',
            deleted_at = datetime('now')
        WHERE id = ?
      `).bind(videoId).run();

      return c.json({
        success: true,
        message: "Video deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting video:", error);
      return c.json({ error: "Failed to delete video" }, 500);
    }
  }

  /**
   * POST /api/videos/:id/transcode
   * Trigger video transcoding
   */
  async transcodeVideo(c: Context) {
    try {
      const videoId = c.req.param('id');
      const userId = c.get('userId');
      const body = await c.req.json();
      const settings = TranscodingSettingsSchema.parse(body);

      // Check ownership
      const video = await c.env.DB.prepare(`
        SELECT v.*, p.user_id 
        FROM videos v
        JOIN pitches p ON v.pitch_id = p.id
        WHERE v.id = ? AND p.user_id = ?
      `).bind(videoId, userId).first();

      if (!video) {
        return c.json({ error: "Video not found or unauthorized" }, 404);
      }

      // Check if already transcoding
      if (video.status === 'processing') {
        return c.json({ error: "Video is already being processed" }, 400);
      }

      // Start transcoding with custom settings
      await this.videoService.transcodeVideo(videoId, settings);

      return c.json({
        success: true,
        message: "Transcoding started",
        estimatedTime: this.estimateTranscodingTime(video.duration, settings.qualities),
      });
    } catch (error) {
      console.error("Error transcoding video:", error);
      return c.json({ error: "Failed to start transcoding" }, 500);
    }
  }

  /**
   * GET /api/videos/:id/download
   * Get download URL for video
   */
  async getDownloadUrl(c: Context) {
    try {
      const videoId = c.req.param('id');
      const userId = c.get('userId');
      const { quality = 'original' } = c.req.query();

      // Check ownership or purchase
      const access = await c.env.DB.prepare(`
        SELECT 
          CASE 
            WHEN p.user_id = ? THEN 1
            WHEN i.status = 'completed' THEN 1
            ELSE 0
          END as has_access
        FROM videos v
        JOIN pitches p ON v.pitch_id = p.id
        LEFT JOIN investments i ON p.id = i.pitch_id AND i.investor_id = ?
        WHERE v.id = ?
      `).bind(userId, userId, videoId).first();

      if (!access?.has_access) {
        return c.json({ error: "No download access" }, 403);
      }

      const downloadUrl = await this.videoService.getDownloadUrl(videoId, quality);
      
      // Generate time-limited signed URL
      const signedUrl = await this.generateSignedUrl(downloadUrl, 'download', 3600);

      return c.json({
        url: signedUrl,
        expiresIn: 3600,
      });
    } catch (error) {
      console.error("Error getting download URL:", error);
      return c.json({ error: "Failed to get download URL" }, 500);
    }
  }

  /**
   * GET /api/videos/pitch/:pitchId
   * List all videos for a pitch
   */
  async listPitchVideos(c: Context) {
    try {
      const pitchId = c.req.param('pitchId');
      const userId = c.get('userId');

      // Check pitch access
      const pitch = await c.env.DB.prepare(`
        SELECT * FROM pitches WHERE id = ?
      `).bind(pitchId).first();

      if (!pitch) {
        return c.json({ error: "Pitch not found" }, 404);
      }

      // Get videos based on access level
      const videos = await c.env.DB.prepare(`
        SELECT 
          v.*,
          COUNT(DISTINCT vv.id) as view_count,
          AVG(vv.watch_duration) as avg_watch_duration,
          MAX(vv.completed) as has_completed_views
        FROM videos v
        LEFT JOIN video_views vv ON v.id = vv.video_id
        WHERE v.pitch_id = ? 
          AND v.status != 'deleted'
          AND (v.visibility = 'public' OR ? = (
            SELECT user_id FROM pitches WHERE id = ?
          ))
        GROUP BY v.id
        ORDER BY v.order_index, v.created_at
      `).bind(pitchId, userId, pitchId).all();

      // Get qualities for each video
      for (const video of videos.results || []) {
        const qualities = await c.env.DB.prepare(`
          SELECT quality, url FROM video_qualities
          WHERE video_id = ?
        `).bind(video.id).all();
        
        video.availableQualities = qualities.results?.map(q => q.quality) || [];
      }

      return c.json({
        videos: videos.results || [],
      });
    } catch (error) {
      console.error("Error listing pitch videos:", error);
      return c.json({ error: "Failed to list videos" }, 500);
    }
  }

  /**
   * GET /api/videos/analytics/summary
   * Get analytics summary for creator's videos
   */
  async getAnalyticsSummary(c: Context) {
    try {
      const userId = c.get('userId');
      const { period = '30d' } = c.req.query();

      const startDate = this.getPeriodStartDate(period);

      const stats = await c.env.DB.prepare(`
        SELECT 
          COUNT(DISTINCT v.id) as total_videos,
          COUNT(DISTINCT vv.id) as total_views,
          COUNT(DISTINCT vv.user_id) as unique_viewers,
          SUM(vv.watch_duration) as total_watch_time,
          AVG(vv.watch_duration) as avg_watch_time,
          AVG(CASE WHEN vv.completed THEN 100 ELSE (vv.watch_duration * 100.0 / v.duration) END) as avg_completion_rate,
          COUNT(DISTINCT CASE WHEN vv.completed THEN vv.id END) as completed_views
        FROM videos v
        JOIN pitches p ON v.pitch_id = p.id
        LEFT JOIN video_views vv ON v.id = vv.video_id
        WHERE p.user_id = ?
          AND v.status = 'ready'
          AND vv.viewed_at >= ?
      `).bind(userId, startDate).first();

      // Get top videos
      const topVideos = await c.env.DB.prepare(`
        SELECT 
          v.id,
          v.title,
          v.thumbnail_url,
          COUNT(DISTINCT vv.id) as view_count,
          AVG(vv.watch_duration) as avg_watch_duration
        FROM videos v
        JOIN pitches p ON v.pitch_id = p.id
        JOIN video_views vv ON v.id = vv.video_id
        WHERE p.user_id = ?
          AND vv.viewed_at >= ?
        GROUP BY v.id
        ORDER BY view_count DESC
        LIMIT 10
      `).bind(userId, startDate).all();

      return c.json({
        summary: stats,
        topVideos: topVideos.results || [],
        period,
      });
    } catch (error) {
      console.error("Error getting analytics summary:", error);
      return c.json({ error: "Failed to get analytics" }, 500);
    }
  }

  // Helper methods
  private async checkVideoAccess(videoId: string, userId: string, db: any): Promise<boolean> {
    // Check if user has NDA access or investment
    const access = await db.prepare(`
      SELECT 1 FROM (
        SELECT 1 FROM nda_requests nr
        JOIN videos v ON v.pitch_id = nr.pitch_id
        WHERE v.id = ? AND nr.user_id = ? AND nr.status = 'approved'
        UNION
        SELECT 1 FROM investments i
        JOIN videos v ON v.pitch_id = i.pitch_id
        WHERE v.id = ? AND i.investor_id = ?
      ) LIMIT 1
    `).bind(videoId, userId, videoId, userId).first();

    return !!access;
  }

  private async generateSignedUrl(
    url: string, 
    provider: string, 
    expiresIn: number = 3600
  ): Promise<string> {
    // Implementation depends on storage provider
    // For Cloudflare, use signed URLs
    // For S3, use presigned URLs
    return url; // Simplified for now
  }

  private async completeCloudflareUpload(videoId: string, uploadId: string): Promise<void> {
    // Complete Cloudflare Stream upload
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${Deno.env.get('CLOUDFLARE_ACCOUNT_ID')}/stream/${uploadId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('CLOUDFLARE_STREAM_TOKEN')}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to complete Cloudflare upload');
    }
  }

  private async completeMultipartUpload(
    videoId: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    // Complete multipart upload for R2/S3
    // Implementation depends on storage provider
  }

  private estimateTranscodingTime(duration: number, qualities: string[]): number {
    // Rough estimate: 1 minute of video = 30 seconds of transcoding per quality
    const baseTime = (duration / 60) * 30;
    return Math.ceil(baseTime * qualities.length);
  }

  private getPeriodStartDate(period: string): string {
    const now = new Date();
    const periodMap: Record<string, number> = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };

    const days = periodMap[period] || 30;
    now.setDate(now.getDate() - days);
    return now.toISOString();
  }
}