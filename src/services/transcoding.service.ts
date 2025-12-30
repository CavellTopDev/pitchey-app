import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

/**
 * Video Transcoding Service
 * Handles video processing, format conversion, and quality generation
 */

interface TranscodingJob {
  videoId: string;
  inputUrl: string;
  outputFormat: string;
  qualities: Quality[];
  options: TranscodingOptions;
}

interface Quality {
  label: string;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
}

interface TranscodingOptions {
  codec: 'h264' | 'h265' | 'av1' | 'vp9';
  audioCodec: 'aac' | 'opus' | 'mp3';
  audioBitrate: number;
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
  twoPass: boolean;
  generateThumbnails: boolean;
  generatePreview: boolean;
  optimizeForStreaming: boolean;
  watermark?: WatermarkConfig;
}

interface WatermarkConfig {
  imageUrl: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number;
  scale: number;
}

interface TranscodingProgress {
  jobId: string;
  videoId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentQuality?: string;
  eta?: number;
  error?: string;
}

export class TranscodingService {
  private db: Client;
  private cloudflareStreamApi?: string;
  private cloudflareAccountId?: string;
  private ffmpegWorkerUrl?: string;
  private activeJobs: Map<string, TranscodingProgress> = new Map();

  // Quality presets
  private readonly qualityPresets: Record<string, Quality> = {
    '360p': { label: '360p', width: 640, height: 360, bitrate: 800, fps: 30 },
    '480p': { label: '480p', width: 854, height: 480, bitrate: 1400, fps: 30 },
    '720p': { label: '720p', width: 1280, height: 720, bitrate: 2800, fps: 30 },
    '1080p': { label: '1080p', width: 1920, height: 1080, bitrate: 5000, fps: 30 },
    '1440p': { label: '1440p', width: 2560, height: 1440, bitrate: 8000, fps: 30 },
    '4k': { label: '4K', width: 3840, height: 2160, bitrate: 15000, fps: 30 },
  };

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

