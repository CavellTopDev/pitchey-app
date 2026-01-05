/**
 * Example Usage of Pitchey Container Services
 * 
 * This file demonstrates how to integrate and use the container services
 * within the Cloudflare Workers environment for various processing tasks.
 */

import {
  containerOrchestrator,
  VideoProcessorContainer,
  DocumentProcessorContainer,
  AIInferenceContainer,
  MediaTranscoderContainer,
  CodeExecutorContainer
} from './index';

// Initialize container services
export async function initializeContainers(): Promise<void> {
  console.log('🚀 Initializing Pitchey Container Services...');
  
  // Create container instances
  const videoProcessor = new VideoProcessorContainer();
  const documentProcessor = new DocumentProcessorContainer();
  const aiInference = new AIInferenceContainer();
  const mediaTranscoder = new MediaTranscoderContainer();
  const codeExecutor = new CodeExecutorContainer();
  
  // Register containers with orchestrator
  containerOrchestrator.registerContainer(videoProcessor);
  containerOrchestrator.registerContainer(documentProcessor);
  containerOrchestrator.registerContainer(aiInference);
  containerOrchestrator.registerContainer(mediaTranscoder);
  containerOrchestrator.registerContainer(codeExecutor);
  
  // Start all containers
  await containerOrchestrator.startAll();
  
  console.log('✅ All containers initialized and ready');
}

// Example: Process a movie pitch video
export async function processPitchVideo(videoUrl: string): Promise<{
  thumbnails: string[];
  hlsPlaylist: string;
  analysis: any;
}> {
  const videoProcessor = containerOrchestrator.getContainer<VideoProcessorContainer>('video-processor');
  const aiInference = containerOrchestrator.getContainer<AIInferenceContainer>('ai-inference');
  
  if (!videoProcessor || !aiInference) {
    throw new Error('Required containers not available');
  }
  
  console.log('🎬 Processing pitch video:', videoUrl);
  
  try {
    // Generate thumbnails
    const thumbnailJob = await videoProcessor.processJob('thumbnail', {
      inputUrl: videoUrl,
      times: [5, 30, 60, 120], // Generate thumbnails at these timestamps
      width: 320,
      height: 180
    });
    
    // Analyze video content with AI
    const analysisJob = await aiInference.processJob('analyze-video', {
      inputUrl: videoUrl,
      analysisType: 'description'
    });
    
    // Transcode for streaming
    const hlsJob = await videoProcessor.processJob('transcode', {
      inputUrl: videoUrl,
      outputFormat: 'hls',
      quality: 'high',
      thumbnailTimes: [10, 30, 60]
    });
    
    console.log('✅ Video processing completed');
    
    return {
      thumbnails: thumbnailJob.result?.thumbnails || [],
      hlsPlaylist: hlsJob.result?.outputUrls[0] || '',
      analysis: analysisJob.result?.output.text
    };
    
  } catch (error) {
    console.error('❌ Video processing failed:', error);
    throw error;
  }
}

// Example: Generate and process NDA document
export async function generateNDADocument(data: {
  creatorName: string;
  investorName: string;
  projectTitle: string;
  expirationDate: string;
}): Promise<{
  documentUrl: string;
  watermarkedUrl: string;
  textContent: string;
}> {
  const documentProcessor = containerOrchestrator.getContainer<DocumentProcessorContainer>('document-processor');
  
  if (!documentProcessor) {
    throw new Error('Document processor not available');
  }
  
  console.log('📄 Generating NDA document for:', data.projectTitle);
  
  try {
    // Generate PDF from template
    const generateJob = await documentProcessor.processJob('generate-from-template', {
      templateId: 'nda-standard',
      data: {
        creator_name: data.creatorName,
        investor_name: data.investorName,
        project_title: data.projectTitle,
        expiration_date: data.expirationDate,
        generated_date: new Date().toISOString().split('T')[0]
      }
    });
    
    // Add watermark
    const watermarkJob = await documentProcessor.processJob('add-watermark', {
      inputUrl: generateJob.result?.outputUrls[0],
      watermark: {
        text: `CONFIDENTIAL - ${data.projectTitle}`,
        position: 'footer',
        opacity: 0.3,
        fontSize: 10,
        color: '#666666'
      }
    });
    
    // Extract text for search indexing
    const extractJob = await documentProcessor.processJob('extract-text', {
      inputUrl: generateJob.result?.outputUrls[0]
    });
    
    console.log('✅ NDA document processing completed');
    
    return {
      documentUrl: generateJob.result?.outputUrls[0] || '',
      watermarkedUrl: watermarkJob.result?.outputUrls[0] || '',
      textContent: extractJob.result?.text || ''
    };
    
  } catch (error) {
    console.error('❌ NDA document processing failed:', error);
    throw error;
  }
}

