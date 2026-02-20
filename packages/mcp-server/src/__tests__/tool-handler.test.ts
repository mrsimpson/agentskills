import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MCPServer } from "../server.js";
import { SkillRegistry } from "@agentskills/core";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * ToolHandler Tests - use_skill Tool Implementation (TDD)
 * 
 * Tests for the use_skill tool that retrieves skill instructions and metadata.
 * The tool does NOT execute anything - it returns skill information for AI agents
 * to use with other tools.
 */

describe("ToolHandler - use_skill", () => {
  let testDir: string;
  let skillsDir: string;
  let registry: SkillRegistry;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `tool-handler-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    skillsDir = join(testDir, "skills");
    await fs.mkdir(skillsDir, { recursive: true });

    // Create test skills
    const skill1Dir = join(skillsDir, "test-skill-1");
    await fs.mkdir(skill1Dir, { recursive: true });
    await fs.writeFile(
      join(skill1Dir, "SKILL.md"),
      `---
name: test-skill-1
description: A test skill for unit tests
---
# Test Skill 1

This is test skill 1 instructions.
`
    );

    const skill2Dir = join(skillsDir, "test-skill-2");
    await fs.mkdir(skill2Dir, { recursive: true });
    await fs.writeFile(
      join(skill2Dir, "SKILL.md"),
      `---
name: test-skill-2
description: Another test skill
---
# Test Skill 2

This is test skill 2 instructions.
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

  describe("Tool Registration", () => {
    it("should register use_skill tool", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();

      // Assert
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill");
      expect(useSkillTool).toBeDefined();
    });
  });

  describe("Tool Schema", () => {
    it("should have correct tool name", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill") as any;

      // Assert
      expect(useSkillTool.name).toBe("use_skill");
    });

    it("should have description", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill") as any;

      // Assert
      expect(useSkillTool.description).toBeDefined();
      expect(typeof useSkillTool.description).toBe("string");
      expect(useSkillTool.description.length).toBeGreaterThan(0);
    });

    it("should include skill names and descriptions in tool description", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill") as any;

      // Assert
      expect(useSkillTool.description).toContain("test-skill-1");
      expect(useSkillTool.description).toContain("A test skill for unit tests");
      expect(useSkillTool.description).toContain("test-skill-2");
      expect(useSkillTool.description).toContain("Another test skill");
    });

    it("should handle empty skill list in description", async () => {
      // Arrange
      const emptyRegistry = new SkillRegistry();
      const server = new MCPServer(emptyRegistry);

      // Act
      const tools = server.getTools();
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill") as any;

      // Assert
      expect(useSkillTool.description).toBeDefined();
      expect(useSkillTool.description).toContain("No skills currently loaded");
    });

    it("should have inputSchema with skill_name parameter", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill") as any;

      // Assert
      expect(useSkillTool.inputSchema).toBeDefined();
      expect(useSkillTool.inputSchema.type).toBe("object");
      expect(useSkillTool.inputSchema.properties).toBeDefined();
      expect(useSkillTool.inputSchema.properties.skill_name).toBeDefined();
      expect(useSkillTool.inputSchema.properties.skill_name.type).toBe("string");
    });

    it("should have inputSchema with optional arguments parameter", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill") as any;

      // Assert
      expect(useSkillTool.inputSchema.properties.arguments).toBeDefined();
      expect(useSkillTool.inputSchema.properties.arguments.type).toBe("object");
    });

    it("should require skill_name parameter", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill") as any;

      // Assert
      expect(useSkillTool.inputSchema.required).toBeDefined();
      expect(Array.isArray(useSkillTool.inputSchema.required)).toBe(true);
      expect(useSkillTool.inputSchema.required).toContain("skill_name");
    });
  });

  describe("Dynamic Skill Enumeration", () => {
    it("should include enum with all skills from registry", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill") as any;

      // Assert
      expect(useSkillTool.inputSchema.properties.skill_name.enum).toBeDefined();
      expect(Array.isArray(useSkillTool.inputSchema.properties.skill_name.enum)).toBe(true);
      expect(useSkillTool.inputSchema.properties.skill_name.enum).toContain("test-skill-1");
      expect(useSkillTool.inputSchema.properties.skill_name.enum).toContain("test-skill-2");
      expect(useSkillTool.inputSchema.properties.skill_name.enum.length).toBe(2);
    });

    it("should update enum when new skills are loaded", async () => {
      // Arrange
      const newSkillDir = join(skillsDir, "test-skill-3");
      await fs.mkdir(newSkillDir, { recursive: true });
      await fs.writeFile(
        join(newSkillDir, "SKILL.md"),
        `---
name: test-skill-3
description: Third test skill
---
# Test Skill 3

This is test skill 3 instructions.
`
      );

      // Reload registry
      await registry.loadSkills(skillsDir);
      const server = new MCPServer(registry);

      // Act
      const tools = server.getTools();
      const useSkillTool = tools.find((tool: any) => tool.name === "use_skill") as any;

      // Assert
      expect(useSkillTool.inputSchema.properties.skill_name.enum).toContain("test-skill-3");
      expect(useSkillTool.inputSchema.properties.skill_name.enum.length).toBe(3);
    });
  });

  describe("Tool Execution", () => {
    it("should return only skill instructions", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.callTool("use_skill", { skill_name: "test-skill-1" });

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      
      // Parse the JSON response
      const content = (result as any).content;
      expect(content).toBeDefined();
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBeGreaterThan(0);
      
      const textContent = content.find((c: any) => c.type === "text");
      expect(textContent).toBeDefined();
      expect(textContent.text).toBeDefined();
      
      // Parse the response - should only have instructions field
      const data = JSON.parse(textContent.text);
      expect(data).toHaveProperty("instructions");
      expect(data.instructions).toContain("This is test skill 1 instructions");
      
      // Should NOT have metadata fields
      expect(data).not.toHaveProperty("name");
      expect(data).not.toHaveProperty("description");
      expect(data).not.toHaveProperty("body");
    });

    it("should return instructions without metadata", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.callTool("use_skill", { skill_name: "test-skill-2" });

      // Assert
      const content = (result as any).content;
      const textContent = content.find((c: any) => c.type === "text");
      const data = JSON.parse(textContent.text);
      
      // Should ONLY have instructions field
      expect(data).toHaveProperty("instructions");
      expect(data.instructions).toContain("This is test skill 2 instructions");
      
      // Should NOT have any metadata
      expect(data).not.toHaveProperty("name");
      expect(data).not.toHaveProperty("description");
      expect(data).not.toHaveProperty("body");
    });

    it("should handle skill with no arguments", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act - call without arguments parameter
      const result = await server.callTool("use_skill", { skill_name: "test-skill-1" });

      // Assert - should still work
      expect(result).toBeDefined();
      const content = (result as any).content;
      expect(Array.isArray(content)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle non-existent skill", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.callTool("use_skill", {
        skill_name: "non-existent-skill",
      });

      // Assert
      expect(result).toBeDefined();
      expect((result as any).isError).toBe(true);
      expect((result as any).error).toContain("Skill not found");
    });

    it("should handle missing skill_name parameter", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.callTool("use_skill", {});

      // Assert
      expect(result).toBeDefined();
      expect((result as any).isError).toBe(true);
    });

    it("should handle invalid tool name", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act
      const result = await server.callTool("invalid_tool", {
        skill_name: "test-skill-1",
      });

      // Assert
      expect(result).toBeDefined();
      expect((result as any).isError).toBe(true);
      expect((result as any).error).toContain("Unknown tool");
    });

    it("should not crash on errors", async () => {
      // Arrange
      const server = new MCPServer(registry);

      // Act & Assert - should not throw
      await expect(
        server.callTool("use_skill", { skill_name: "non-existent" })
      ).resolves.toBeDefined();
    });
  });
});
