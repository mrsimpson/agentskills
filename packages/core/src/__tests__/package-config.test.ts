import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PackageConfigManager } from "../package-config";

/**
 * Comprehensive test suite for PackageConfigManager component
 *
 * Following TDD RED phase approach:
 * - Write tests first to define the PackageConfigManager interface
 * - Tests define expected behavior before implementation
 * - Use real file system with temp directories for isolation
 * - Mock fs only for error cases (permission errors)
 *
 * PackageConfigManager Responsibilities:
 * 1. Read package.json from a directory
 * 2. Parse `agentskills` field (skill dependencies)
 * 3. Parse `agentskillsConfig` field (configuration settings)
 * 4. Provide defaults when package.json doesn't exist
 * 5. Provide defaults when fields are missing
 * 6. Validate configuration structure
 * 7. Save/update skills in package.json
 *
 * Coverage:
 * - Load package.json with both agentskills and agentskillsConfig
 * - Load with only agentskills (use config defaults)
 * - Load with only agentskillsConfig (empty skills)
 * - Load without either field (all defaults)
 * - No package.json exists (return defaults)
 * - Invalid JSON in package.json (error handling)
 * - Empty agentskills object
 * - Empty agentskillsConfig object (use defaults)
 * - Partial agentskillsConfig (merge with defaults)
 * - Invalid configuration values (validation)
 * - Save/add/remove skills operations
 * - Source tracking (file vs defaults)
 */

interface PackageConfig {
  // Declared skills to install
  skills: Record<string, string>; // { "skill-name": "github:user/repo#v1.0.0" }

  // Configuration settings
  config: {
    skillsDirectory: string; // Where to install (default: ".agentskills/skills")
    autoDiscover: string[]; // Paths to auto-discover (default: [".claude/skills"])
    maxSkillSize: number; // Token limit (default: 5000)
    logLevel: "error" | "warn" | "info" | "debug"; // Default: "info"
  };

  // Where config was loaded from
  source: {
    type: "file" | "defaults";
    path?: string;
  };
}

