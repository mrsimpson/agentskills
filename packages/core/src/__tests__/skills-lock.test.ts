import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadSkillsLock,
  getAllowedSkills,
  getAllowedSkillsFromProject,
  getAllowedSkillsFromAgentskills
} from "../skills-lock.js";

/**
 * Helper: Create a temp directory for test isolation
 */
async function createTempDir(): Promise<string> {
  const tempPath = join(
    tmpdir(),
    `skills-lock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
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

describe("Skills Lock Manager", () => {
  describe("loadSkillsLock", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempDir();
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("should load and parse skills-lock.json", async () => {
      // Arrange
      const lockFilePath = join(tempDir, "skills-lock.json");
      const lockContent = {
        version: 1,
        skills: {
          "skill-1": {
            source: "org/repo",
            sourceType: "github",
            computedHash: "abc123"
          },
          "skill-2": {
            source: "org/repo",
            sourceType: "github",
            computedHash: "def456"
          }
        }
      };

      await fs.writeFile(lockFilePath, JSON.stringify(lockContent, null, 2));

      // Act
      const result = await loadSkillsLock(lockFilePath);

      // Assert
      expect(result).toEqual(lockContent);
    });

    it("should return null if lock file does not exist", async () => {
      // Arrange
      const lockFilePath = join(tempDir, "non-existent.json");

      // Act
      const result = await loadSkillsLock(lockFilePath);

      // Assert
      expect(result).toBeNull();
    });

    it("should throw on invalid JSON", async () => {
      // Arrange
      const lockFilePath = join(tempDir, "skills-lock.json");
      await fs.writeFile(lockFilePath, "{ invalid json }");

      // Act & Assert
      await expect(loadSkillsLock(lockFilePath)).rejects.toThrow();
    });
  });

  describe("getAllowedSkills", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempDir();
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("should return set of allowed skill names from lock file", async () => {
      // Arrange
      const lockFilePath = join(tempDir, "skills-lock.json");
      const lockContent = {
        version: 1,
        skills: {
          "skill-1": {
            source: "org/repo",
            sourceType: "github",
            computedHash: "abc123"
          },
          "skill-2": {
            source: "org/repo",
            sourceType: "github",
            computedHash: "def456"
          }
        }
      };

      await fs.writeFile(lockFilePath, JSON.stringify(lockContent));

      // Act
      const result = await getAllowedSkills(lockFilePath);

      // Assert
      expect(result).toEqual(new Set(["skill-1", "skill-2"]));
    });

    it("should return undefined if lock file does not exist", async () => {
      // Arrange
      const lockFilePath = join(tempDir, "non-existent.json");

      // Act
      const result = await getAllowedSkills(lockFilePath);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe("getAllowedSkillsFromProject", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempDir();
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("should load from skills-lock.json in project root", async () => {
      // Arrange
      const lockFilePath = join(tempDir, "skills-lock.json");
      const lockContent = {
        version: 1,
        skills: {
          "skill-1": {
            source: "org/repo",
            sourceType: "github",
            computedHash: "abc123"
          }
        }
      };

      await fs.writeFile(lockFilePath, JSON.stringify(lockContent));

      // Act
      const result = await getAllowedSkillsFromProject(tempDir);

      // Assert
      expect(result).toEqual(new Set(["skill-1"]));
    });

    it("should return undefined if lock file does not exist", async () => {
      // Act
      const result = await getAllowedSkillsFromProject(tempDir);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe("getAllowedSkillsFromAgentskills", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempDir();
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("should load from skills-lock.json in project root", async () => {
      // Arrange
      const lockFilePath = join(tempDir, "skills-lock.json");
      const lockContent = {
        version: 1,
        skills: {
          commit: {
            source: "org/repo",
            sourceType: "github",
            computedHash: "abc123"
          },
          knowledge: {
            source: "org/repo",
            sourceType: "github",
            computedHash: "def456"
          }
        }
      };

      await fs.writeFile(lockFilePath, JSON.stringify(lockContent));

      // Act
      const result = await getAllowedSkillsFromAgentskills(tempDir);

      // Assert
      expect(result).toEqual(new Set(["commit", "knowledge"]));
    });

    it("should return undefined if lock file does not exist in project root", async () => {
      // Act
      const result = await getAllowedSkillsFromAgentskills(tempDir);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