    // Cloudflare Stream configuration
    this.cloudflareStreamApi = Deno.env.get("CLOUDFLARE_STREAM_API");
    this.cloudflareAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    
    // FFmpeg worker for edge transcoding
    this.ffmpegWorkerUrl = Deno.env.get("FFMPEG_WORKER_URL");
  }

  async connect() {
    await this.db.connect();
  }

  async disconnect() {
    await this.db.end();
  }

  /**
   * Start transcoding job
   */
  async startTranscoding(job: TranscodingJob): Promise<string> {
    const jobId = crypto.randomUUID();
    
    try {
      // Create job record
      await this.db.queryObject(`
        INSERT INTO transcoding_jobs (
          id, video_id, status, input_url, output_format,
          qualities, options, created_at
        )
        VALUES ($1::uuid, $2::uuid, 'queued', $3, $4, $5::jsonb, $6::jsonb, NOW())
      `, [
        jobId,
        job.videoId,
        job.inputUrl,
        job.outputFormat,
        JSON.stringify(job.qualities),
        JSON.stringify(job.options)
      ]);

      // Initialize progress tracking
      this.activeJobs.set(jobId, {
        jobId,
        videoId: job.videoId,
        status: 'queued',
        progress: 0,
      });

      // Route to appropriate transcoding service
      if (this.shouldUseCloudflareStream(job)) {
        await this.transcodeWithCloudflare(jobId, job);
      } else if (this.ffmpegWorkerUrl) {
        await this.transcodeWithWorker(jobId, job);
      } else {
        await this.transcodeWithFFmpeg(jobId, job);
      }

      return jobId;
    } catch (error) {
      console.error("Error starting transcoding:", error);
      await this.markJobFailed(jobId, error.message);
      throw error;
    }
  }

  /**
   * Transcode using Cloudflare Stream
   */
  private async transcodeWithCloudflare(jobId: string, job: TranscodingJob): Promise<void> {
    try {
      this.updateProgress(jobId, 'processing', 10);

      // Upload to Cloudflare Stream
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/stream/copy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.cloudflareStreamApi}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: job.inputUrl,
            meta: {
              videoId: job.videoId,
              jobId: jobId,
            },
            allowedOrigins: ['*'],
            requireSignedURLs: false,
            watermark: job.options.watermark ? {
              uid: await this.uploadWatermark(job.options.watermark),
            } : undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Cloudflare Stream API error: ${response.statusText}`);
      }

      const data = await response.json();
      const streamId = data.result.uid;

      // Poll for completion
      await this.pollCloudflareStatus(jobId, streamId);

      // Get generated URLs
      const streamData = await this.getCloudflareStreamData(streamId);
      
      // Save quality variants
      for (const variant of streamData.variants || []) {
        await this.saveQualityVariant(job.videoId, variant);
      }

      // Generate HLS playlist
      await this.generateHLSPlaylist(job.videoId, streamData.playback.hls);

      // Update video status
      await this.markJobCompleted(jobId);
      
    } catch (error) {
      console.error("Cloudflare transcoding error:", error);
      await this.markJobFailed(jobId, error.message);
      throw error;
    }
  }

  /**
   * Transcode using edge worker with FFmpeg WASM
   */
  private async transcodeWithWorker(jobId: string, job: TranscodingJob): Promise<void> {
    try {
      this.updateProgress(jobId, 'processing', 5);

      // Send to FFmpeg worker
      const response = await fetch(this.ffmpegWorkerUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          inputUrl: job.inputUrl,
          qualities: job.qualities,
          options: job.options,
          webhookUrl: `${Deno.env.get('API_URL')}/webhooks/transcoding/${jobId}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Worker transcoding failed: ${response.statusText}`);
      }

      // Worker will call webhook on progress/completion
      // No need to poll here
      
    } catch (error) {
      console.error("Worker transcoding error:", error);
      await this.markJobFailed(jobId, error.message);
      throw error;
    }
  }

  /**
   * Transcode using local FFmpeg
   */
  private async transcodeWithFFmpeg(jobId: string, job: TranscodingJob): Promise<void> {
    try {
      this.updateProgress(jobId, 'processing', 5);

      // Download input video
      const inputPath = `/tmp/input-${jobId}.mp4`;
      await this.downloadVideo(job.inputUrl, inputPath);

      // Process each quality
      let qualityIndex = 0;
      for (const quality of job.qualities) {
        const progress = 10 + (80 * qualityIndex / job.qualities.length);
        this.updateProgress(jobId, 'processing', progress, quality.label);

        const outputPath = `/tmp/output-${jobId}-${quality.label}.mp4`;
        
        // Build FFmpeg command
        const command = this.buildFFmpegCommand(
          inputPath,
          outputPath,
          quality,
          job.options
        );

        // Execute FFmpeg
        const process = new Deno.Command("ffmpeg", {
          args: command.split(' '),
          stdout: "piped",
          stderr: "piped",
        });

        const { code, stdout, stderr } = await process.output();
        
        if (code !== 0) {
          const error = new TextDecoder().decode(stderr);
          throw new Error(`FFmpeg error: ${error}`);
        }

        // Upload processed video
        const uploadUrl = await this.uploadProcessedVideo(
          outputPath,
          job.videoId,
          quality.label
        );

        // Save quality variant
        await this.saveQualityVariant(job.videoId, {
          quality: quality.label,
          url: uploadUrl,
          width: quality.width,
          height: quality.height,
          bitrate: quality.bitrate,
          fileSize: await this.getFileSize(outputPath),
        });

        // Clean up temp file
        await Deno.remove(outputPath);
        
        qualityIndex++;
      }

      // Generate thumbnails if requested
      if (job.options.generateThumbnails) {
        await this.generateThumbnails(jobId, inputPath, job.videoId);
      }

      // Generate preview if requested  
      if (job.options.generatePreview) {
        await this.generatePreview(jobId, inputPath, job.videoId);
      }

      // Generate HLS if needed
      if (job.outputFormat === 'hls') {
        await this.generateHLSFromMP4(jobId, inputPath, job.videoId, job.qualities);
      }

      // Clean up input file
      await Deno.remove(inputPath);

      // Mark as completed
      await this.markJobCompleted(jobId);
      
    } catch (error) {
      console.error("FFmpeg transcoding error:", error);
      await this.markJobFailed(jobId, error.message);
      throw error;
    }
  }

  /**
   * Build FFmpeg command
   */
  private buildFFmpegCommand(
    input: string,
    output: string,
    quality: Quality,
    options: TranscodingOptions
  ): string {
    const parts = [
      '-i', input,
      '-c:v', this.getVideoCodec(options.codec),
      '-c:a', this.getAudioCodec(options.audioCodec),
      '-b:v', `${quality.bitrate}k`,
      '-b:a', `${options.audioBitrate}k`,
      '-vf', `scale=${quality.width}:${quality.height}`,
      '-r', quality.fps.toString(),
      '-preset', options.preset,
    ];

    if (options.twoPass) {
      // Two-pass encoding for better quality
      parts.push('-pass', '1', '-f', 'null', '/dev/null', '&&', 'ffmpeg');
      parts.push('-i', input, '-pass', '2');
    }

    if (options.optimizeForStreaming) {
      parts.push('-movflags', '+faststart');
    }

    if (options.watermark) {
      const watermarkFilter = this.buildWatermarkFilter(options.watermark);
      parts.push('-i', options.watermark.imageUrl);
      parts.push('-filter_complex', watermarkFilter);
    }

    parts.push(output);
    
    return parts.join(' ');
  }

  /**
   * Generate thumbnails from video
   */
  private async generateThumbnails(
    jobId: string,
    videoPath: string,
    videoId: string
  ): Promise<void> {
    try {
      // Generate thumbnails at different timestamps
      const timestamps = [1, 5, 10, 30, 60]; // seconds
      const thumbnails = [];

      for (const timestamp of timestamps) {
        const outputPath = `/tmp/thumb-${jobId}-${timestamp}.jpg`;
        
        const process = new Deno.Command("ffmpeg", {
          args: [
            '-i', videoPath,
            '-ss', timestamp.toString(),
            '-vframes', '1',
            '-vf', 'scale=1280:720',
            '-q:v', '2',
            outputPath
          ],
        });

        const { code } = await process.output();
        
        if (code === 0) {
          // Upload thumbnail
          const url = await this.uploadThumbnail(outputPath, videoId, timestamp);
          thumbnails.push({ timestamp, url });
          
          await Deno.remove(outputPath);
        }
      }

      // Save thumbnails to database
      await this.db.queryObject(`
        UPDATE videos
        SET thumbnails = $1::jsonb,
            thumbnail_url = $2
        WHERE id = $3::uuid
      `, [JSON.stringify(thumbnails), thumbnails[2]?.url, videoId]);
      
    } catch (error) {
      console.error("Error generating thumbnails:", error);
    }
  }

  /**
   * Generate video preview (short clip)
   */
  private async generatePreview(
    jobId: string,
    videoPath: string,
    videoId: string
  ): Promise<void> {
    try {
      const previewPath = `/tmp/preview-${jobId}.mp4`;
      
      // Create 30-second preview
      const process = new Deno.Command("ffmpeg", {
        args: [
          '-i', videoPath,
          '-ss', '10', // Start at 10 seconds
          '-t', '30',  // Duration 30 seconds
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-vf', 'scale=854:480',
          '-c:a', 'aac',
          '-b:a', '128k',
          previewPath
        ],
      });

      const { code } = await process.output();
      
      if (code === 0) {
        // Upload preview
        const url = await this.uploadProcessedVideo(previewPath, videoId, 'preview');
        
        // Update video record
        await this.db.queryObject(`
          UPDATE videos
          SET preview_url = $1
          WHERE id = $2::uuid
        `, [url, videoId]);
        
        await Deno.remove(previewPath);
      }
    } catch (error) {
      console.error("Error generating preview:", error);
    }
  }

  /**
   * Generate HLS playlist from MP4
   */
  private async generateHLSFromMP4(
    jobId: string,
    inputPath: string,
    videoId: string,
    qualities: Quality[]
  ): Promise<void> {
    try {
      const hlsDir = `/tmp/hls-${jobId}`;
      await Deno.mkdir(hlsDir, { recursive: true });

      // Generate master playlist
      const masterPlaylist = ['#EXTM3U', '#EXT-X-VERSION:3'];
      
      for (const quality of qualities) {
        const variantDir = `${hlsDir}/${quality.label}`;
        await Deno.mkdir(variantDir, { recursive: true });
        
        // Generate HLS segments for each quality
        const process = new Deno.Command("ffmpeg", {
          args: [
            '-i', inputPath,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-b:v', `${quality.bitrate}k`,
            '-b:a', '128k',
            '-vf', `scale=${quality.width}:${quality.height}`,
            '-f', 'hls',
            '-hls_time', '10',
            '-hls_list_size', '0',
            '-hls_segment_filename', `${variantDir}/segment%03d.ts`,
            `${variantDir}/playlist.m3u8`
          ],
        });

        const { code } = await process.output();
        
        if (code === 0) {
          // Upload HLS files
          const playlistUrl = await this.uploadHLSFiles(variantDir, videoId, quality.label);
          
          // Add to master playlist
          masterPlaylist.push(
            `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bitrate * 1000},RESOLUTION=${quality.width}x${quality.height}`,
            playlistUrl
          );
        }
      }

      // Save master playlist
      const masterPath = `${hlsDir}/master.m3u8`;
      await Deno.writeTextFile(masterPath, masterPlaylist.join('\n'));
      
      const masterUrl = await this.uploadFile(masterPath, `videos/${videoId}/hls/master.m3u8`);
      
      // Update video record
      await this.db.queryObject(`
        UPDATE videos
        SET hls_url = $1,
            format = 'hls'
        WHERE id = $2::uuid
      `, [masterUrl, videoId]);
      
      // Clean up
      await Deno.remove(hlsDir, { recursive: true });
      
    } catch (error) {
      console.error("Error generating HLS:", error);
    }
  }

  /**
   * Process webhook from transcoding worker
   */
  async processWebhook(jobId: string, data: any): Promise<void> {
    try {
      const job = this.activeJobs.get(jobId);
      if (!job) return;

      if (data.status === 'progress') {
        this.updateProgress(jobId, 'processing', data.progress, data.currentQuality);
      } else if (data.status === 'completed') {
        // Save generated files
        for (const file of data.files || []) {
          await this.saveQualityVariant(data.videoId, file);
        }
        await this.markJobCompleted(jobId);
      } else if (data.status === 'failed') {
        await this.markJobFailed(jobId, data.error);
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
    }
  }

  /**
   * Get transcoding job status
   */
  async getJobStatus(jobId: string): Promise<TranscodingProgress | null> {
    // Check in-memory cache first
    const cached = this.activeJobs.get(jobId);
    if (cached) return cached;

    // Check database
    const result = await this.db.queryObject<{
      status: string;
      progress: number;
      error: string;
    }>(`
      SELECT status, progress, error
      FROM transcoding_jobs
      WHERE id = $1::uuid
    `, [jobId]);

    if (!result.rows[0]) return null;

    return {
      jobId,
      videoId: '',
      status: result.rows[0].status as any,
      progress: result.rows[0].progress,
      error: result.rows[0].error,
    };
  }

  // Helper methods
  private shouldUseCloudflareStream(job: TranscodingJob): boolean {
    // Use Cloudflare Stream for videos under 5GB and standard formats
    return !!this.cloudflareStreamApi && 
           job.outputFormat === 'hls' &&
           !job.options.watermark;
  }

  private getVideoCodec(codec: string): string {
    const codecMap: Record<string, string> = {
      'h264': 'libx264',
      'h265': 'libx265',
      'av1': 'libaom-av1',
      'vp9': 'libvpx-vp9',
    };
    return codecMap[codec] || 'libx264';
  }

  private getAudioCodec(codec: string): string {
    const codecMap: Record<string, string> = {
      'aac': 'aac',
      'opus': 'libopus',
      'mp3': 'libmp3lame',
    };
    return codecMap[codec] || 'aac';
  }

  private buildWatermarkFilter(watermark: WatermarkConfig): string {
    const positionMap: Record<string, string> = {
      'top-left': '10:10',
      'top-right': 'W-w-10:10',
      'bottom-left': '10:H-h-10',
      'bottom-right': 'W-w-10:H-h-10',
      'center': '(W-w)/2:(H-h)/2',
    };
    
    return `[1:v]scale=${watermark.scale}:-1,format=rgba,colorchannelmixer=aa=${watermark.opacity}[wm];[0:v][wm]overlay=${positionMap[watermark.position]}`;
  }

  private updateProgress(
    jobId: string, 
    status: TranscodingProgress['status'],
    progress: number,
    currentQuality?: string
  ): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = status;
      job.progress = progress;
      job.currentQuality = currentQuality;
      
      // Update database
      this.db.queryObject(`
        UPDATE transcoding_jobs
        SET status = $1, progress = $2, updated_at = NOW()
        WHERE id = $3::uuid
      `, [status, progress, jobId]).catch(console.error);
    }
  }

  private async markJobCompleted(jobId: string): Promise<void> {
    this.updateProgress(jobId, 'completed', 100);
    
    await this.db.queryObject(`
      UPDATE transcoding_jobs
      SET status = 'completed',
          progress = 100,
          completed_at = NOW()
      WHERE id = $1::uuid
    `, [jobId]);

    // Update video status
    const job = await this.db.queryObject<{ video_id: string }>(`
      SELECT video_id FROM transcoding_jobs WHERE id = $1::uuid
    `, [jobId]);

    if (job.rows[0]) {
      await this.db.queryObject(`
        UPDATE videos
        SET status = 'ready',
            processing_completed_at = NOW()
        WHERE id = $1::uuid
      `, [job.rows[0].video_id]);
    }

    // Clean up from active jobs
    this.activeJobs.delete(jobId);
  }

  private async markJobFailed(jobId: string, error: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;
    }

    await this.db.queryObject(`
      UPDATE transcoding_jobs
      SET status = 'failed',
          error = $1,
          failed_at = NOW()
      WHERE id = $2::uuid
    `, [error, jobId]);

    // Update video status
    const result = await this.db.queryObject<{ video_id: string }>(`
      SELECT video_id FROM transcoding_jobs WHERE id = $1::uuid
    `, [jobId]);

    if (result.rows[0]) {
      await this.db.queryObject(`
        UPDATE videos
        SET status = 'failed',
            processing_error = $1
        WHERE id = $2::uuid
      `, [error, result.rows[0].video_id]);
    }
  }

  private async saveQualityVariant(videoId: string, variant: any): Promise<void> {
    await this.db.queryObject(`
      INSERT INTO video_qualities (
        id, video_id, quality, width, height, bitrate, 
        file_size, url, created_at
      )
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (video_id, quality) DO UPDATE
      SET url = $8, updated_at = NOW()
    `, [
      crypto.randomUUID(),
      videoId,
      variant.quality || variant.label,
      variant.width,
      variant.height,
      variant.bitrate,
      variant.fileSize || 0,
      variant.url
    ]);
  }

  private async downloadVideo(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    await Deno.writeFile(outputPath, new Uint8Array(buffer));
  }

  private async uploadProcessedVideo(
    filePath: string,
    videoId: string,
    quality: string
  ): Promise<string> {
    // Upload to storage (R2/S3)
    const key = `videos/${videoId}/${quality}.mp4`;
    return await this.uploadFile(filePath, key);
  }

  private async uploadThumbnail(
    filePath: string,
    videoId: string,
    timestamp: number
  ): Promise<string> {
    const key = `videos/${videoId}/thumbnails/${timestamp}.jpg`;
    return await this.uploadFile(filePath, key);
  }

  private async uploadHLSFiles(
    directory: string,
    videoId: string,
    quality: string
  ): Promise<string> {
    // Upload all HLS files in directory
    for await (const entry of Deno.readDir(directory)) {
      if (entry.isFile) {
        const filePath = `${directory}/${entry.name}`;
        const key = `videos/${videoId}/hls/${quality}/${entry.name}`;
        await this.uploadFile(filePath, key);
      }
    }
    
    return `/videos/${videoId}/hls/${quality}/playlist.m3u8`;
  }

  private async uploadFile(filePath: string, key: string): Promise<string> {
    // Implementation depends on storage provider (R2, S3, etc.)
    // This is a placeholder
    const baseUrl = Deno.env.get('STORAGE_URL') || 'https://storage.example.com';
    return `${baseUrl}/${key}`;
  }

  private async uploadWatermark(config: WatermarkConfig): Promise<string> {
    // Upload watermark image to Cloudflare Stream
    // Returns watermark UID
    return 'watermark-uid';
  }

  private async pollCloudflareStatus(jobId: string, streamId: string): Promise<void> {
    // Poll Cloudflare Stream API for completion
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts) {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/stream/${streamId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.cloudflareStreamApi}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const status = data.result.status;
        
        if (status.state === 'ready') {
          break;
        } else if (status.state === 'error') {
          throw new Error(`Cloudflare Stream error: ${status.errorReasonText}`);
        }
        
        const progress = status.pctComplete || 0;
        this.updateProgress(jobId, 'processing', 10 + (progress * 0.8));
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
  }

  private async getCloudflareStreamData(streamId: string): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/stream/${streamId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.cloudflareStreamApi}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get stream data');
    }

    const data = await response.json();
    return data.result;
  }

  private async generateHLSPlaylist(videoId: string, hlsUrl: string): Promise<void> {
    await this.db.queryObject(`
      UPDATE videos
      SET hls_url = $1,
          format = 'hls'
      WHERE id = $2::uuid
    `, [hlsUrl, videoId]);
  }

  private async getFileSize(filePath: string): Promise<number> {
    const fileInfo = await Deno.stat(filePath);
    return fileInfo.size;
  }
}