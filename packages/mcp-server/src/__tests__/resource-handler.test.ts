import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MCPServer } from "../server.js";
import { SkillRegistry } from "@agentskills/core";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * ResourceHandler Tests - Skills as MCP Resources (TDD)
 * 
 * Tests for exposing skills as MCP resources so clients can:
 * - List available skills as resources
 * - Read skill definitions via resource URIs (skill://<name>)
 * - Browse skill documentation
 */

describe("ResourceHandler - Skills as Resources", () => {
  let testDir: string;
  let skillsDir: string;
  let registry: SkillRegistry;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `resource-handler-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    skillsDir = join(testDir, "skills");
    await fs.mkdir(skillsDir, { recursive: true });

    // Create test skills
    const skill1Dir = join(skillsDir, "test-skill-1");
    await fs.mkdir(skill1Dir, { recursive: true });
    await fs.writeFile(
      join(skill1Dir, "SKILL.md"),
      `---
name: test-skill-1
description: A test skill for resource tests
---
# Test Skill 1

This is test skill 1 instructions for resource reading.
`
    );

    const skill2Dir = join(skillsDir, "test-skill-2");
    await fs.mkdir(skill2Dir, { recursive: true });
    await fs.writeFile(
      join(skill2Dir, "SKILL.md"),
      `---
name: test-skill-2
description: Another test skill for resources
---
# Test Skill 2

This is test skill 2 instructions for resource reading.
`
    );

    // Initialize registry
    registry = new SkillRegistry();
    await registry.loadSkills(skillsDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Resource Registration", () => {
    it("should register resources from SkillRegistry", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const resources = server.getResources();

      // Assert
      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
    });

    it("should create a resource for each skill", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const resources = server.getResources();

      // Assert
      expect(resources.length).toBe(2);
    });

    it("should have correct URI format for resources", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const resources = server.getResources() as any[];

      // Assert
      const resource1 = resources.find((r: any) => r.uri === "skill://test-skill-1");
      const resource2 = resources.find((r: any) => r.uri === "skill://test-skill-2");
      
      expect(resource1).toBeDefined();
      expect(resource2).toBeDefined();
    });

    it("should have name and description for each resource", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const resources = server.getResources() as any[];

      // Assert
      const resource1 = resources.find((r: any) => r.uri === "skill://test-skill-1");
      
      expect(resource1.name).toBe("test-skill-1");
      expect(resource1.description).toBe("A test skill for resource tests");
    });
  });

  describe("List Resources", () => {
    it("should list all skills as resources", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const resources = server.getResources() as any[];

      // Assert
      expect(resources.length).toBe(2);
      expect(resources[0]).toHaveProperty("uri");
      expect(resources[0]).toHaveProperty("name");
      expect(resources[0]).toHaveProperty("description");
    });

    it("should have correct metadata for each resource", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const resources = server.getResources() as any[];

      // Assert
      resources.forEach((resource: any) => {
        expect(resource.uri).toMatch(/^skill:\/\/.+$/);
        expect(typeof resource.name).toBe("string");
        expect(typeof resource.description).toBe("string");
        expect(resource.mimeType).toBe("text/markdown");
      });
    });

    it("should work with multiple skills", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const resources = server.getResources() as any[];

      // Assert
      expect(resources.length).toBe(2);
      
      const skillNames = resources.map((r: any) => r.name);
      expect(skillNames).toContain("test-skill-1");
      expect(skillNames).toContain("test-skill-2");
    });

    it("should handle empty skill list", async () => {
      // Arrange
      const emptyRegistry = new SkillRegistry();
      const server = new MCPServer(emptyRegistry);

      // Act
      const resources = server.getResources();

      // Assert
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBe(0);
    });
  });

  describe("Read Resource", () => {
    it("should return SKILL.md content for valid skill", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.readResource("skill://test-skill-1");

      // Assert
      expect(result).toBeDefined();
      const response = result as any;
      expect(response.contents).toBeDefined();
      expect(Array.isArray(response.contents)).toBe(true);
      expect(response.contents.length).toBeGreaterThan(0);
    });

    it("should return full skill data in resource", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.readResource("skill://test-skill-1");

      // Assert
      const response = result as any;
      const content = response.contents[0];
      
      expect(content.uri).toBe("skill://test-skill-1");
      expect(content.mimeType).toBe("text/markdown");
      expect(content.text).toBeDefined();
      expect(content.text).toContain("Test Skill 1");
      expect(content.text).toContain("This is test skill 1 instructions for resource reading");
    });

    it("should work with different skills", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result1 = await server.readResource("skill://test-skill-1");
      const result2 = await server.readResource("skill://test-skill-2");

      // Assert
      const response1 = result1 as any;
      const response2 = result2 as any;
      
      expect(response1.contents[0].text).toContain("Test Skill 1");
      expect(response2.contents[0].text).toContain("Test Skill 2");
    });

    it("should return proper MCP resource format", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.readResource("skill://test-skill-2");

      // Assert
      const response = result as any;
      expect(response).toHaveProperty("contents");
      expect(Array.isArray(response.contents)).toBe(true);
      
      const content = response.contents[0];
      expect(content).toHaveProperty("uri");
      expect(content).toHaveProperty("mimeType");
      expect(content).toHaveProperty("text");
      expect(content.mimeType).toBe("text/markdown");
    });
  });

  describe("Error Handling", () => {
    it("should return error for non-existent skill", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.readResource("skill://non-existent");

      // Assert
      const response = result as any;
      expect(response.isError).toBe(true);
      expect(response.error).toContain("Skill not found");
    });

    it("should return error for invalid URI format", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.readResource("invalid-uri");

      // Assert
      const response = result as any;
      expect(response.isError).toBe(true);
      expect(response.error).toContain("Invalid skill URI");
    });

    it("should handle malformed resource requests", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result1 = await server.readResource("skill://");
      const result2 = await server.readResource("http://test-skill-1");

      // Assert
      const response1 = result1 as any;
      const response2 = result2 as any;
      
      expect(response1.isError).toBe(true);
      expect(response2.isError).toBe(true);
    });
  });
});
