/**
 * React Hook for Container Services
 * Provides easy access to container processing capabilities
 */

import { useState, useEffect, useCallback } from 'react';
import {
  containerService,
  ProcessingJob,
  VideoProcessingRequest,
  DocumentProcessingRequest,
  AIInferenceRequest,
  MediaTranscodingRequest,
  CodeExecutionRequest,
} from '../services/containerService';

export interface UseContainerServicesResult {
  // State
  jobs: ProcessingJob[];
  loading: boolean;
  error: string | null;
  
  // Actions
  processVideo: (request: VideoProcessingRequest) => Promise<ProcessingJob>;
  processDocument: (request: DocumentProcessingRequest) => Promise<ProcessingJob>;
  processAI: (request: AIInferenceRequest) => Promise<ProcessingJob>;
  transcodeMedia: (request: MediaTranscodingRequest) => Promise<ProcessingJob>;
  executeCode: (request: CodeExecutionRequest) => Promise<ProcessingJob>;
  
  // Job Management
  refreshJobs: () => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  getJobStatus: (jobId: string) => Promise<ProcessingJob>;
  
  // Health & Metrics
  health: Record<string, any>;
  refreshHealth: () => Promise<void>;
  
  // Utility
  clearError: () => void;
  isServiceHealthy: boolean;
}

export function useContainerServices(): UseContainerServicesResult {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, any>>({});
  const [isServiceHealthy, setIsServiceHealthy] = useState(true);

  // ===== ERROR HANDLING =====

  const handleError = useCallback((err: any, action: string) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    setError(`${action}: ${errorMessage}`);
    console.error(`Container service error during ${action}:`, err);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ===== JOB MANAGEMENT =====

  const refreshJobs = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedJobs = await containerService.getJobs();
      setJobs(fetchedJobs);
    } catch (err) {
      handleError(err, 'fetching jobs');
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      setLoading(true);
      await containerService.cancelJob(jobId);
      // Update local state
      setJobs(prev => prev.map(job => 
        job.jobId === jobId 
          ? { ...job, status: 'failed' as const, error: 'Cancelled by user' }
          : job
      ));
    } catch (err) {
      handleError(err, 'cancelling job');
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const getJobStatus = useCallback(async (jobId: string): Promise<ProcessingJob> => {
    try {
      const job = await containerService.getJobStatus(jobId);
      // Update local state
      setJobs(prev => prev.map(existingJob => 
        existingJob.jobId === jobId ? job : existingJob
      ));
      return job;
    } catch (err) {
      handleError(err, 'getting job status');
      throw err;
    }
  }, [handleError]);

  // ===== PROCESSING FUNCTIONS =====

  const processVideo = useCallback(async (request: VideoProcessingRequest): Promise<ProcessingJob> => {
    try {
      setLoading(true);
      const job = await containerService.processVideo(request);
      setJobs(prev => [job, ...prev]);
      return job;
    } catch (err) {
      handleError(err, 'processing video');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const processDocument = useCallback(async (request: DocumentProcessingRequest): Promise<ProcessingJob> => {
    try {
      setLoading(true);
      const job = await containerService.processDocument(request);
      setJobs(prev => [job, ...prev]);
      return job;
    } catch (err) {
      handleError(err, 'processing document');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const processAI = useCallback(async (request: AIInferenceRequest): Promise<ProcessingJob> => {
    try {
      setLoading(true);
      const job = await containerService.processAI(request);
      setJobs(prev => [job, ...prev]);
      return job;
    } catch (err) {
      handleError(err, 'AI processing');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const transcodeMedia = useCallback(async (request: MediaTranscodingRequest): Promise<ProcessingJob> => {
    try {
      setLoading(true);
      const job = await containerService.transcodeMedia(request);
      setJobs(prev => [job, ...prev]);
      return job;
    } catch (err) {
      handleError(err, 'transcoding media');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const executeCode = useCallback(async (request: CodeExecutionRequest): Promise<ProcessingJob> => {
    try {
      setLoading(true);
      const job = await containerService.executeCode(request);
      setJobs(prev => [job, ...prev]);
      return job;
    } catch (err) {
      handleError(err, 'executing code');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // ===== HEALTH MONITORING =====

  const refreshHealth = useCallback(async () => {
    try {
      const [healthData, pingResults] = await Promise.all([
        containerService.getContainerHealth(),
        containerService.pingContainerServices(),
      ]);
      
      setHealth({
        ...healthData,
        serviceStatus: pingResults,
        lastCheck: new Date().toISOString(),
      });

      // Update service health status
      const allHealthy = pingResults.every(result => result.status === 'healthy');
      setIsServiceHealthy(allHealthy);
      
    } catch (err) {
      handleError(err, 'checking health');
      setIsServiceHealthy(false);
    }
  }, [handleError]);

  // ===== EFFECTS =====

  // Load initial jobs on mount
  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  // Check health on mount and periodically
  useEffect(() => {
    refreshHealth();
    const healthInterval = setInterval(refreshHealth, 60000); // Check every minute
    
    return () => clearInterval(healthInterval);
  }, [refreshHealth]);

  // Poll for job updates when there are active jobs
  useEffect(() => {
    const activeJobs = jobs.filter(job => 
      job.status === 'pending' || job.status === 'processing'
    );

    if (activeJobs.length === 0) return;

    const pollInterval = setInterval(async () => {
      try {
        const updates = await Promise.allSettled(
          activeJobs.map(job => containerService.getJobStatus(job.jobId))
        );

        setJobs(prev => {
          const updated = [...prev];
          updates.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              const jobIndex = updated.findIndex(j => j.jobId === activeJobs[index].jobId);
              if (jobIndex !== -1) {
                updated[jobIndex] = result.value;
              }
            }
          });
          return updated;
        });
      } catch (err) {
        console.warn('Failed to poll job status:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [jobs]);

  return {
    // State
    jobs,
    loading,
    error,
    health,
    isServiceHealthy,
    
    // Actions
    processVideo,
    processDocument,
    processAI,
    transcodeMedia,
    executeCode,
    
    // Job Management
    refreshJobs,
    cancelJob,
    getJobStatus,
    
    // Health & Metrics
    refreshHealth,
    
    // Utility
    clearError,
  };
}

// ===== INDIVIDUAL HOOK EXPORTS =====

export function useVideoProcessing() {
  const { processVideo, jobs, loading, error } = useContainerServices();
  
  const videoJobs = jobs.filter(job => job.type === 'video');
  
  return {
    processVideo,
    videoJobs,
    loading,
    error,
  };
}

export function useDocumentProcessing() {
  const { processDocument, jobs, loading, error } = useContainerServices();
  
  const documentJobs = jobs.filter(job => job.type === 'document');
  
  return {
    processDocument,
    documentJobs,
    loading,
    error,
  };
}

export function useAIProcessing() {
  const { processAI, jobs, loading, error } = useContainerServices();
  
  const aiJobs = jobs.filter(job => job.type === 'ai');
  
  return {
    processAI,
    aiJobs,
    loading,
    error,
  };
}

export function useContainerHealth() {
  const { health, isServiceHealthy, refreshHealth } = useContainerServices();
  
  return {
    health,
    isServiceHealthy,
    refreshHealth,
  };
}

export default useContainerServices;