/**
 * Docker Runtime Configuration
 * Specific settings for Docker container runtime
 */

import { ContainerTestConfig } from '../test-config.ts';

export const dockerConfig: Partial<ContainerTestConfig> = {
  runtime: 'docker',
  
  // Docker-specific configuration
  compose: {
    file: 'docker-compose.test.yml',
    project: 'pitchey-container-test',
    buildArgs: [
      '--no-cache',         // Ensure fresh builds in tests
      '--parallel',         // Build services in parallel
    ],
    environment: {
      COMPOSE_PROJECT_NAME: 'pitchey-test',
      COMPOSE_FILE: 'docker-compose.test.yml',
      DOCKER_BUILDKIT: '1', // Enable BuildKit for faster builds
      BUILDKIT_PROGRESS: 'plain',
    },
  },
  
  commands: {
    // Core Docker Compose commands
    up: 'docker-compose -f docker-compose.test.yml up -d',
    down: 'docker-compose -f docker-compose.test.yml down -v',
    build: 'docker-compose -f docker-compose.test.yml build --no-cache',
    logs: 'docker-compose -f docker-compose.test.yml logs',
    ps: 'docker-compose -f docker-compose.test.yml ps',
    exec: 'docker-compose -f docker-compose.test.yml exec',
    
    // Scaling and management
    scale: 'docker-compose -f docker-compose.test.yml up --scale',
    restart: 'docker-compose -f docker-compose.test.yml restart',
    stop: 'docker-compose -f docker-compose.test.yml stop',
    
    // Monitoring and debugging
    stats: 'docker stats',
    inspect: 'docker inspect',
    top: 'docker-compose -f docker-compose.test.yml top',
    
    // Cleanup commands
    prune: 'docker system prune -f',
    volumePrune: 'docker volume prune -f',
    networkPrune: 'docker network prune -f',
    imagePrune: 'docker image prune -f',
  },
  
  healthCheck: {
    interval: 15000,        // 15 second health check intervals
    timeout: 10000,         // 10 second timeout per check
    retries: 5,             // 5 retries before marking unhealthy
    startPeriod: 60000,     // 60 second start period for services
  },
  
  networking: {
    driver: 'bridge',
    name: 'pitchey-test-network',
    subnet: '172.20.0.0/16',
    gateway: '172.20.0.1',
    isolation: true,        // Enable network isolation
  },
  
  volumes: {
    driver: 'local',
    cleanup: true,          // Clean up volumes after tests
    persistence: false,     // Don't persist test volumes
  },
  
  performance: {
    buildConcurrency: 3,    // Build up to 3 services concurrently
    pullConcurrency: 5,     // Pull up to 5 images concurrently
    enableBuildKit: true,   // Use Docker BuildKit
    enableMultiStage: true, // Support multi-stage builds
  },
  
  security: {
    enableSeccomp: true,    // Enable seccomp filtering
    enableAppArmor: false,  // Disable AppArmor (may not be available)
    enableSELinux: false,   // Disable SELinux (may not be available)
    runAsNonRoot: true,     // Run containers as non-root user
    readOnlyRootFS: false,  // Allow writable root filesystem for tests
    allowPrivileged: false, // Disallow privileged containers
    capDrop: ['ALL'],       // Drop all capabilities by default
    capAdd: [],             // Add specific capabilities if needed
  },
  
  logging: {
    driver: 'json-file',
    options: {
      'max-size': '10m',
      'max-file': '3',
      'labels': 'service,environment',
    },
  },
  
  registry: {
    url: 'docker.io',
    namespace: 'pitchey',
    tags: {
      latest: true,
      version: true,
      git: false,           // Don't tag with git commit in tests
    },
  },
  
  testSpecific: {
    // Test-specific Docker settings
    forceRecreate: true,    // Always recreate containers for tests
    noCache: true,          // Don't use build cache for tests
    quietPull: true,        // Reduce output noise during pulls
    removeOrphans: true,    // Remove orphaned containers
    
    // Resource limits for test containers
    resourceLimits: {
      cpuShares: 1024,      // CPU shares allocation
      memorySwap: '2g',     // Memory + swap limit
      memoryReservation: '512m', // Memory soft limit
      oomKillDisable: false, // Allow OOM killer
      pidsLimit: 1000,      // Limit number of processes
      ulimits: {
        nofile: { soft: 1024, hard: 2048 },
        nproc: { soft: 1024, hard: 2048 },
      },
    },
    
    // Test isolation settings
    tmpfs: {
      '/tmp': 'rw,size=100m',
      '/var/tmp': 'rw,size=50m',
    },
    
    // Environment variables for test containers
    environment: {
      NODE_ENV: 'test',
      DEBUG: 'false',
      LOG_LEVEL: 'warn',
      TEST_MODE: 'true',
      CONTAINER_RUNTIME: 'docker',
    },
  },
};

export default dockerConfig;