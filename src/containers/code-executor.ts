/**
 * Code Executor Container
 * 
 * Provides sandboxed code execution environment for running user scripts,
 * automation workflows, and custom business logic processing.
 */

import { BaseContainer } from './base-container';
import { ContainerConfig } from './index';

export interface CodeExecutionJob {
  language: 'javascript' | 'python' | 'node' | 'deno' | 'bash' | 'sql';
  code: string;
  context?: {
    variables?: Record<string, any>;
    environment?: Record<string, string>;
    imports?: string[];
    dependencies?: string[];
  };
  execution?: {
    timeout?: number; // milliseconds
    memoryLimit?: number; // MB
    cpuLimit?: number; // percentage
    networkAccess?: boolean;
    fileSystem?: 'read-only' | 'temporary' | 'none';
    allowedDomains?: string[];
    maxOutputSize?: number; // bytes
  };
  security?: {
    sandboxLevel: 'strict' | 'moderate' | 'relaxed';
    allowedModules?: string[];
    blockedFunctions?: string[];
    resourceLimits?: Record<string, number>;
  };
}

export interface CodeExecutionResult {
  success: boolean;
  output: {
    stdout: string;
    stderr: string;
    returnValue?: any;
    exitCode?: number;
  };
  execution: {
    duration: number;
    memoryUsed: number;
    cpuUsed: number;
    networkCalls?: Array<{
      url: string;
      method: string;
      status: number;
      duration: number;
    }>;
  };
  security: {
    violations?: string[];
    blockedCalls?: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
  logs: Array<{
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: number;
  }>;
  files?: {
    created: string[];
    modified: string[];
    read: string[];
  };
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  triggers: Array<{
    type: 'schedule' | 'webhook' | 'event';
    config: Record<string, any>;
  }>;
  steps: Array<{
    id: string;
    type: 'code' | 'http' | 'database' | 'email' | 'condition';
    config: Record<string, any>;
    dependsOn?: string[];
  }>;
  environment: Record<string, string>;
  settings: {
    retryPolicy?: {
      maxAttempts: number;
      backoffMs: number;
    };
    timeouts?: Record<string, number>;
  };
}

export interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: Array<{
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: number;
    endTime?: number;
    result?: any;
    error?: string;
  }>;
  startTime: number;
  endTime?: number;
  context: Record<string, any>;
}

export interface SecurityPolicy {
  allowedLanguages: string[];
  defaultTimeout: number;
  maxTimeout: number;
  defaultMemoryLimit: number;
  maxMemoryLimit: number;
  networkPolicy: {
    allowInternet: boolean;
    allowedDomains: string[];
    blockedDomains: string[];
  };
  fileSystemPolicy: {
    allowFileAccess: boolean;
    readOnlyPaths: string[];
    tempDirectoryAccess: boolean;
  };
  modulePolicy: {
    allowedModules: string[];
    blockedModules: string[];
    allowDynamicImports: boolean;
  };
}

export class CodeExecutorContainer extends BaseContainer {
  private sandboxDir: string = '/tmp/sandbox';
  private scriptsDir: string = '/tmp/scripts';
  private maxConcurrentExecutions: number = 10;
  private activeExecutions = new Set<string>();
  private workflows = new Map<string, AutomationWorkflow>();
  private workflowExecutions = new Map<string, WorkflowExecution>();
  private securityPolicy: SecurityPolicy;
  private languageRuntimes = new Map<string, any>();
  
  constructor() {
    super('code-executor', {
      defaultPort: 8084,
      sleepAfter: 300, // 5 minutes
      maxConcurrency: 10,
      memoryLimit: '4GB',
      environment: {
        SANDBOX_DIR: '/tmp/sandbox',
        SCRIPTS_DIR: '/tmp/scripts',
        NODE_PATH: '/usr/local/bin/node',
        PYTHON_PATH: '/usr/bin/python3',
        DENO_PATH: '/usr/local/bin/deno',
        MAX_EXECUTION_TIME: '30000',
        MAX_MEMORY_MB: '512',
        NETWORK_TIMEOUT: '10000',
        ALLOW_NETWORK_ACCESS: 'true',
        SECURITY_LEVEL: 'moderate'
      }
    });
    
    this.initializeSecurityPolicy();
  }
  
  protected async onStart(): Promise<void> {
    this.log('info', 'Initializing code executor container');
    
    // Verify runtime environments
    await this.verifyRuntimeEnvironments();
    
    // Setup sandbox environment
    await this.setupSandboxEnvironment();
    
    // Initialize language runtimes
    await this.initializeLanguageRuntimes();
    
    // Load automation workflows
    await this.loadWorkflows();
    
    // Start HTTP server
    await this.startHttpServer();
    
    this.log('info', 'Code executor container ready');
  }
  
