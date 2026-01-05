/**
 * Container Services for Pitchey Platform
 * 
 * This module provides containerized services for media processing, AI inference,
 * and code execution within the Cloudflare Workers environment.
 * 
 * Note: These are service containers that can scale to zero and provide
 * orchestrated processing capabilities through HTTP endpoints.
 */

export { BaseContainer } from './base-container';
export { VideoProcessorContainer } from './video-processor';
export { DocumentProcessorContainer } from './document-processor';
export { AIInferenceContainer } from './ai-inference';
export { MediaTranscoderContainer } from './media-transcoder';
export { CodeExecutorContainer } from './code-executor';

// Container base types
export type ContainerStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

export interface ContainerConfig {
  defaultPort: number;
  sleepAfter: number; // seconds of inactivity before scaling to zero
  maxConcurrency: number;
  memoryLimit?: string;
  environment: Record<string, string>;
}

export interface ContainerHealth {
  status: ContainerStatus;
  uptime: number;
  lastActivity: number;
  errorCount: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface JobResult<T = any> {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: T;
  error?: string;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, any>;
}

// Base container interface that all containers implement
export interface IContainer {
  readonly name: string;
  readonly config: ContainerConfig;
  
  // Lifecycle methods
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  health(): Promise<ContainerHealth>;
  
  // Processing methods
  processJob<T>(jobType: string, payload: any): Promise<JobResult<T>>;
  getJobStatus(jobId: string): Promise<JobResult>;
  cancelJob(jobId: string): Promise<boolean>;
  
  // HTTP communication
  makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T>;
}

// Container orchestrator for managing multiple container services
export class ContainerOrchestrator {
  private containers = new Map<string, IContainer>();
  
  registerContainer(container: IContainer): void {
    this.containers.set(container.name, container);
  }
  
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.containers.values()).map(c => c.start());
    await Promise.all(startPromises);
  }
  
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.containers.values()).map(c => c.stop());
    await Promise.all(stopPromises);
  }
  
  getContainer<T extends IContainer>(name: string): T | undefined {
    return this.containers.get(name) as T;
  }
  
  async healthCheck(): Promise<Record<string, ContainerHealth>> {
    const health: Record<string, ContainerHealth> = {};
    
    for (const [name, container] of this.containers) {
      try {
        health[name] = await container.health();
      } catch (error) {
        health[name] = {
          status: 'error',
          uptime: 0,
          lastActivity: 0,
          errorCount: 1
        };
      }
    }
    
    return health;
  }
}

// Global orchestrator instance
export const containerOrchestrator = new ContainerOrchestrator();