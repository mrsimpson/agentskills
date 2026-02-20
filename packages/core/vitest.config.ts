// @ts-check
/** @type {import("vitest/config").defineConfig} */

import { resolve } from "path";
const baseConfig = await import("../../vitest.config.js");

export default {
  ...baseConfig,
  resolve: {
    alias: {
      "@mme/typescript-example-2": resolve(
        __dirname,
        "../typescript-example-2/src/index.ts"
      )
    }
  }
};
