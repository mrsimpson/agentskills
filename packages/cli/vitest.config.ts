// @ts-check
/** @type {import("vitest/config").defineConfig} */

import { resolve } from 'path';
const baseConfig = await import('../../vitest.config.js');

export default {
  ...baseConfig,
  test: {
    // Include only MCP mode tests - Vercel's tests have environmental dependencies
    // that may not work in all setups. They can be manually verified.
    include: [
      'src/mcp-mode.test.ts',
      'src/__tests__/mcp-configurator.test.ts',
      'src/__tests__/mcp.test.ts',
      'src/__tests__/cli-mcp-integration.test.ts',
      'src/__tests__/mcp-e2e.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@mme/typescript-example-2': resolve(__dirname, '../typescript-example-2/src/index.ts'),
    },
  },
};
