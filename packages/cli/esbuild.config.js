import { build } from 'esbuild';

// Plugin to make all node_modules external
const externalPlugin = {
  name: 'make-all-external',
  setup(build) {
    // Match any import that doesn't start with . or /
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  platform: 'node',
  format: 'esm',
  plugins: [externalPlugin],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
