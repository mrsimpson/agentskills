import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MCPServer } from "../server.js";
import { SkillRegistry } from "@agentskills/core";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * MCPServer Core Tests (TDD RED Phase)
 * 
 * These tests define the expected behavior of the MCPServer class.
 * Following TDD approach: write tests first (RED), then implement (GREEN).
 * 
 * Architecture:
 * - MCPServer only accepts SkillRegistry via dependency injection
 * - Server is immediately ready after construction (no start/stop methods)
 * - Separation of concerns: MCPServer handles MCP protocol, SkillRegistry handles skill loading
 */

describe("MCPServer", () => {
  let testDir: string;
  let skillsDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `mcp-server-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    skillsDir = join(testDir, "skills");
    await fs.mkdir(skillsDir, { recursive: true });

    // Create a test skill
    const skillDir = join(skillsDir, "test-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: test-skill
description: A test skill for unit tests
---
# Test Skill

This is a test skill.
`
    );
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Constructor & Initialization", () => {
    it("should be instantiated with SkillRegistry", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);

      // Act
      const server = new MCPServer(registry);

      // Assert
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(MCPServer);
    });

    it("should be immediately ready after construction", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);

      // Act
      const server = new MCPServer(registry);

      // Assert - server should be usable immediately
      expect(server).toBeDefined();
      expect(server.getCapabilities()).toBeDefined();
      expect(server.getTools()).toBeDefined();
    });
  });

  describe("Capabilities Announcement", () => {
    it("should announce tools capability", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer(registry);

      // Act
      const capabilities = server.getCapabilities();

      // Assert
      expect(capabilities).toBeDefined();
      expect(capabilities.tools).toBeDefined();
    });

    it("should announce resources capability", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer(registry);

      // Act
      const capabilities = server.getCapabilities();

      // Assert
      expect(capabilities).toBeDefined();
      expect(capabilities.resources).toBeDefined();
    });
  });

  describe("Request Routing (basic tests with stubbed responses)", () => {
    it("should route tools/list requests", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();

      // Assert
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should route tools/call requests", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer(registry);

      // Act
      const result = await server.callTool("use_skill", { skill_name: "test-skill" });

      // Assert
      expect(result).toBeDefined();
      // Tool execution should return proper result
    });

    it("should route resources/templates/list requests", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer(registry);

      // Act
      const templates = server.getResourceTemplates();

      // Assert
      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
    });

    it("should route resources/read requests", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer(registry);

      // Act
      const result = await server.readResource("skill://test-skill/SKILL.md");

      // Assert
      expect(result).toBeDefined();
      // Stub can return anything for now, just verify it doesn't throw
    });
  });

  describe("Error Handling", () => {
    it("should handle errors without crashing", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer(registry);

      // Act & Assert - calling non-existent tool should not throw
      const result = await server.callTool("non-existent-tool", {});
      expect(result).toBeDefined();
    });

    it("should return proper error responses for invalid tool calls", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer(registry);

      // Act
      const result = await server.callTool("non-existent-tool", {});

      // Assert
      expect(result).toBeDefined();
      // Should return error result, not throw
      expect((result as any).isError || (result as any).error).toBeDefined();
    });
  });
});