  protected async onStop(): Promise<void> {
    this.log('info', 'Stopping code executor container');
    
    // Cancel running executions
    for (const executionId of this.activeExecutions) {
      await this.cancelExecution(executionId);
    }
    
    // Stop workflow executions
    for (const [executionId, execution] of this.workflowExecutions) {
      if (execution.status === 'running') {
        await this.cancelWorkflowExecution(executionId);
      }
    }
    
    // Cleanup sandbox
    await this.cleanupSandbox();
    
    this.log('info', 'Code executor container stopped');
  }
  
  protected async onError(error: Error): Promise<void> {
    this.log('error', 'Code executor container error', error);
    
    try {
      await this.setupSandboxEnvironment();
    } catch (recoveryError) {
      this.log('error', 'Failed to recover sandbox environment', recoveryError);
    }
  }
  
  protected async processJobInternal<T>(jobType: string, payload: any): Promise<T> {
    switch (jobType) {
      case 'execute-code':
        return await this.executeCode(payload) as T;
      
      case 'execute-workflow':
        return await this.executeWorkflow(payload) as T;
      
      case 'validate-code':
        return await this.validateCode(payload) as T;
      
      case 'analyze-code':
        return await this.analyzeCode(payload) as T;
      
      case 'test-code':
        return await this.testCode(payload) as T;
      
      case 'deploy-function':
        return await this.deployFunction(payload) as T;
      
      case 'run-batch-job':
        return await this.runBatchJob(payload) as T;
      
      default:
        throw new Error(`Unsupported job type: ${jobType}`);
    }
  }
  
