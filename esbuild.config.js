const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/worker-integrated.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/worker.js',
  platform: 'browser',
  target: 'es2020',
  external: ['node:async_hooks', 'os', 'fs', 'crypto', 'path', 'stream'],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  alias: {
    'node:async_hooks': './src/utils/async-hooks-shim.ts',
  },
  logLevel: 'info',
}).catch(() => process.exit(1));