// Example: AI-powered pitch analysis
export async function analyzePitchComprehensively(pitchData: {
  title: string;
  description: string;
  genre: string;
  budget: number;
  attachments?: string[];
}): Promise<any> {
  const aiInference = containerOrchestrator.getContainer<AIInferenceContainer>('ai-inference');
  
  if (!aiInference) {
    throw new Error('AI inference container not available');
  }
  
  console.log('🤖 Analyzing pitch:', pitchData.title);
  
  try {
    // Comprehensive pitch analysis
    const analysisResult = await aiInference.analyzePitch({
      pitchTitle: pitchData.title,
      description: pitchData.description,
      genre: pitchData.genre,
      budget: pitchData.budget,
      attachments: pitchData.attachments
    });
    
    // Content moderation check
    const moderationJob = await aiInference.processJob('content-moderation', {
      text: `${pitchData.title} ${pitchData.description}`
    });
    
    // Generate summary
    const summaryJob = await aiInference.processJob('generate-summary', {
      text: pitchData.description,
      maxLength: 150,
      style: 'executive'
    });
    
    console.log('✅ Pitch analysis completed');
    
    return {
      ...analysisResult,
      moderation: moderationJob.result?.output.moderation,
      summary: summaryJob.result?.output.text
    };
    
  } catch (error) {
    console.error('❌ Pitch analysis failed:', error);
    throw error;
  }
}

// Example: Setup live streaming for pitch presentation
export async function setupLivePitchStream(config: {
  creatorId: string;
  pitchId: string;
  expectedViewers: number;
}): Promise<{
  streamId: string;
  playbackUrls: Record<string, string>;
  recordingEnabled: boolean;
}> {
  const mediaTranscoder = containerOrchestrator.getContainer<MediaTranscoderContainer>('media-transcoder');
  
  if (!mediaTranscoder) {
    throw new Error('Media transcoder not available');
  }
  
  console.log('📺 Setting up live stream for pitch:', config.pitchId);
  
  try {
    // Setup adaptive live stream
    const streamResult = await mediaTranscoder.processJob('live-stream', {
      inputSource: `rtmp://live.pitchey.com/live/${config.pitchId}`,
      outputFormats: ['hls', 'dash'],
      latency: config.expectedViewers > 100 ? 'normal' : 'low',
      recording: {
        enabled: true,
        format: 'mp4',
        segmented: true
      },
      transcoding: {
        profiles: [
          {
            name: 'mobile',
            video: { codec: 'h264', width: 640, height: 360, bitrate: 800, framerate: 30, keyframeInterval: 2, preset: 'fast' },
            audio: { codec: 'aac', bitrate: 128, sampleRate: 44100, channels: 2 },
            container: 'mp4'
          },
          {
            name: 'hd',
            video: { codec: 'h264', width: 1280, height: 720, bitrate: 3000, framerate: 30, keyframeInterval: 2, preset: 'medium' },
            audio: { codec: 'aac', bitrate: 192, sampleRate: 48000, channels: 2 },
            container: 'mp4'
          }
        ],
        adaptiveBitrate: true
      }
    });
    
    console.log('✅ Live stream setup completed');
    
    return {
      streamId: streamResult.result?.streamId,
      playbackUrls: streamResult.result?.endpoints || {},
      recordingEnabled: true
    };
    
  } catch (error) {
    console.error('❌ Live stream setup failed:', error);
    throw error;
  }
}

// Example: Execute custom business logic
export async function executeCustomWorkflow(workflowConfig: {
  pitchId: string;
  investorId: string;
  actionType: 'investment-evaluation' | 'due-diligence' | 'contract-generation';
}): Promise<any> {
  const codeExecutor = containerOrchestrator.getContainer<CodeExecutorContainer>('code-executor');
  
  if (!codeExecutor) {
    throw new Error('Code executor not available');
  }
  
  console.log('⚙️ Executing custom workflow:', workflowConfig.actionType);
  
  try {
    // Define workflow logic based on action type
    const workflowCode = generateWorkflowCode(workflowConfig);
    
    const executionResult = await codeExecutor.processJob('execute-code', {
      language: 'javascript',
      code: workflowCode,
      context: {
        variables: {
          pitchId: workflowConfig.pitchId,
          investorId: workflowConfig.investorId,
          timestamp: Date.now()
        },
        environment: {
          NODE_ENV: 'production',
          API_BASE_URL: 'https://pitchey-api-prod.ndlovucavelle.workers.dev'
        }
      },
      execution: {
        timeout: 30000,
        memoryLimit: 512,
        networkAccess: true
      },
      security: {
        sandboxLevel: 'moderate',
        allowedModules: ['fetch', 'crypto', 'util']
      }
    });
    
    console.log('✅ Custom workflow executed');
    
    return {
      success: executionResult.result?.success,
      output: executionResult.result?.output,
      metrics: executionResult.result?.execution
    };
    
  } catch (error) {
    console.error('❌ Custom workflow execution failed:', error);
    throw error;
  }
}

