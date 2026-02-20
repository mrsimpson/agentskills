import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
      const server = new MCPServer({ registry });

      // Assert
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(MCPServer);
    });

    it("should be instantiated with skills directory path (creates registry internally)", () => {
      // Act
      const server = new MCPServer({ skillsDir });

      // Assert
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(MCPServer);
    });

    it("should throw error if skills directory doesn't exist", () => {
      // Arrange
      const nonExistentDir = join(testDir, "non-existent");

      // Act & Assert
      expect(() => new MCPServer({ skillsDir: nonExistentDir })).toThrow();
    });

    it("should throw error if neither registry nor skillsDir provided", () => {
      // Act & Assert
      expect(() => new MCPServer({})).toThrow("Either registry or skillsDir must be provided");
    });
  });

  describe("Capabilities Announcement", () => {
    it("should announce tools capability", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer({ registry });

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
      const server = new MCPServer({ registry });

      // Act
      const capabilities = server.getCapabilities();

      // Assert
      expect(capabilities).toBeDefined();
      expect(capabilities.resources).toBeDefined();
    });
  });

  describe("Lifecycle Management", () => {
    it("should have start() method", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer({ registry });

      // Assert
      expect(server.start).toBeDefined();
      expect(typeof server.start).toBe("function");
    });

    it("should have stop() method", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer({ registry });

      // Assert
      expect(server.stop).toBeDefined();
      expect(typeof server.stop).toBe("function");
    });

    it("should start and stop cleanly", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer({ registry });

      // Act & Assert
      await expect(server.start()).resolves.toBeUndefined();
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it("should handle multiple stop() calls gracefully", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer({ registry });

      // Act
      await server.start();
      await server.stop();

      // Assert - second stop should not throw
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe("Request Routing (basic tests with stubbed responses)", () => {
    it("should route tools/list requests", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer({ registry });

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
      const server = new MCPServer({ registry });

      // Act
      const result = await server.callTool("test-skill", []);

      // Assert
      expect(result).toBeDefined();
      // Stub can return anything for now, just verify it doesn't throw
    });

    it("should route resources/list requests", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer({ registry });

      // Act
      const resources = server.getResources();

      // Assert
      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
    });

    it("should route resources/read requests", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer({ registry });

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
      const server = new MCPServer({ registry });

      // Act & Assert - calling non-existent tool should not throw
      const result = await server.callTool("non-existent-skill", []);
      expect(result).toBeDefined();
    });

    it("should return proper error responses for invalid tool calls", async () => {
      // Arrange
      const registry = new SkillRegistry();
      await registry.loadSkills(skillsDir);
      const server = new MCPServer({ registry });

      // Act
      const result = await server.callTool("non-existent-skill", []);

      // Assert
      expect(result).toBeDefined();
      // Should return error result, not throw
      expect(result.isError || result.error).toBeDefined();
    });
  });
});
