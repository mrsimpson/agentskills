#!/usr/bin/env node

/**
 * Executable entry point for Agent Skills MCP Server
 * 
 * Usage: agentskills-mcp [project-directory]
 * 
 * If no directory provided, uses current working directory.
 * Reads package.json from project directory to load skill configuration.
 * Skills are loaded from .agentskills/skills within the project directory.
 */

import { SkillRegistry, PackageConfigManager } from "@codemcp/agentskills-core";
import { MCPServer } from "./server.js";
import * as path from "node:path";
import * as fs from "node:fs";

async function main() {
  // Get project directory from CLI args or use current directory
  const projectDir = process.argv[2] || process.cwd();

  // Validate project directory exists
  if (!fs.existsSync(projectDir)) {
    console.error(`Project directory not found: ${projectDir}`);
    process.exit(1);
  }

  // Validate it's a directory
  const projectStat = fs.statSync(projectDir);
  if (!projectStat.isDirectory()) {
    console.error(`Not a directory: ${projectDir}`);
    process.exit(1);
  }

  try {
    // Check if package.json exists
    const packageJsonPath = path.join(projectDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      console.error(`package.json not found in: ${projectDir}`);
      console.error(`\nPlease create a package.json with agentskills field:`);
      console.error(`{`);
      console.error(`  "name": "my-project",`);
      console.error(`  "agentskills": {`);
      console.error(`    "skill-name": "npm:package-name" or "file:./path"`);
      console.error(`  }`);
      console.error(`}`);
      process.exit(1);
    }

    // Read package.json configuration
    const configManager = new PackageConfigManager(projectDir);
    const config = await configManager.loadConfig();

    // Get skills directory from config (or use default)
    const skillsDir = path.join(projectDir, config.config.skillsDirectory);

    // Check if skills directory exists
    if (!fs.existsSync(skillsDir)) {
      console.error(`Skills directory not found: ${skillsDir}`);
      console.error(
        `\nRun 'agentskills install' to install configured skills.`
      );
      process.exit(1);
    }

    // Warn if no skills are configured
    if (Object.keys(config.skills).length === 0) {
      console.error(
        `Warning: No skills configured in package.json agentskills field`
      );
      console.error(`The server will start but no skills will be available.`);
    }

    // Create registry and load skills
    const registry = new SkillRegistry();
    await registry.loadSkills(skillsDir);

    // Create and start server
    const server = new MCPServer(registry);
    await server.start();

    // Server is now running via stdio
    // Keep process alive until stdin closes
    process.stdin.on("close", () => {
      process.exit(0);
    });
  } catch (error) {
    // Only write to stderr if we haven't started stdio communication
    process.stderr.write(`Failed to start MCP server: ${error}\n`);
    process.exit(1);
  }
}

main();
