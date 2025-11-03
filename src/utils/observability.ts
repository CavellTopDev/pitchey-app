export function setupObservability(env: { CF_RAY?: string; CF_COLO?: string }) {
  return {
    log: (level: string, message: string, meta: Record<string, unknown> = {}) => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
        cf: {
          ray: env.CF_RAY,
          colo: (env as any).CF_COLO,
        },
      }))
    },
  }
}