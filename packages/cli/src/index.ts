#!/usr/bin/env node

import { createCLI } from "./cli.js";

const program = createCLI();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error("Error:", error);
  process.exit(1);
}
