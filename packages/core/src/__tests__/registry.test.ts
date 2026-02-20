import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parseSkillContent } from "../parser";
import { SkillRegistry } from "../registry";
import type { SkillSource, LoadResult, RegistryState, Skill, SkillMetadata } from "../types";

/**
 * Comprehensive test suite for SkillRegistry component
 * 
 * Following TDD approach from agentic-knowledge:
 * - Minimal mocking (use real file system with temp directories)
 * - Test-driven interface design
 * - Clear test structure with arrange-act-assert
 * 
 * Coverage:
 * 1. Basic operations (load, get, getAll, metadata)
 * 2. Source priority (first-source-wins)
 * 3. Nested directory discovery
 * 4. Error handling (graceful degradation)
 * 5. State management
 * 6. Edge cases
 */

const FIXTURES_DIR = join(__dirname, "fixtures", "skills");

/**
 * Helper: Create a temp directory for test isolation
 */
async function createTempDir(): Promise<string> {
  const tempPath = join(tmpdir(), `skill-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tempPath, { recursive: true });
  return tempPath;
}

/**
 * Helper: Clean up temp directory
 */
async function cleanupTempDir(path: string): Promise<void> {
  try {
    await fs.rm(path, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Helper: Create a skill file in a directory
 */
async function createSkillFile(dir: string, filename: string, content: string): Promise<string> {
  const filePath = join(dir, filename);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
  return filePath;
}

/**
 * Helper: Get basic skill content
 */
function getBasicSkillContent(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
---

# ${name}

This is a test skill.
`;
}

/**
 * Helper: Get skill content with all fields
 */
function getFullSkillContent(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
license: MIT
compatibility: claude-3.5-sonnet
allowed-tools:
  - bash
  - read_file
metadata:
  author: Test Author
  version: 1.0.0
---

# ${name}

This is a full test skill with all fields.
`;
}

/**
 * Helper: Get invalid skill content (missing required field)
 */
function getInvalidSkillContent(missingField: 'name' | 'description'): string {
  if (missingField === 'name') {
    return `---
description: A skill without a name
---

# Invalid Skill

This skill is missing the name field.
`;
  } else {
    return `---
name: invalid-skill
---

# Invalid Skill

This skill is missing the description field.
`;
  }
}

describe("SkillRegistry", () => {
  let tempDirs: string[] = [];

  /**
   * Clean up all temp directories after each test
   */
  afterEach(async () => {
    for (const dir of tempDirs) {
      await cleanupTempDir(dir);
    }
    tempDirs = [];
  });

  describe("Basic Operations", () => {
    it("should start with empty state", () => {
      // Arrange & Act
      const registry = new SkillRegistry();
      const state = registry.getState();

      // Assert
      expect(state.skillCount).toBe(0);
      expect(state.sources).toEqual([]);
      expect(state.lastLoaded).toBeUndefined();
    });

    it("should load skills from a single directory", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill1.md",
        getBasicSkillContent("test-skill-1", "First test skill")
      );
      await createSkillFile(
        tempDir,
        "skill2.md",
        getBasicSkillContent("test-skill-2", "Second test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);

      const state = registry.getState();
      expect(state.skillCount).toBe(2);
      expect(state.sources).toEqual([tempDir]);
      expect(state.lastLoaded).toBeInstanceOf(Date);
    });

    it("should load skills from multiple directories", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();
      tempDirs.push(tempDir1, tempDir2);

      await createSkillFile(
        tempDir1,
        "skill1.md",
        getBasicSkillContent("test-skill-1", "First test skill")
      );
      await createSkillFile(
        tempDir2,
        "skill2.md",
        getBasicSkillContent("test-skill-2", "Second test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir1 },
        { type: "local_directory", path: tempDir2 }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(2);
      expect(result.failed).toBe(0);
      
      const state = registry.getState();
      expect(state.sources).toEqual([tempDir1, tempDir2]);
    });

    it("should get skill by name", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill1.md",
        getBasicSkillContent("test-skill-1", "First test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];
      await registry.loadSkills(sources);

      // Act
      const skill = registry.getSkill("test-skill-1");

      // Assert
      expect(skill).toBeDefined();
      expect(skill?.metadata.name).toBe("test-skill-1");
      expect(skill?.metadata.description).toBe("First test skill");
      expect(skill?.body).toContain("# test-skill-1");
    });

    it("should return undefined for non-existent skill", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill1.md",
        getBasicSkillContent("test-skill-1", "First test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];
      await registry.loadSkills(sources);

      // Act
      const skill = registry.getSkill("non-existent-skill");

      // Assert
      expect(skill).toBeUndefined();
    });

    it("should get all skills", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill1.md",
        getBasicSkillContent("test-skill-1", "First test skill")
      );
      await createSkillFile(
        tempDir,
        "skill2.md",
        getBasicSkillContent("test-skill-2", "Second test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];
      await registry.loadSkills(sources);

      // Act
      const skills = registry.getAllSkills();

      // Assert
      expect(skills).toHaveLength(2);
      const names = skills.map((s: Skill) => s.metadata.name);
      expect(names).toContain("test-skill-1");
      expect(names).toContain("test-skill-2");
    });

    it("should get skill metadata only", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill1.md",
        getFullSkillContent("test-skill-1", "First test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];
      await registry.loadSkills(sources);

      // Act
      const metadata = registry.getSkillMetadata("test-skill-1");

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe("test-skill-1");
      expect(metadata?.description).toBe("First test skill");
      expect(metadata?.license).toBe("MIT");
      expect(metadata?.compatibility).toBe("claude-3.5-sonnet");
    });

    it("should return undefined for non-existent skill metadata", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];
      await registry.loadSkills(sources);

      // Act
      const metadata = registry.getSkillMetadata("non-existent");

      // Assert
      expect(metadata).toBeUndefined();
    });

    it("should get all metadata", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill1.md",
        getFullSkillContent("test-skill-1", "First test skill")
      );
      await createSkillFile(
        tempDir,
        "skill2.md",
        getFullSkillContent("test-skill-2", "Second test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];
      await registry.loadSkills(sources);

      // Act
      const allMetadata = registry.getAllMetadata();

      // Assert
      expect(allMetadata).toHaveLength(2);
      const metadataNames = allMetadata.map((m: SkillMetadata) => m.name);
      expect(metadataNames).toContain("test-skill-1");
      expect(metadataNames).toContain("test-skill-2");
      expect(allMetadata.every((m: SkillMetadata) => m.license === "MIT")).toBe(true);
    });
  });

  describe("Source Priority (First-Source-Wins)", () => {
    it("should give priority to first source when skills have same name", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();
      tempDirs.push(tempDir1, tempDir2);

      // First source has skill with description "First source"
      await createSkillFile(
        tempDir1,
        "skill.md",
        getBasicSkillContent("test-skill", "First source")
      );

      // Second source has same skill with different description
      await createSkillFile(
        tempDir2,
        "skill.md",
        getBasicSkillContent("test-skill", "Second source")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir1 },
        { type: "local_directory", path: tempDir2 }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(1); // Only one skill loaded
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("test-skill");
      expect(result.warnings[0]).toContain("conflict");

      const skill = registry.getSkill("test-skill");
      expect(skill?.metadata.description).toBe("First source");
    });

    it("should log warning for each conflicting skill", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();
      const tempDir3 = await createTempDir();
      tempDirs.push(tempDir1, tempDir2, tempDir3);

      // Create same skill in all three sources
      await createSkillFile(
        tempDir1,
        "skill.md",
        getBasicSkillContent("test-skill", "First source")
      );
      await createSkillFile(
        tempDir2,
        "skill.md",
        getBasicSkillContent("test-skill", "Second source")
      );
      await createSkillFile(
        tempDir3,
        "skill.md",
        getBasicSkillContent("test-skill", "Third source")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir1 },
        { type: "local_directory", path: tempDir2 },
        { type: "local_directory", path: tempDir3 }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(1);
      expect(result.warnings).toHaveLength(2); // Two conflicts (source 2 and 3)
      expect(result.warnings.every((w: string) => w.includes("test-skill"))).toBe(true);
    });

    it("should respect explicit priority values", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();
      tempDirs.push(tempDir1, tempDir2);

      await createSkillFile(
        tempDir1,
        "skill.md",
        getBasicSkillContent("test-skill", "Lower priority")
      );
      await createSkillFile(
        tempDir2,
        "skill.md",
        getBasicSkillContent("test-skill", "Higher priority")
      );

      // Second source has higher priority
      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir1, priority: 1 },
        { type: "local_directory", path: tempDir2, priority: 10 }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(1);
      const skill = registry.getSkill("test-skill");
      expect(skill?.metadata.description).toBe("Higher priority");
    });
  });

  describe("Nested Directory Discovery", () => {
    it("should find skills in subdirectories", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create nested structure
      await createSkillFile(
        join(tempDir, "subdir1"),
        "skill1.md",
        getBasicSkillContent("nested-skill-1", "Nested in subdir1")
      );
      await createSkillFile(
        join(tempDir, "subdir2"),
        "skill2.md",
        getBasicSkillContent("nested-skill-2", "Nested in subdir2")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(2);
      expect(registry.getAllSkills()).toHaveLength(2);
      expect(registry.getSkill("nested-skill-1")).toBeDefined();
      expect(registry.getSkill("nested-skill-2")).toBeDefined();
    });

    it("should recursively traverse nested directories", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create deeply nested structure
      await createSkillFile(
        join(tempDir, "level1", "level2", "level3"),
        "deep-skill.md",
        getBasicSkillContent("deep-skill", "Deeply nested skill")
      );
      await createSkillFile(
        tempDir,
        "root-skill.md",
        getBasicSkillContent("root-skill", "Root level skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(2);
      expect(registry.getSkill("deep-skill")).toBeDefined();
      expect(registry.getSkill("root-skill")).toBeDefined();
    });

    it("should find multiple skill files in same directory", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill1.md",
        getBasicSkillContent("skill-1", "First skill")
      );
      await createSkillFile(
        tempDir,
        "skill2.md",
        getBasicSkillContent("skill-2", "Second skill")
      );
      await createSkillFile(
        tempDir,
        "SKILL.md",
        getBasicSkillContent("skill-3", "Third skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(3);
    });

    it("should handle duplicate skill names in nested directories with first-found-wins", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create duplicate in root and subdirectory
      await createSkillFile(
        tempDir,
        "skill.md",
        getBasicSkillContent("duplicate-skill", "Root level")
      );
      await createSkillFile(
        join(tempDir, "subdir"),
        "skill.md",
        getBasicSkillContent("duplicate-skill", "Subdirectory level")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("duplicate-skill");
    });
  });

  describe("Error Handling (Graceful Degradation)", () => {
    it("should continue loading when one skill file is invalid", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // One valid, one invalid
      await createSkillFile(
        tempDir,
        "valid.md",
        getBasicSkillContent("valid-skill", "Valid skill")
      );
      await createSkillFile(
        tempDir,
        "invalid.md",
        getInvalidSkillContent("name")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("invalid.md");

      // Valid skill should still be loaded
      expect(registry.getSkill("valid-skill")).toBeDefined();
    });

    it("should log parse errors but continue loading", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill1.md",
        getBasicSkillContent("skill-1", "First skill")
      );
      await createSkillFile(
        tempDir,
        "invalid-yaml.md",
        "---\ninvalid: yaml: content:\n---\n\n# Invalid"
      );
      await createSkillFile(
        tempDir,
        "skill2.md",
        getBasicSkillContent("skill-2", "Second skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(registry.getAllSkills()).toHaveLength(2);
    });

    it("should collect validation warnings without blocking load", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create skill with short description (validation warning)
      await createSkillFile(
        tempDir,
        "skill.md",
        getBasicSkillContent("test-skill", "Short")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(1);
      expect(result.failed).toBe(0);
      // Validation warnings should be collected if validator reports them
      expect(registry.getSkill("test-skill")).toBeDefined();
    });

    it("should handle empty directories gracefully", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(registry.getAllSkills()).toEqual([]);
    });

    it("should handle non-existent directories", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const nonExistentPath = join(tmpdir(), "non-existent-dir-" + Date.now());

      const sources: SkillSource[] = [
        { type: "local_directory", path: nonExistentPath }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain(nonExistentPath);
      expect(registry.getAllSkills()).toEqual([]);
    });

    it("should handle directories with only non-skill files", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create non-skill files
      await fs.writeFile(join(tempDir, "README.md"), "# README", "utf-8");
      await fs.writeFile(join(tempDir, "notes.txt"), "Notes", "utf-8");
      await fs.writeFile(join(tempDir, "config.json"), "{}", "utf-8");

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(0);
      expect(result.failed).toBe(0);
      expect(registry.getAllSkills()).toEqual([]);
    });

    it("should continue when all skills in a directory are invalid", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();
      tempDirs.push(tempDir1, tempDir2);

      // First directory has all invalid skills
      await createSkillFile(
        tempDir1,
        "invalid1.md",
        getInvalidSkillContent("name")
      );
      await createSkillFile(
        tempDir1,
        "invalid2.md",
        getInvalidSkillContent("description")
      );

      // Second directory has valid skill
      await createSkillFile(
        tempDir2,
        "valid.md",
        getBasicSkillContent("valid-skill", "Valid skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir1 },
        { type: "local_directory", path: tempDir2 }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(registry.getSkill("valid-skill")).toBeDefined();
    });
  });

  describe("State Management", () => {
    it("should update state after loading skills", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill.md",
        getBasicSkillContent("test-skill", "Test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      const beforeState = registry.getState();
      expect(beforeState.skillCount).toBe(0);
      expect(beforeState.lastLoaded).toBeUndefined();

      // Act
      const loadTime = new Date();
      await registry.loadSkills(sources);
      const afterState = registry.getState();

      // Assert
      expect(afterState.skillCount).toBe(1);
      expect(afterState.sources).toEqual([tempDir]);
      expect(afterState.lastLoaded).toBeInstanceOf(Date);
      expect(afterState.lastLoaded!.getTime()).toBeGreaterThanOrEqual(loadTime.getTime());
    });

    it("should replace state when loading again", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();
      tempDirs.push(tempDir1, tempDir2);

      await createSkillFile(
        tempDir1,
        "skill1.md",
        getBasicSkillContent("skill-1", "First skill")
      );
      await createSkillFile(
        tempDir2,
        "skill2.md",
        getBasicSkillContent("skill-2", "Second skill")
      );

      // First load
      await registry.loadSkills([{ type: "local_directory", path: tempDir1 }]);
      expect(registry.getState().skillCount).toBe(1);
      expect(registry.getSkill("skill-1")).toBeDefined();

      // Act - Second load with different source
      await registry.loadSkills([{ type: "local_directory", path: tempDir2 }]);

      // Assert
      const state = registry.getState();
      expect(state.skillCount).toBe(1);
      expect(state.sources).toEqual([tempDir2]);
      expect(registry.getSkill("skill-1")).toBeUndefined(); // Old skill gone
      expect(registry.getSkill("skill-2")).toBeDefined(); // New skill present
    });

    it("should clear state on reload", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill.md",
        getBasicSkillContent("test-skill", "Test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Initial load
      await registry.loadSkills(sources);
      expect(registry.getState().skillCount).toBe(1);

      // Remove the skill file
      await fs.unlink(join(tempDir, "skill.md"));

      // Act - Reload
      await registry.loadSkills(sources);

      // Assert
      expect(registry.getState().skillCount).toBe(0);
      expect(registry.getSkill("test-skill")).toBeUndefined();
    });

    it("should track multiple sources in state", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();
      const tempDir3 = await createTempDir();
      tempDirs.push(tempDir1, tempDir2, tempDir3);

      await createSkillFile(
        tempDir1,
        "skill1.md",
        getBasicSkillContent("skill-1", "First")
      );
      await createSkillFile(
        tempDir2,
        "skill2.md",
        getBasicSkillContent("skill-2", "Second")
      );
      await createSkillFile(
        tempDir3,
        "skill3.md",
        getBasicSkillContent("skill-3", "Third")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir1 },
        { type: "local_directory", path: tempDir2 },
        { type: "local_directory", path: tempDir3 }
      ];

      // Act
      await registry.loadSkills(sources);
      const state = registry.getState();

      // Assert
      expect(state.sources).toHaveLength(3);
      expect(state.sources).toContain(tempDir1);
      expect(state.sources).toContain(tempDir2);
      expect(state.sources).toContain(tempDir3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle case when no skills found in any source", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir1 = await createTempDir();
      const tempDir2 = await createTempDir();
      tempDirs.push(tempDir1, tempDir2);

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir1 },
        { type: "local_directory", path: tempDir2 }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(0);
      expect(result.failed).toBe(0);
      expect(registry.getAllSkills()).toEqual([]);
      expect(registry.getAllMetadata()).toEqual([]);
    });

    it("should handle case when all skills are invalid", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "invalid1.md",
        getInvalidSkillContent("name")
      );
      await createSkillFile(
        tempDir,
        "invalid2.md",
        getInvalidSkillContent("description")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(registry.getAllSkills()).toEqual([]);
    });

    it("should handle loading with empty sources array", async () => {
      // Arrange
      const registry = new SkillRegistry();

      // Act
      const result = await registry.loadSkills([]);

      // Assert
      expect(result.loaded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(registry.getState().skillCount).toBe(0);
    });

    it("should handle skill files with same content but different filenames", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      const content = getBasicSkillContent("same-skill", "Same skill");
      await createSkillFile(tempDir, "skill1.md", content);
      await createSkillFile(tempDir, "skill2.md", content);

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert - Only one skill loaded due to duplicate name
      expect(result.loaded).toBe(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("same-skill");
    });

    it("should handle very long directory paths", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      // Create deeply nested path
      const deepPath = join(tempDir, "a", "b", "c", "d", "e", "f", "g", "h");
      await createSkillFile(
        deepPath,
        "skill.md",
        getBasicSkillContent("deep-skill", "Deep nested skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(1);
      expect(registry.getSkill("deep-skill")).toBeDefined();
    });

    it("should handle skill names with special characters in filenames", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "my-skill-v2.md",
        getBasicSkillContent("my-skill-v2", "Skill with hyphens and numbers")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];

      // Act
      const result = await registry.loadSkills(sources);

      // Assert
      expect(result.loaded).toBe(1);
      expect(registry.getSkill("my-skill-v2")).toBeDefined();
    });

    it.skipIf(process.platform === "darwin" || process.platform === "win32")(
      "should handle mixed case skill filenames (SKILL.md vs skill.md)",
      async () => {
        // Note: Skipped on macOS and Windows due to case-insensitive filesystems
        // On these platforms, SKILL.md and skill.md refer to the same file

        // Arrange
        const registry = new SkillRegistry();
        const tempDir = await createTempDir();
        tempDirs.push(tempDir);

        await createSkillFile(
          tempDir,
          "SKILL.md",
          getBasicSkillContent("uppercase-file", "Uppercase filename")
        );
        await createSkillFile(
          tempDir,
          "skill.md",
          getBasicSkillContent("lowercase-file", "Lowercase filename")
        );

        const sources: SkillSource[] = [
          { type: "local_directory", path: tempDir }
        ];

        // Act
        const result = await registry.loadSkills(sources);

        // Assert
        expect(result.loaded).toBe(2);
        expect(registry.getSkill("uppercase-file")).toBeDefined();
        expect(registry.getSkill("lowercase-file")).toBeDefined();
      }
    );

    it("should return immutable skill objects", async () => {
      // Arrange
      const registry = new SkillRegistry();
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      await createSkillFile(
        tempDir,
        "skill.md",
        getBasicSkillContent("test-skill", "Test skill")
      );

      const sources: SkillSource[] = [
        { type: "local_directory", path: tempDir }
      ];
      await registry.loadSkills(sources);

      // Act - Get skill and try to modify it
      const skill1 = registry.getSkill("test-skill");
      const skill2 = registry.getSkill("test-skill");

      // Assert - Should return new objects each time (or frozen objects)
      expect(skill1).toBeDefined();
      expect(skill2).toBeDefined();
      // Verify that modifications don't affect registry
      if (skill1) {
        const originalDescription = skill1.metadata.description;
        // TypeScript might prevent this, but test runtime behavior
        try {
          (skill1.metadata as any).description = "Modified";
        } catch {
          // Expected to throw if frozen
        }
        const skill3 = registry.getSkill("test-skill");
        expect(skill3?.metadata.description).toBe(originalDescription);
      }
    });
  });
});
