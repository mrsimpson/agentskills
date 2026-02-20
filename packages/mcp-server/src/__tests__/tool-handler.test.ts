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
});