// Helper: Generate workflow code based on action type
function generateWorkflowCode(config: any): string {
  switch (config.actionType) {
    case 'investment-evaluation':
      return `
        // Investment evaluation workflow
        const pitchData = await fetch(\`/api/pitches/\${pitchId}\`).then(r => r.json());
        const investorProfile = await fetch(\`/api/investors/\${investorId}\`).then(r => r.json());
        
        // Calculate compatibility score
        const compatibilityScore = calculateCompatibility(pitchData, investorProfile);
        
        // Generate evaluation report
        const evaluation = {
          pitchId,
          investorId,
          compatibilityScore,
          recommendations: generateRecommendations(compatibilityScore),
          timestamp: new Date().toISOString()
        };
        
        // Store evaluation
        await fetch('/api/evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evaluation)
        });
        
        return evaluation;
        
        function calculateCompatibility(pitch, investor) {
          // Complex compatibility calculation logic
          return Math.floor(Math.random() * 100); // Simplified for example
        }
        
        function generateRecommendations(score) {
          if (score > 80) return ['Highly recommended', 'Fast-track review'];
          if (score > 60) return ['Recommended', 'Standard review'];
          return ['Not recommended', 'Consider alternative options'];
        }
      `;
    
    case 'due-diligence':
      return `
        // Due diligence workflow
        const checks = [
          'financial_verification',
          'legal_compliance',
          'market_research',
          'technical_feasibility'
        ];
        
        const results = {};
        
        for (const check of checks) {
          try {
            const result = await performDueDiligenceCheck(check, pitchId);
            results[check] = result;
          } catch (error) {
            results[check] = { status: 'error', error: error.message };
          }
        }
        
        return { pitchId, investorId, dueDiligenceResults: results };
        
        async function performDueDiligenceCheck(checkType, pitchId) {
          // Simulate due diligence checks
          await new Promise(resolve => setTimeout(resolve, 100));
          return { 
            status: 'completed', 
            score: Math.floor(Math.random() * 100),
            notes: \`\${checkType} check completed successfully\`
          };
        }
      `;
    
    default:
      return `
        // Default workflow
        console.log('Executing default workflow for', pitchId);
        return { status: 'completed', pitchId, investorId };
      `;
  }
}

// Example: Batch process multiple videos
export async function batchProcessVideos(videoUrls: string[]): Promise<Array<{
  url: string;
  result: any;
  error?: string;
}>> {
  const mediaTranscoder = containerOrchestrator.getContainer<MediaTranscoderContainer>('media-transcoder');
  
  if (!mediaTranscoder) {
    throw new Error('Media transcoder not available');
  }
  
  console.log('🎥 Batch processing', videoUrls.length, 'videos');
  
  const jobs = videoUrls.map((url, index) => ({
    inputUrl: url,
    outputFormat: 'hls' as const,
    profiles: [
      {
        name: 'mobile',
        video: { codec: 'h264' as const, width: 640, height: 360, bitrate: 800, framerate: 30, keyframeInterval: 2, preset: 'fast' as const },
        audio: { codec: 'aac' as const, bitrate: 128, sampleRate: 44100, channels: 2 },
        container: 'mp4' as const
      }
    ],
    options: {
      segmentDuration: 6,
      playlistType: 'vod' as const
    }
  }));
  
  try {
    const batchResult = await mediaTranscoder.processJob('batch-transcode', { jobs });
    
    return videoUrls.map((url, index) => ({
      url,
      result: batchResult.result?.[index] || null,
      error: batchResult.result?.[index]?.error
    }));
    
  } catch (error) {
    console.error('❌ Batch video processing failed:', error);
    throw error;
  }
}

// Health check for all containers
export async function performHealthCheck(): Promise<Record<string, any>> {
  console.log('🏥 Performing container health check...');
  
  try {
    const health = await containerOrchestrator.healthCheck();
    
    console.log('✅ Health check completed');
    return health;
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    throw error;
  }
}

// Graceful shutdown
export async function shutdownContainers(): Promise<void> {
  console.log('🛑 Shutting down container services...');
  
  try {
    await containerOrchestrator.stopAll();
    console.log('✅ All containers stopped gracefully');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    throw error;
  }
}