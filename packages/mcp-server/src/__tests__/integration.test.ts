/**
 * Integration tests for MCP server execution
 * 
 * Tests that the server can be spawned as a subprocess and properly
 * communicates via stdio using the MCP protocol.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("MCP Server Integration - Subprocess Execution", () => {
  let tempDir: string;
  let skillsDir: string;
  let serverProcess: ChildProcess | null = null;

  beforeEach(async () => {
    // Create temporary directory with test skills
    tempDir = await fs.mkdtemp(join(tmpdir(), "agentskills-integration-"));
    skillsDir = join(tempDir, ".agentskills", "skills");
    await fs.mkdir(skillsDir, { recursive: true });

    // Create a valid test skill
    const testSkillContent = `---
name: test-skill
description: A test skill for integration testing
---

# Test Skill

This is a test skill body with instructions.
`;
    await fs.writeFile(join(skillsDir, "test-skill.md"), testSkillContent);
  });

  afterEach(async () => {
    // Clean up subprocess if still running
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      serverProcess = null;
    }

    // Clean up temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should spawn server, initialize via MCP protocol, and expose use_skill tool", async () => {
    // Get path to compiled server binary
    const serverBinPath = join(
      process.cwd(),
      "dist",
      "bin.js"
    );

    // Spawn the server as a subprocess
    serverProcess = spawn("node", [serverBinPath, skillsDir], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Collect responses
    const responses: string[] = [];
    let buffer = "";

    serverProcess.stdout?.on("data", (data) => {
      buffer += data.toString();
      
      // Split by newlines to handle multiple JSON-RPC messages
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          responses.push(line.trim());
        }
      }
    });

    // Collect stderr for debugging
    let stderrOutput = "";
    serverProcess.stderr?.on("data", (data) => {
      stderrOutput += data.toString();
    });

    // Helper to send JSON-RPC message
    const sendMessage = (message: object) => {
      const json = JSON.stringify(message) + "\n";
      serverProcess?.stdin?.write(json);
    };

    // Helper to wait for a response
    const waitForResponse = (timeoutMs = 2000): Promise<object> => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (responses.length > 0) {
            clearInterval(checkInterval);
            const response = responses.shift()!;
            try {
              resolve(JSON.parse(response));
            } catch (error) {
              reject(new Error(`Failed to parse response: ${response}`));
            }
          } else if (Date.now() - startTime > timeoutMs) {
            clearInterval(checkInterval);
            reject(
              new Error(
                `Timeout waiting for response. stderr: ${stderrOutput}`
              )
            );
          }
        }, 50);
      });
    };

    // Step 1: Send initialize request
    sendMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: {
            listChanged: true,
          },
        },
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    });

    // Step 2: Wait for initialize response
    const initResponse = (await waitForResponse()) as any;
    expect(initResponse.id).toBe(1);
    expect(initResponse.result).toBeDefined();
    expect(initResponse.result.capabilities).toBeDefined();
    expect(initResponse.result.capabilities.tools).toBeDefined();

    // Step 3: Send initialized notification
    sendMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    // Step 4: Send tools/list request
    sendMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    // Step 5: Wait for tools/list response
    const toolsResponse = (await waitForResponse()) as any;
    expect(toolsResponse.id).toBe(2);
    expect(toolsResponse.result).toBeDefined();
    expect(toolsResponse.result.tools).toBeDefined();
    expect(Array.isArray(toolsResponse.result.tools)).toBe(true);

    // Step 6: Verify use_skill tool is exposed
    const useSkillTool = toolsResponse.result.tools.find(
      (tool: any) => tool.name === "use_skill"
    );
    expect(useSkillTool).toBeDefined();
    expect(useSkillTool.description).toBeDefined();
    expect(useSkillTool.inputSchema).toBeDefined();
    expect(useSkillTool.inputSchema.type).toBe("object");
    expect(useSkillTool.inputSchema.properties).toBeDefined();
    expect(useSkillTool.inputSchema.properties.skill_name).toBeDefined();

    // Cleanup: Close subprocess
    serverProcess.stdin?.end();
    
    // Wait for process to exit
    await new Promise<void>((resolve) => {
      serverProcess?.on("close", () => {
        resolve();
      });
      // Force kill after 1 second if not closed
      setTimeout(() => {
        if (serverProcess) {
          serverProcess.kill("SIGKILL");
          resolve();
        }
      }, 1000);
    });

    serverProcess = null;
  }, 10000); // 10 second timeout for the entire test
});
