/**
 * Podman Runtime Configuration
 * Specific settings for Podman container runtime with rootless support
 */

import { ContainerTestConfig } from '../test-config.ts';

export const podmanConfig: Partial<ContainerTestConfig> = {
  runtime: 'podman',
  
  // Podman-specific configuration
  compose: {
    file: 'docker-compose.test.yml', // Podman uses Docker Compose format
    project: 'pitchey-podman-test',
    buildArgs: [
      '--no-cache',
      '--layers=false',     // Disable intermediate layers caching
    ],
    environment: {
      COMPOSE_PROJECT_NAME: 'pitchey-podman-test',
      COMPOSE_FILE: 'docker-compose.test.yml',
      PODMAN_COMPOSE: '1',  // Indicate we're using Podman
      BUILDAH_FORMAT: 'docker', // Use Docker image format
    },
  },
  
  commands: {
    // Core Podman Compose commands
    up: 'podman-compose -f docker-compose.test.yml up -d',
    down: 'podman-compose -f docker-compose.test.yml down -v',
    build: 'podman-compose -f docker-compose.test.yml build --no-cache',
    logs: 'podman-compose -f docker-compose.test.yml logs',
    ps: 'podman-compose -f docker-compose.test.yml ps',
    exec: 'podman-compose -f docker-compose.test.yml exec',
    
    // Scaling and management
    scale: 'podman-compose -f docker-compose.test.yml up --scale',
    restart: 'podman-compose -f docker-compose.test.yml restart',
    stop: 'podman-compose -f docker-compose.test.yml stop',
    
    // Podman-specific commands
    stats: 'podman stats',
    inspect: 'podman inspect',
    top: 'podman top',
    
    // Cleanup commands (Podman-specific)
    prune: 'podman system prune -f',
    volumePrune: 'podman volume prune -f',
    networkPrune: 'podman network prune -f',
    imagePrune: 'podman image prune -f',
    
    // Podman pod management
    podCreate: 'podman pod create',
    podStart: 'podman pod start',
    podStop: 'podman pod stop',
    podRm: 'podman pod rm',
  },
  
  healthCheck: {
    interval: 20000,        // Slightly longer intervals for Podman
    timeout: 15000,         // Longer timeout due to potential rootless overhead
    retries: 5,
    startPeriod: 90000,     // Longer start period for rootless containers
  },
  
  networking: {
    driver: 'bridge',       // Use bridge networking
    name: 'pitchey-podman-test',
    subnet: '10.88.0.0/16', // Different subnet to avoid conflicts
    gateway: '10.88.0.1',
    isolation: true,
    rootless: true,         // Enable rootless networking
    cni: {
      enabled: true,
      plugins: ['bridge', 'portmap', 'firewall'],
    },
  },
  
  volumes: {
    driver: 'local',
    cleanup: true,
    persistence: false,
    rootless: true,         // Use rootless volume mounting
    selinuxLabel: 'Z',      // SELinux label for volume mounts
  },
  
  performance: {
    buildConcurrency: 2,    // Reduced concurrency for Podman
    pullConcurrency: 3,     // Reduced pull concurrency
    enableBuildKit: false,  // Podman uses Buildah instead
    enableMultiStage: true, // Support multi-stage builds
    buildBackend: 'buildah', // Use Buildah as build backend
  },
  
  security: {
    enableSeccomp: true,    // Enable seccomp filtering
    enableAppArmor: false,  // May not be available in rootless
    enableSELinux: true,    // Enable SELinux if available
    runAsNonRoot: true,     // Podman runs rootless by default
    readOnlyRootFS: false,  // Allow writable root filesystem for tests
    allowPrivileged: false, // Disallow privileged containers
    capDrop: ['ALL'],       // Drop all capabilities
    capAdd: [],             // Add specific capabilities if needed
    rootless: true,         // Enable rootless mode
    userNamespace: true,    // Use user namespaces
    noNewPrivileges: true,  // Prevent privilege escalation
  },
  
  logging: {
    driver: 'journald',     // Use systemd journal for logging
    options: {
      'labels': 'service,environment',
      'env': 'SERVICE_NAME,LOG_LEVEL',
    },
  },
  
  registry: {
    url: 'docker.io',
    namespace: 'pitchey',
    shortName: {
      enabled: true,        // Enable short name resolution
      registries: ['docker.io', 'quay.io', 'registry.fedoraproject.org'],
    },
    tags: {
      latest: true,
      version: true,
      git: false,
    },
  },
  
  testSpecific: {
    // Podman-specific test settings
    forceRecreate: true,
    noCache: true,
    quietPull: true,
    removeOrphans: true,
    
    // Rootless-specific configuration
    rootless: {
      enabled: true,
      uidMapping: 'auto',    // Automatic UID mapping
      gidMapping: 'auto',    // Automatic GID mapping
      subuidSize: 65536,     // Size of subordinate UID range
      subgidSize: 65536,     // Size of subordinate GID range
    },
    
    // Resource limits for Podman
    resourceLimits: {
      cpuShares: 1024,
      memorySwap: '2g',
      memoryReservation: '512m',
      oomKillDisable: false,
      pidsLimit: 1000,
      ulimits: {
        nofile: { soft: 1024, hard: 2048 },
        nproc: { soft: 512, hard: 1024 }, // Lower for rootless
      },
    },
    
    // Podman-specific mounts
    tmpfs: {
      '/tmp': 'rw,size=100m,noexec',
      '/var/tmp': 'rw,size=50m,noexec',
    },
    
    // Podman environment variables
    environment: {
      NODE_ENV: 'test',
      DEBUG: 'false',
      LOG_LEVEL: 'warn',
      TEST_MODE: 'true',
      CONTAINER_RUNTIME: 'podman',
      PODMAN_ROOTLESS: 'true',
    },
    
    // Systemd integration (if available)
    systemd: {
      enabled: false,       // Disable for tests
      scope: 'user',        // Use user scope
      notify: false,        // Disable notify socket
    },
    
    // Security context for rootless
    securityContext: {
      runAsUser: 1000,      // Run as user 1000
      runAsGroup: 1000,     // Run as group 1000
      fsGroup: 1000,        // Set filesystem group
      allowPrivilegeEscalation: false,
    },
  },
  
  // Podman-specific features
  features: {
    buildah: true,          // Use Buildah for builds
    crun: true,             // Use crun runtime
    conmon: true,           // Use conmon for container monitoring
    cgroups: 'v2',          // Use cgroups v2
    storage: {
      driver: 'overlay',    // Use overlay storage driver
      options: {
        'overlay.mount_program': '/usr/bin/fuse-overlayfs',
      },
    },
  },
};

export default podmanConfig;