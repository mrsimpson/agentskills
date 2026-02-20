#!/usr/bin/env node

/**
 * Executable entry point for Agent Skills MCP Server
 * 
 * Usage: agentskills-mcp [skills-directory]
 * 
 * If no directory provided, uses .agentskills/skills in current directory
 */

import { SkillRegistry } from "@agentskills/core";
import { MCPServer } from "./server.js";
import * as path from "node:path";
import * as fs from "node:fs";

async function main() {
  // Get skills directory from CLI args or use default
  const skillsDir =
    process.argv[2] || path.join(process.cwd(), ".agentskills", "skills");

  // Validate directory exists
  if (!fs.existsSync(skillsDir)) {
    console.error(`Skills directory not found: ${skillsDir}`);
    process.exit(1);
  }

  try {
    // Create registry and load skills
    const registry = new SkillRegistry();
    await registry.loadSkills(skillsDir);

    // Create and start server
    const server = new MCPServer(registry);

    // Server is now running via stdio
    // Keep process alive until stdin closes
    process.stdin.on("close", () => {
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

main();