  // Public execution methods
  async executeCode(job: CodeExecutionJob): Promise<CodeExecutionResult> {
    const executionId = this.generateJobId();
    this.activeExecutions.add(executionId);
    
    try {
      this.log('info', `Executing ${job.language} code: ${executionId}`);
      
      // Validate security constraints
      await this.validateSecurityConstraints(job);
      
      // Prepare execution environment
      const sandboxPath = await this.prepareSandboxEnvironment(executionId, job);
      
      // Execute code in sandbox
      const startTime = Date.now();
      const result = await this.runCodeInSandbox(sandboxPath, job);
      const duration = Date.now() - startTime;
      
      // Collect execution metrics
      const metrics = await this.collectExecutionMetrics(sandboxPath, duration);
      
      // Cleanup sandbox
      await this.cleanupExecutionEnvironment(executionId);
      
      return {
        success: result.success,
        output: result.output,
        execution: metrics,
        security: {
          violations: result.securityViolations || [],
          blockedCalls: result.blockedCalls || [],
          riskLevel: this.assessRiskLevel(result)
        },
        logs: result.logs || [],
        files: result.files
      };
      
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }
  
  async executeWorkflow(payload: { workflowId: string; triggerData?: any }): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(payload.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${payload.workflowId} not found`);
    }
    
    const executionId = this.generateJobId();
    const execution: WorkflowExecution = {
      workflowId: payload.workflowId,
      executionId,
      status: 'running',
      steps: workflow.steps.map(step => ({
        stepId: step.id,
        status: 'pending'
      })),
      startTime: Date.now(),
      context: payload.triggerData || {}
    };
    
    this.workflowExecutions.set(executionId, execution);
    
    try {
      // Execute workflow steps
      await this.executeWorkflowSteps(execution, workflow);
      
      execution.status = 'completed';
      execution.endTime = Date.now();
      
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      this.log('error', `Workflow execution failed: ${executionId}`, error);
    }
    
    return execution;
  }
  
  async validateCode(payload: { language: string; code: string }): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const validationConfig = {
      language: payload.language,
      code: payload.code,
      strictMode: true
    };
    
    return await this.makeRequest<{ valid: boolean; errors: string[]; warnings: string[] }>('/validation/code', {
      method: 'POST',
      body: JSON.stringify(validationConfig)
    });
  }
  
  async analyzeCode(payload: { language: string; code: string }): Promise<{
    complexity: number;
    performance: string[];
    security: string[];
    bestPractices: string[];
    dependencies: string[];
  }> {
    const analysisConfig = {
      language: payload.language,
      code: payload.code,
      analysisType: 'comprehensive'
    };
    
    return await this.makeRequest<any>('/analysis/code', {
      method: 'POST',
      body: JSON.stringify(analysisConfig)
    });
  }
  
  async testCode(payload: { language: string; code: string; tests: string }): Promise<{
    passed: number;
    failed: number;
    results: Array<{
      name: string;
      status: 'pass' | 'fail';
      duration: number;
      error?: string;
    }>;
  }> {
    const testConfig = {
      language: payload.language,
      code: payload.code,
      tests: payload.tests
    };
    
    return await this.makeRequest<any>('/testing/run', {
      method: 'POST',
      body: JSON.stringify(testConfig)
    });
  }
  
  async deployFunction(payload: {
    name: string;
    language: string;
    code: string;
    config: Record<string, any>;
  }): Promise<{
    functionId: string;
    endpoint: string;
    status: 'deployed' | 'failed';
  }> {
    const deploymentConfig = {
      name: payload.name,
      language: payload.language,
      code: payload.code,
      config: payload.config
    };
    
    return await this.makeRequest<any>('/deployment/function', {
      method: 'POST',
      body: JSON.stringify(deploymentConfig)
    });
  }
  
  async runBatchJob(payload: {
    jobs: Array<{
      id: string;
      language: string;
      code: string;
      context?: Record<string, any>;
    }>;
    concurrent?: number;
  }): Promise<Array<{ id: string; result: CodeExecutionResult }>> {
    const concurrency = Math.min(payload.concurrent || 5, this.config.maxConcurrency);
    const results: Array<{ id: string; result: CodeExecutionResult }> = [];
    
    // Process jobs in batches
    for (let i = 0; i < payload.jobs.length; i += concurrency) {
      const batch = payload.jobs.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async job => ({
          id: job.id,
          result: await this.executeCode({
            language: job.language,
            code: job.code,
            context: job.context
          })
        }))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  // Workflow management
  async registerWorkflow(workflow: AutomationWorkflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
    
    // Persist workflow
    await this.makeRequest('/workflows/register', {
      method: 'POST',
      body: JSON.stringify(workflow)
    });
    
    this.log('info', `Registered workflow: ${workflow.id}`);
  }
  
  async getWorkflow(workflowId: string): Promise<AutomationWorkflow | undefined> {
    return this.workflows.get(workflowId);
  }
  
  async listWorkflows(): Promise<AutomationWorkflow[]> {
    return Array.from(this.workflows.values());
  }
  
  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution | undefined> {
    return this.workflowExecutions.get(executionId);
  }
  
  async cancelExecution(executionId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/execution/${executionId}/cancel`, {
        method: 'POST'
      });
      return true;
    } catch (error) {
      this.log('error', `Failed to cancel execution ${executionId}`, error);
      return false;
    }
  }
  
  async cancelWorkflowExecution(executionId: string): Promise<boolean> {
    const execution = this.workflowExecutions.get(executionId);
    if (!execution) {
      return false;
    }
    
    execution.status = 'cancelled';
    execution.endTime = Date.now();
    
    return true;
  }
  
  // Private helper methods
  private initializeSecurityPolicy(): void {
    this.securityPolicy = {
      allowedLanguages: ['javascript', 'python', 'node', 'deno'],
      defaultTimeout: 30000,
      maxTimeout: 300000,
      defaultMemoryLimit: 512,
      maxMemoryLimit: 2048,
      networkPolicy: {
        allowInternet: this.config.environment.ALLOW_NETWORK_ACCESS === 'true',
        allowedDomains: [],
        blockedDomains: ['localhost', '127.0.0.1', '0.0.0.0']
      },
      fileSystemPolicy: {
        allowFileAccess: true,
        readOnlyPaths: ['/etc', '/usr', '/bin'],
        tempDirectoryAccess: true
      },
      modulePolicy: {
        allowedModules: ['fs', 'path', 'crypto', 'util'],
        blockedModules: ['child_process', 'cluster', 'dgram', 'net'],
        allowDynamicImports: false
      }
    };
  }
  
  private async verifyRuntimeEnvironments(): Promise<void> {
    const runtimes = await this.makeRequest<Record<string, any>>('/runtimes/verify');
    this.log('info', 'Runtime environments:', runtimes);
  }
  
  private async setupSandboxEnvironment(): Promise<void> {
    await this.makeRequest('/sandbox/setup', {
      method: 'POST',
      body: JSON.stringify({
        sandboxDir: this.sandboxDir,
        securityPolicy: this.securityPolicy
      })
    });
  }
  
  private async initializeLanguageRuntimes(): Promise<void> {
    const runtimes = ['node', 'python', 'deno'];
    
    for (const runtime of runtimes) {
      try {
        const config = await this.makeRequest(`/runtime/${runtime}/initialize`, {
          method: 'POST'
        });
        this.languageRuntimes.set(runtime, config);
      } catch (error) {
        this.log('warn', `Failed to initialize ${runtime} runtime`, error);
      }
    }
  }
  
  private async loadWorkflows(): Promise<void> {
    try {
      const workflows = await this.makeRequest<AutomationWorkflow[]>('/workflows/load');
      for (const workflow of workflows) {
        this.workflows.set(workflow.id, workflow);
      }
      this.log('info', `Loaded ${workflows.length} workflows`);
    } catch (error) {
      this.log('warn', 'Failed to load workflows', error);
    }
  }
  
  private async startHttpServer(): Promise<void> {
    await this.makeRequest('/server/start', {
      method: 'POST',
      body: JSON.stringify({ port: this.config.defaultPort })
    });
  }
  
  private async validateSecurityConstraints(job: CodeExecutionJob): Promise<void> {
    const violations: string[] = [];
    
    // Check language allowlist
    if (!this.securityPolicy.allowedLanguages.includes(job.language)) {
      violations.push(`Language ${job.language} not allowed`);
    }
    
    // Check timeout limits
    const timeout = job.execution?.timeout || this.securityPolicy.defaultTimeout;
    if (timeout > this.securityPolicy.maxTimeout) {
      violations.push(`Timeout ${timeout}ms exceeds maximum ${this.securityPolicy.maxTimeout}ms`);
    }
    
    // Check memory limits
    const memoryLimit = job.execution?.memoryLimit || this.securityPolicy.defaultMemoryLimit;
    if (memoryLimit > this.securityPolicy.maxMemoryLimit) {
      violations.push(`Memory limit ${memoryLimit}MB exceeds maximum ${this.securityPolicy.maxMemoryLimit}MB`);
    }
    
    if (violations.length > 0) {
      throw new Error(`Security violations: ${violations.join(', ')}`);
    }
  }
  
  private async prepareSandboxEnvironment(executionId: string, job: CodeExecutionJob): Promise<string> {
    const sandboxPath = `${this.sandboxDir}/${executionId}`;
    
    await this.makeRequest('/sandbox/prepare', {
      method: 'POST',
      body: JSON.stringify({
        executionId,
        sandboxPath,
        job
      })
    });
    
    return sandboxPath;
  }
  
  private async runCodeInSandbox(sandboxPath: string, job: CodeExecutionJob): Promise<any> {
    const executionConfig = {
      sandboxPath,
      language: job.language,
      code: job.code,
      context: job.context,
      execution: job.execution,
      security: job.security
    };
    
    return await this.makeRequest<any>('/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify(executionConfig)
    });
  }
  
  private async collectExecutionMetrics(sandboxPath: string, duration: number): Promise<any> {
    const metrics = await this.makeRequest<any>('/sandbox/metrics', {
      method: 'POST',
      body: JSON.stringify({ sandboxPath })
    });
    
    return {
      duration,
      memoryUsed: metrics.memoryUsed,
      cpuUsed: metrics.cpuUsed,
      networkCalls: metrics.networkCalls
    };
  }
  
  private async cleanupExecutionEnvironment(executionId: string): Promise<void> {
    await this.makeRequest('/sandbox/cleanup', {
      method: 'POST',
      body: JSON.stringify({ executionId })
    });
  }
  
  private async executeWorkflowSteps(execution: WorkflowExecution, workflow: AutomationWorkflow): Promise<void> {
    for (const step of workflow.steps) {
      const executionStep = execution.steps.find(s => s.stepId === step.id);
      if (!executionStep) continue;
      
      // Check dependencies
      if (step.dependsOn) {
        const dependenciesCompleted = step.dependsOn.every(depId => {
          const dep = execution.steps.find(s => s.stepId === depId);
          return dep?.status === 'completed';
        });
        
        if (!dependenciesCompleted) {
          executionStep.status = 'skipped';
          continue;
        }
      }
      
      executionStep.status = 'running';
      executionStep.startTime = Date.now();
      
      try {
        const result = await this.executeWorkflowStep(step, execution.context);
        executionStep.result = result;
        executionStep.status = 'completed';
      } catch (error) {
        executionStep.error = error instanceof Error ? error.message : String(error);
        executionStep.status = 'failed';
        throw error; // Stop workflow execution on failure
      } finally {
        executionStep.endTime = Date.now();
      }
    }
  }
  
  private async executeWorkflowStep(step: any, context: Record<string, any>): Promise<any> {
    switch (step.type) {
      case 'code':
        return await this.executeCode({
          language: step.config.language,
          code: step.config.code,
          context: { variables: context }
        });
      
      case 'http':
        return await this.makeRequest(step.config.url, step.config.options);
      
      case 'database':
        return await this.makeRequest('/database/query', {
          method: 'POST',
          body: JSON.stringify(step.config)
        });
      
      default:
        throw new Error(`Unsupported step type: ${step.type}`);
    }
  }
  
  private assessRiskLevel(result: any): 'low' | 'medium' | 'high' {
    if (result.securityViolations?.length > 0) {
      return 'high';
    }
    if (result.blockedCalls?.length > 0) {
      return 'medium';
    }
    return 'low';
  }
  
  private async cleanupSandbox(): Promise<void> {
    await this.makeRequest('/sandbox/cleanup-all', {
      method: 'POST'
    });
  }
}