describe("PackageConfigManager", () => {
  let tempDir: string;
  let projectRoot: string;
  let packageJsonPath: string;
  let configManager: PackageConfigManager;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = join(tmpdir(), `package-config-test-${Date.now()}`);
    projectRoot = join(tempDir, "project");
    packageJsonPath = join(projectRoot, "package.json");

    await fs.mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Constructor", () => {
    it("should create manager with project root directory", () => {
      // Arrange & Act
      const manager = new PackageConfigManager(projectRoot);

      // Assert
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(PackageConfigManager);
    });

    it("should throw error if project root is not provided", () => {
      // Assert
      expect(() => new PackageConfigManager("")).toThrow(
        "Project root directory is required"
      );
    });

    it("should throw error if project root is null or undefined", () => {
      // Assert
      expect(() => new PackageConfigManager(null as any)).toThrow();
      expect(() => new PackageConfigManager(undefined as any)).toThrow();
    });
  });

  describe("getDefaultConfig", () => {
    it("should return default configuration", () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = manager.getDefaultConfig();

      // Assert
      expect(config).toEqual({
        skills: {},
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [".claude/skills"],
          maxSkillSize: 5000,
          logLevel: "info",
        },
        source: {
          type: "defaults",
        },
      });
    });

    it("should return a new object each time (not mutate cached default)", () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config1 = manager.getDefaultConfig();
      const config2 = manager.getDefaultConfig();

      // Assert
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);

      // Mutate first config
      config1.skills["test"] = "github:test/skill";
      config1.config.logLevel = "debug";

      // Verify second config is not affected
      expect(config2.skills).toEqual({});
      expect(config2.config.logLevel).toBe("info");
    });
  });

  describe("loadConfig - No package.json", () => {
    it("should return default config when package.json does not exist", async () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config).toEqual({
        skills: {},
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [".claude/skills"],
          maxSkillSize: 5000,
          logLevel: "info",
        },
        source: {
          type: "defaults",
        },
      });
    });
  });

  describe("loadConfig - Complete package.json", () => {
    it("should load config with both agentskills and agentskillsConfig fields", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        version: "1.0.0",
        agentskills: {
          "api-integration": "github:anthropic/api-integration#v1.0.0",
          "database-query": "git+https://github.com/org/db-skill.git",
        },
        agentskillsConfig: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [".claude/skills", "~/custom-skills"],
          maxSkillSize: 5000,
          logLevel: "info",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config).toEqual({
        skills: {
          "api-integration": "github:anthropic/api-integration#v1.0.0",
          "database-query": "git+https://github.com/org/db-skill.git",
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [".claude/skills", "~/custom-skills"],
          maxSkillSize: 5000,
          logLevel: "info",
        },
        source: {
          type: "file",
          path: packageJsonPath,
        },
      });
    });

    it("should load config with debug log level", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          logLevel: "debug",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.config.logLevel).toBe("debug");
    });

    it("should load config with custom skillsDirectory", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          skillsDirectory: "custom/skills/path",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.config.skillsDirectory).toBe("custom/skills/path");
    });
  });

  describe("loadConfig - Only agentskills field", () => {
    it("should load skills and use default config when agentskillsConfig is missing", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskills: {
          "skill-one": "github:user/skill-one#v1.0.0",
          "skill-two": "github:user/skill-two#v2.0.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config).toEqual({
        skills: {
          "skill-one": "github:user/skill-one#v1.0.0",
          "skill-two": "github:user/skill-two#v2.0.0",
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [".claude/skills"],
          maxSkillSize: 5000,
          logLevel: "info",
        },
        source: {
          type: "file",
          path: packageJsonPath,
        },
      });
    });
  });

  describe("loadConfig - Only agentskillsConfig field", () => {
    it("should load config and return empty skills when agentskills is missing", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          skillsDirectory: "custom/path",
          logLevel: "warn",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.skills).toEqual({});
      expect(config.config.skillsDirectory).toBe("custom/path");
      expect(config.config.logLevel).toBe("warn");
      expect(config.source.type).toBe("file");
    });
  });

  describe("loadConfig - Neither field present", () => {
    it("should return all defaults when neither agentskills nor agentskillsConfig exist", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        version: "1.0.0",
        dependencies: {
          express: "^4.18.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config).toEqual({
        skills: {},
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [".claude/skills"],
          maxSkillSize: 5000,
          logLevel: "info",
        },
        source: {
          type: "file",
          path: packageJsonPath,
        },
      });
    });
  });

  describe("loadConfig - Empty objects", () => {
    it("should handle empty agentskills object", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskills: {},
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.skills).toEqual({});
      expect(config.source.type).toBe("file");
    });

    it("should use defaults for empty agentskillsConfig object", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {},
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.config).toEqual({
        skillsDirectory: ".agentskills/skills",
        autoDiscover: [".claude/skills"],
        maxSkillSize: 5000,
        logLevel: "info",
      });
    });
  });

  describe("loadConfig - Partial agentskillsConfig", () => {
    it("should merge partial config with defaults (only skillsDirectory)", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          skillsDirectory: "custom/skills",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.config).toEqual({
        skillsDirectory: "custom/skills",
        autoDiscover: [".claude/skills"],
        maxSkillSize: 5000,
        logLevel: "info",
      });
    });

    it("should merge partial config with defaults (only autoDiscover)", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          autoDiscover: ["./skills", "~/global-skills"],
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.config).toEqual({
        skillsDirectory: ".agentskills/skills",
        autoDiscover: ["./skills", "~/global-skills"],
        maxSkillSize: 5000,
        logLevel: "info",
      });
    });

    it("should merge partial config with defaults (only maxSkillSize)", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          maxSkillSize: 10000,
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.config).toEqual({
        skillsDirectory: ".agentskills/skills",
        autoDiscover: [".claude/skills"],
        maxSkillSize: 10000,
        logLevel: "info",
      });
    });

    it("should merge partial config with defaults (only logLevel)", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          logLevel: "error",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.config).toEqual({
        skillsDirectory: ".agentskills/skills",
        autoDiscover: [".claude/skills"],
        maxSkillSize: 5000,
        logLevel: "error",
      });
    });

    it("should merge partial config with multiple custom fields", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          maxSkillSize: 8000,
          logLevel: "warn",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      const config = await manager.loadConfig();

      // Assert
      expect(config.config).toEqual({
        skillsDirectory: ".agentskills/skills",
        autoDiscover: [".claude/skills"],
        maxSkillSize: 8000,
        logLevel: "warn",
      });
    });
  });

  describe("loadConfig - Invalid JSON", () => {
    it("should throw error for invalid JSON in package.json", async () => {
      // Arrange
      await fs.writeFile(
        packageJsonPath,
        "{ invalid json: this is not valid }",
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /Failed to parse package\.json/
      );
    });

    it("should throw error for truncated JSON", async () => {
      // Arrange
      await fs.writeFile(
        packageJsonPath,
        '{ "name": "my-project", "agentskills": {',
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow();
    });
  });

  describe("loadConfig - Validation errors", () => {
    it("should throw error for invalid logLevel value", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          logLevel: "invalid",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /Invalid logLevel.*must be one of: error, warn, info, debug/i
      );
    });

    it("should throw error for non-string logLevel", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          logLevel: 123,
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /logLevel must be a string/i
      );
    });

    it("should throw error for non-array autoDiscover", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          autoDiscover: "not-an-array",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /autoDiscover must be an array/i
      );
    });

    it("should throw error for autoDiscover array with non-string elements", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          autoDiscover: [".claude/skills", 123, "valid-path"],
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /autoDiscover must contain only strings/i
      );
    });

    it("should throw error for non-number maxSkillSize", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          maxSkillSize: "5000",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /maxSkillSize must be a number/i
      );
    });

    it("should throw error for negative maxSkillSize", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          maxSkillSize: -1000,
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /maxSkillSize must be a positive number/i
      );
    });

    it("should throw error for zero maxSkillSize", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          maxSkillSize: 0,
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /maxSkillSize must be a positive number/i
      );
    });

    it("should throw error for non-string skillsDirectory", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          skillsDirectory: 123,
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /skillsDirectory must be a string/i
      );
    });

    it("should throw error for empty skillsDirectory", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: {
          skillsDirectory: "",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /skillsDirectory cannot be empty/i
      );
    });

    it("should throw error for non-object agentskills", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskills: "not-an-object",
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /agentskills must be an object/i
      );
    });

    it("should throw error for agentskills with non-string values", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskills: {
          "valid-skill": "github:user/repo",
          "invalid-skill": 123,
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /agentskills values must be strings/i
      );
    });

    it("should throw error for non-object agentskillsConfig", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskillsConfig: "not-an-object",
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /agentskillsConfig must be an object/i
      );
    });
  });

  describe("loadConfig - File system errors", () => {
    it("should throw error for permission denied when reading package.json", async () => {
      // Arrange
      await fs.writeFile(packageJsonPath, '{"name": "test"}', "utf-8");

      // Mock fs.readFile to simulate permission error
      const originalReadFile = fs.readFile;
      vi.spyOn(fs, "readFile").mockRejectedValueOnce(
        Object.assign(new Error("EACCES: permission denied"), {
          code: "EACCES",
        })
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.loadConfig()).rejects.toThrow(
        /Permission denied.*package\.json/i
      );

      // Cleanup
      vi.restoreAllMocks();
    });
  });

  describe("saveSkills", () => {
    it("should create new package.json with skills when file does not exist", async () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);
      const skills = {
        "skill-one": "github:user/skill-one#v1.0.0",
        "skill-two": "github:user/skill-two#v2.0.0",
      };

      // Act
      await manager.saveSkills(skills);

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual(skills);
      expect(packageJson.name).toBeDefined(); // Should create minimal package.json
    });

    it("should update existing package.json with new skills", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        version: "1.0.0",
        dependencies: {
          express: "^4.18.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);
      const skills = {
        "new-skill": "github:user/new-skill#v1.0.0",
      };

      // Act
      await manager.saveSkills(skills);

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual(skills);
      expect(packageJson.name).toBe("my-project");
      expect(packageJson.version).toBe("1.0.0");
      expect(packageJson.dependencies).toEqual({ express: "^4.18.0" });
    });

    it("should replace existing agentskills field", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        agentskills: {
          "old-skill": "github:user/old-skill#v1.0.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);
      const skills = {
        "new-skill": "github:user/new-skill#v2.0.0",
      };

      // Act
      await manager.saveSkills(skills);

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual(skills);
      expect(packageJson.agentskills["old-skill"]).toBeUndefined();
    });

    it("should preserve agentskillsConfig when saving skills", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        agentskillsConfig: {
          skillsDirectory: "custom/path",
          logLevel: "debug",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);
      const skills = {
        "skill-one": "github:user/skill-one#v1.0.0",
      };

      // Act
      await manager.saveSkills(skills);

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual(skills);
      expect(packageJson.agentskillsConfig).toEqual({
        skillsDirectory: "custom/path",
        logLevel: "debug",
      });
    });

    it("should handle empty skills object", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        agentskills: {
          "skill-one": "github:user/skill-one#v1.0.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      await manager.saveSkills({});

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual({});
    });

    it("should format JSON with proper indentation", async () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);
      const skills = {
        "skill-one": "github:user/skill-one#v1.0.0",
      };

      // Act
      await manager.saveSkills(skills);

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");

      // Verify proper indentation (should be 2 spaces)
      expect(packageJsonContent).toContain('  "agentskills"');
      expect(packageJsonContent).toContain('    "skill-one"');
    });
  });

  describe("addSkill", () => {
    it("should add skill to existing agentskills", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        agentskills: {
          "existing-skill": "github:user/existing#v1.0.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      await manager.addSkill("new-skill", "github:user/new-skill#v2.0.0");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual({
        "existing-skill": "github:user/existing#v1.0.0",
        "new-skill": "github:user/new-skill#v2.0.0",
      });
    });

    it("should create agentskills field when it does not exist", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        version: "1.0.0",
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      await manager.addSkill("first-skill", "github:user/first#v1.0.0");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual({
        "first-skill": "github:user/first#v1.0.0",
      });
      expect(packageJson.name).toBe("my-project");
    });

    it("should create package.json if it does not exist", async () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);

      // Act
      await manager.addSkill("first-skill", "github:user/first#v1.0.0");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual({
        "first-skill": "github:user/first#v1.0.0",
      });
    });

    it("should update existing skill with new spec", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        agentskills: {
          "my-skill": "github:user/my-skill#v1.0.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      await manager.addSkill("my-skill", "github:user/my-skill#v2.0.0");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills["my-skill"]).toBe(
        "github:user/my-skill#v2.0.0"
      );
    });

    it("should preserve other fields when adding skill", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        version: "1.0.0",
        dependencies: {
          express: "^4.18.0",
        },
        agentskillsConfig: {
          logLevel: "debug",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      await manager.addSkill("new-skill", "github:user/new#v1.0.0");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.name).toBe("my-project");
      expect(packageJson.version).toBe("1.0.0");
      expect(packageJson.dependencies).toEqual({ express: "^4.18.0" });
      expect(packageJson.agentskillsConfig).toEqual({ logLevel: "debug" });
    });

    it("should throw error for empty skill name", async () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(
        manager.addSkill("", "github:user/skill#v1.0.0")
      ).rejects.toThrow(/Skill name cannot be empty/i);
    });

    it("should throw error for empty skill spec", async () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.addSkill("my-skill", "")).rejects.toThrow(
        /Skill spec cannot be empty/i
      );
    });
  });

  describe("removeSkill", () => {
    it("should remove skill from agentskills", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        agentskills: {
          "skill-one": "github:user/skill-one#v1.0.0",
          "skill-two": "github:user/skill-two#v2.0.0",
          "skill-three": "github:user/skill-three#v3.0.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      await manager.removeSkill("skill-two");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual({
        "skill-one": "github:user/skill-one#v1.0.0",
        "skill-three": "github:user/skill-three#v3.0.0",
      });
    });

    it("should not error when removing non-existent skill", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        agentskills: {
          "skill-one": "github:user/skill-one#v1.0.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act - Should not throw
      await manager.removeSkill("non-existent-skill");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual({
        "skill-one": "github:user/skill-one#v1.0.0",
      });
    });

    it("should not error when agentskills field does not exist", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        version: "1.0.0",
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act - Should not throw
      await manager.removeSkill("some-skill");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toBeUndefined();
    });

    it("should not error when package.json does not exist", async () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);

      // Act - Should not throw
      await manager.removeSkill("some-skill");

      // Assert - package.json should not be created
      const exists = await fs
        .access(packageJsonPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(false);
    });

    it("should preserve other fields when removing skill", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        version: "1.0.0",
        dependencies: {
          express: "^4.18.0",
        },
        agentskills: {
          "skill-one": "github:user/skill-one#v1.0.0",
          "skill-two": "github:user/skill-two#v2.0.0",
        },
        agentskillsConfig: {
          logLevel: "debug",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      await manager.removeSkill("skill-one");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.name).toBe("my-project");
      expect(packageJson.version).toBe("1.0.0");
      expect(packageJson.dependencies).toEqual({ express: "^4.18.0" });
      expect(packageJson.agentskillsConfig).toEqual({ logLevel: "debug" });
      expect(packageJson.agentskills).toEqual({
        "skill-two": "github:user/skill-two#v2.0.0",
      });
    });

    it("should result in empty agentskills object when last skill is removed", async () => {
      // Arrange
      const existingPackageJson = {
        name: "my-project",
        agentskills: {
          "last-skill": "github:user/last-skill#v1.0.0",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(existingPackageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act
      await manager.removeSkill("last-skill");

      // Assert
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.agentskills).toEqual({});
    });

    it("should throw error for empty skill name", async () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);

      // Act & Assert
      await expect(manager.removeSkill("")).rejects.toThrow(
        /Skill name cannot be empty/i
      );
    });
  });

  describe("Integration - Complete workflow", () => {
    it("should support complete add/load/remove workflow", async () => {
      // Arrange
      const manager = new PackageConfigManager(projectRoot);

      // Act 1: Add first skill
      await manager.addSkill("skill-one", "github:user/skill-one#v1.0.0");

      // Assert 1: Load and verify
      let config = await manager.loadConfig();
      expect(config.skills).toEqual({
        "skill-one": "github:user/skill-one#v1.0.0",
      });
      expect(config.source.type).toBe("file");

      // Act 2: Add second skill
      await manager.addSkill("skill-two", "github:user/skill-two#v2.0.0");

      // Assert 2: Load and verify both skills
      config = await manager.loadConfig();
      expect(config.skills).toEqual({
        "skill-one": "github:user/skill-one#v1.0.0",
        "skill-two": "github:user/skill-two#v2.0.0",
      });

      // Act 3: Remove first skill
      await manager.removeSkill("skill-one");

      // Assert 3: Load and verify only second skill remains
      config = await manager.loadConfig();
      expect(config.skills).toEqual({
        "skill-two": "github:user/skill-two#v2.0.0",
      });

      // Act 4: Save multiple skills at once
      await manager.saveSkills({
        "skill-three": "github:user/skill-three#v3.0.0",
        "skill-four": "github:user/skill-four#v4.0.0",
      });

      // Assert 4: Load and verify replaced skills
      config = await manager.loadConfig();
      expect(config.skills).toEqual({
        "skill-three": "github:user/skill-three#v3.0.0",
        "skill-four": "github:user/skill-four#v4.0.0",
      });
      expect(config.skills["skill-two"]).toBeUndefined();
    });

    it("should maintain config settings throughout skill operations", async () => {
      // Arrange
      const packageJson = {
        name: "my-project",
        agentskills: {
          "initial-skill": "github:user/initial#v1.0.0",
        },
        agentskillsConfig: {
          skillsDirectory: "custom/path",
          autoDiscover: ["./custom"],
          maxSkillSize: 8000,
          logLevel: "debug",
        },
      };

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);

      // Act: Perform various skill operations
      await manager.addSkill("new-skill", "github:user/new#v1.0.0");
      await manager.removeSkill("initial-skill");
      await manager.addSkill("another-skill", "github:user/another#v2.0.0");

      // Assert: Config settings should remain unchanged
      const config = await manager.loadConfig();
      expect(config.config).toEqual({
        skillsDirectory: "custom/path",
        autoDiscover: ["./custom"],
        maxSkillSize: 8000,
        logLevel: "debug",
      });
    });
  });
});
