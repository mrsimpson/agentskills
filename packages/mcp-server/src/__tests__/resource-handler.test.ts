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

  describe("Resource Template Registration", () => {
    it("should register resource template from SkillRegistry", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const templates = server.getResourceTemplates();

      // Assert
      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
    });

    it("should have single resource template for all skills", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const templates = server.getResourceTemplates();

      // Assert
      expect(templates.length).toBe(1);
    });

    it("should have correct URI template format", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const templates = server.getResourceTemplates() as any[];

      // Assert
      const template = templates[0];
      expect(template.uriTemplate).toBe("skill://{skillName}");
    });

    it("should have name and description referencing tool", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const templates = server.getResourceTemplates() as any[];

      // Assert
      const template = templates[0];
      expect(template.name).toBe("Agent Skill");
      expect(template.description).toContain("use_skill tool");
      expect(template.description).toContain("skill_name parameter");
    });

    it("should have mimeType", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const templates = server.getResourceTemplates() as any[];

      // Assert
      const template = templates[0];
      expect(template.mimeType).toBe("text/markdown");
    });
  });

  describe("List Resource Templates", () => {
    it("should return single template regardless of skill count", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const templates = server.getResourceTemplates() as any[];

      // Assert
      expect(templates.length).toBe(1);
      expect(templates[0]).toHaveProperty("uriTemplate");
      expect(templates[0]).toHaveProperty("name");
      expect(templates[0]).toHaveProperty("description");
    });

    it("should have correct metadata for template", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const templates = server.getResourceTemplates() as any[];

      // Assert
      const template = templates[0];
      expect(template.uriTemplate).toBe("skill://{skillName}");
      expect(template.name).toBe("Agent Skill");
      expect(typeof template.description).toBe("string");
      expect(template.mimeType).toBe("text/markdown");
    });

    it("should exist even with empty skill list", async () => {
      // Arrange
      const emptyRegistry = new SkillRegistry();
      const server = new MCPServer(emptyRegistry);

      // Act
      const templates = server.getResourceTemplates();

      // Assert
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBe(1); // Template exists regardless
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
