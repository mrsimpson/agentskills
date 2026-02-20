import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { homedir } from "os";

/**
 * Comprehensive test suite for ConfigManager component
 * 
 * Following TDD approach:
 * - Tests written before implementation
 * - Minimal mocking (use real file system with temp directories)
 * - Test-driven interface design
 * - Clear test structure with arrange-act-assert
 * 
 * Coverage:
 * 1. Load from file (YAML and JSON formats)
 * 2. File discovery (current dir, home dir, precedence)
 * 3. Default configuration (when no config file exists)
 * 4. Validation (schema validation, required fields, types)
 * 5. Path resolution (tilde expansion, relative paths, absolute paths)
 * 6. Error handling (invalid syntax, read errors, malformed configs)
 */

// Import the ConfigManager interfaces/types
import type {
  Config,
  ConfigSettings,
  SkillSource,
} from "../types";

// Import ConfigManager implementation
import { ConfigManager } from "../config-manager";

describe("ConfigManager", () => {
  let testDir: string;
  let originalCwd: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    // Save original working directory
    originalCwd = process.cwd();

    // Save original HOME
    originalHome = process.env.HOME;

    // Create temp directory for tests
    testDir = await fs.mkdtemp(join(tmpdir(), "agentskills-config-test-"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Restore original HOME
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
      console.warn(`Failed to clean up test directory: ${error}`);
    }
  });

  describe("loadConfig - Load from file", () => {
    it("should load valid YAML config", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
    priority: 1
  - type: local_directory
    path: ~/.claude/skills
    priority: 2
settings:
  maxSkillSize: 5000
  logLevel: info
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.version).toBe("1.0");
      expect(config.sources).toHaveLength(2);
      expect(config.sources[0].type).toBe("local_directory");
      expect(config.sources[0].path).toBe(".claude/skills");
      expect(config.sources[0].priority).toBe(1);
      // Tilde should be expanded to home directory
      expect(config.sources[1].path).not.toContain("~");
      expect(config.sources[1].path).toContain(homedir());
      expect(config.sources[1].priority).toBe(2);
      expect(config.settings.maxSkillSize).toBe(5000);
      expect(config.settings.logLevel).toBe("info");
    });

    it("should load valid JSON config", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = {
        version: "1.0",
        sources: [
          {
            type: "local_directory",
            path: ".claude/skills",
            priority: 1,
          },
          {
            type: "local_directory",
            path: "~/.claude/skills",
            priority: 2,
          },
        ],
        settings: {
          maxSkillSize: 5000,
          logLevel: "info",
        },
      };
      await fs.writeFile(
        join(configDir, "config.json"),
        JSON.stringify(configContent, null, 2)
      );

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.json")
      );

      // Assert
      expect(config.version).toBe("1.0");
      expect(config.sources).toHaveLength(2);
      expect(config.sources[0].type).toBe("local_directory");
      expect(config.sources[0].path).toBe(".claude/skills");
      // Tilde should be expanded to home directory
      expect(config.sources[1].path).not.toContain("~");
      expect(config.sources[1].path).toContain(homedir());
      expect(config.settings.maxSkillSize).toBe(5000);
      expect(config.settings.logLevel).toBe("info");
    });

    it("should parse sources array correctly", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: ./custom/path
  - type: local_directory
    path: /absolute/path
    priority: 10
  - type: local_directory
    path: ~/home/path
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.sources).toHaveLength(3);
      // ./custom/path should be resolved to absolute
      expect(config.sources[0].path).toMatch(/^[/\\]|^[A-Za-z]:/);
      expect(config.sources[0].path).toContain("custom/path");
      expect(config.sources[0].priority).toBeUndefined();
      expect(config.sources[1].path).toBe("/absolute/path");
      expect(config.sources[1].priority).toBe(10);
      // ~/home/path should have tilde expanded
      expect(config.sources[2].path).not.toContain("~");
      expect(config.sources[2].path).toContain(homedir());
    });

    it("should parse settings object correctly", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
settings:
  maxSkillSize: 10000
  logLevel: debug
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.settings.maxSkillSize).toBe(10000);
      expect(config.settings.logLevel).toBe("debug");
    });

    it("should handle config with only required fields", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.version).toBe("1.0");
      expect(config.sources).toHaveLength(1);
      expect(config.settings).toBeDefined();
    });
  });

  describe("loadConfig - File discovery", () => {
    it("should find .agentskills/config.yaml in current directory", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig();

      // Assert
      expect(config.version).toBe("1.0");
      expect(config.sources).toHaveLength(1);
    });

    it("should find .agentskills/config.json if no YAML exists", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = {
        version: "1.0",
        sources: [
          {
            type: "local_directory",
            path: ".claude/skills",
          },
        ],
      };
      await fs.writeFile(
        join(configDir, "config.json"),
        JSON.stringify(configContent)
      );

      // Act
      const config = await ConfigManager.loadConfig();

      // Assert
      expect(config.version).toBe("1.0");
      expect(config.sources).toHaveLength(1);
    });

    it("should find ~/.agentskills/config.yaml in home directory", async () => {
      // Arrange
      const homeDir = join(testDir, "home");
      await fs.mkdir(homeDir, { recursive: true });
      process.env.HOME = homeDir;

      const configDir = join(homeDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: ~/.claude/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Change to a different directory
      const workDir = join(testDir, "work");
      await fs.mkdir(workDir, { recursive: true });
      process.chdir(workDir);

      // Act
      const config = await ConfigManager.loadConfig();

      // Assert
      expect(config.version).toBe("1.0");
      expect(config.sources).toHaveLength(1);
    });

    it("should prefer current directory over home directory", async () => {
      // Arrange
      // Setup home config
      const homeDir = join(testDir, "home");
      await fs.mkdir(homeDir, { recursive: true });
      process.env.HOME = homeDir;

      const homeConfigDir = join(homeDir, ".agentskills");
      await fs.mkdir(homeConfigDir, { recursive: true });
      await fs.writeFile(
        join(homeConfigDir, "config.yaml"),
        `version: "1.0"
sources:
  - type: local_directory
    path: ~/home/skills
`
      );

      // Setup current directory config
      const workDir = join(testDir, "work");
      await fs.mkdir(workDir, { recursive: true });
      process.chdir(workDir);

      const workConfigDir = join(workDir, ".agentskills");
      await fs.mkdir(workConfigDir, { recursive: true });
      await fs.writeFile(
        join(workConfigDir, "config.yaml"),
        `version: "1.0"
sources:
  - type: local_directory
    path: ./work/skills
`
      );

      // Act
      const config = await ConfigManager.loadConfig();

      // Assert - should use work directory config
      // ./work/skills should be resolved to absolute path
      expect(config.sources[0].path).toMatch(/^[/\\]|^[A-Za-z]:/);
      expect(config.sources[0].path).toContain("work");
      expect(config.sources[0].path).toContain("skills");
    });

    it("should prefer YAML over JSON in same directory", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      // Create JSON config
      await fs.writeFile(
        join(configDir, "config.json"),
        JSON.stringify({
          version: "1.0",
          sources: [{ type: "local_directory", path: "./json/path" }],
        })
      );

      // Create YAML config
      await fs.writeFile(
        join(configDir, "config.yaml"),
        `version: "1.0"
sources:
  - type: local_directory
    path: ./yaml/path
`
      );

      // Act
      const config = await ConfigManager.loadConfig();

      // Assert - should use YAML
      // ./yaml/path should be resolved to absolute path
      expect(config.sources[0].path).toMatch(/^[/\\]|^[A-Za-z]:/);
      expect(config.sources[0].path).toContain("yaml");
      expect(config.sources[0].path).toContain("path");
    });
  });

  describe("getDefaultConfig - Default configuration", () => {
    it("should return default config when no config file exists", async () => {
      // Act
      const config = ConfigManager.getDefaultConfig();

      // Assert
      expect(config.version).toBe("1.0");
      expect(config.sources).toHaveLength(2);
      expect(config.sources[0].path).toBe(".claude/skills/");
      expect(config.sources[1].path).toBe("~/.claude/skills/");
    });

    it("should use defaults when loadConfig finds no file", async () => {
      // Arrange - no config file exists

      // Act
      const config = await ConfigManager.loadConfig();

      // Assert
      expect(config.version).toBe("1.0");
      expect(config.sources).toHaveLength(2);
      expect(config.sources[0].path).toBe(".claude/skills/");
      expect(config.sources[1].path).toBe("~/.claude/skills/");
    });

    it("should include default settings", async () => {
      // Act
      const config = ConfigManager.getDefaultConfig();

      // Assert
      expect(config.settings).toBeDefined();
      expect(config.settings.maxSkillSize).toBeDefined();
      expect(config.settings.logLevel).toBeDefined();
    });

    it("should have sensible default values", async () => {
      // Act
      const config = ConfigManager.getDefaultConfig();

      // Assert
      expect(config.settings.maxSkillSize).toBeGreaterThan(0);
      expect(["error", "warn", "info", "debug"]).toContain(
        config.settings.logLevel
      );
    });
  });

  describe("loadConfig - Validation", () => {
    it("should reject config with missing version field", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `sources:
  - type: local_directory
    path: .claude/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/version/i);
    });

    it("should reject config with invalid version format", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: 1.0
sources:
  - type: local_directory
    path: .claude/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/version/i);
    });

    it("should reject config with invalid sources (not array)", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  type: local_directory
  path: .claude/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/sources.*array/i);
    });

    it("should reject config with invalid source type", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: remote_url
    path: https://example.com
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/source type/i);
    });

    it("should reject source with missing path", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    priority: 1
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/path/i);
    });

    it("should reject config with invalid settings type", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
settings: "invalid"
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/settings/i);
    });

    it("should reject config with invalid logLevel value", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
settings:
  logLevel: invalid_level
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/logLevel/i);
    });

    it("should reject config with invalid maxSkillSize type", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
settings:
  maxSkillSize: "not_a_number"
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/maxSkillSize/i);
    });

    it("should reject empty sources array", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources: []
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/sources.*empty/i);
    });
  });

  describe("loadConfig - Path resolution", () => {
    it("should expand tilde in paths", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: ~/custom/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.sources[0].path).not.toContain("~");
      expect(config.sources[0].path).toContain(homedir());
    });

    it("should resolve relative paths to absolute", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: ./relative/path
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.sources[0].path).toMatch(/^[/\\]|^[A-Za-z]:/); // Starts with / or C: (absolute)
    });

    it("should leave absolute paths unchanged", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const absolutePath = "/absolute/path/to/skills";
      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: ${absolutePath}
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.sources[0].path).toBe(absolutePath);
    });

    it("should handle mixed path types correctly", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: ~/home/path
  - type: local_directory
    path: ./relative/path
  - type: local_directory
    path: /absolute/path
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.sources[0].path).not.toContain("~");
      expect(config.sources[0].path).toContain(homedir());
      expect(config.sources[1].path).not.toContain("./");
      expect(config.sources[1].path).toMatch(/^[/\\]|^[A-Za-z]:/);
      expect(config.sources[2].path).toBe("/absolute/path");
    });
  });

  describe("loadConfig - Error handling", () => {
    it("should reject invalid YAML syntax", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
  invalid yaml syntax here: [
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.yaml"))
      ).rejects.toThrow(/yaml/i);
    });

    it("should reject invalid JSON syntax", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `{
  "version": "1.0",
  "sources": [
    {
      "type": "local_directory",
      "path": ".claude/skills"
    }
  ],
  invalid json
}`;
      await fs.writeFile(join(configDir, "config.json"), configContent);

      // Act & Assert
      await expect(
        ConfigManager.loadConfig(join(configDir, "config.json"))
      ).rejects.toThrow(/json/i);
    });

    it("should handle file read errors", async () => {
      // Arrange
      const configPath = join(testDir, "nonexistent", "config.yaml");

      // Act & Assert
      await expect(ConfigManager.loadConfig(configPath)).rejects.toThrow();
    });

    it("should handle unreadable files", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configPath = join(configDir, "config.yaml");
      await fs.writeFile(
        configPath,
        `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
`
      );

      // Make file unreadable (skip on Windows as chmod behaves differently)
      if (process.platform !== "win32") {
        await fs.chmod(configPath, 0o000);

        // Act & Assert
        await expect(ConfigManager.loadConfig(configPath)).rejects.toThrow();

        // Cleanup - restore permissions
        await fs.chmod(configPath, 0o644);
      }
    });

    it("should provide meaningful error messages", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: invalid_type
    path: .claude/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act & Assert
      try {
        await ConfigManager.loadConfig(join(configDir, "config.yaml"));
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeTruthy();
        expect((error as Error).message.length).toBeGreaterThan(10);
      }
    });
  });

  describe("loadConfig - Edge cases", () => {
    it("should handle empty settings object", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
settings: {}
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.settings).toBeDefined();
      expect(typeof config.settings).toBe("object");
    });

    it("should handle missing settings field with defaults", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.settings).toBeDefined();
    });

    it("should handle sources without priority", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.sources[0].priority).toBeUndefined();
    });

    it("should handle very long paths", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const longPath = "/very/long/path/".repeat(50);
      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: ${longPath}
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.sources[0].path).toBe(longPath);
    });

    it("should handle special characters in paths", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const specialPath = "./skills with spaces/and-dashes/under_scores";
      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: "${specialPath}"
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.sources[0].path).toContain("skills with spaces");
    });

    it("should handle multiple sources with same path", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
    priority: 1
  - type: local_directory
    path: .claude/skills
    priority: 2
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.sources).toHaveLength(2);
      expect(config.sources[0].path).toBe(config.sources[1].path);
    });
  });

  describe("Integration - Full workflow", () => {
    it("should load, validate, and resolve paths in one workflow", async () => {
      // Arrange
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });

      const configContent = `version: "1.0"
sources:
  - type: local_directory
    path: ~/global/skills
    priority: 1
  - type: local_directory
    path: ./local/skills
    priority: 2
settings:
  maxSkillSize: 8000
  logLevel: warn
`;
      await fs.writeFile(join(configDir, "config.yaml"), configContent);

      // Act
      const config = await ConfigManager.loadConfig(
        join(configDir, "config.yaml")
      );

      // Assert
      expect(config.version).toBe("1.0");
      expect(config.sources).toHaveLength(2);
      expect(config.sources[0].path).not.toContain("~");
      expect(config.sources[1].path).not.toContain("./");
      expect(config.settings.maxSkillSize).toBe(8000);
      expect(config.settings.logLevel).toBe("warn");
    });

    it("should prefer explicit path over auto-discovery", async () => {
      // Arrange
      // Setup auto-discovery config
      const configDir = join(testDir, ".agentskills");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        join(configDir, "config.yaml"),
        `version: "1.0"
sources:
  - type: local_directory
    path: ./auto/discovered
`
      );

      // Setup explicit config
      const explicitDir = join(testDir, "explicit");
      await fs.mkdir(explicitDir, { recursive: true });
      await fs.writeFile(
        join(explicitDir, "config.yaml"),
        `version: "1.0"
sources:
  - type: local_directory
    path: ./explicit/path
`
      );

      // Act
      const config = await ConfigManager.loadConfig(
        join(explicitDir, "config.yaml")
      );

      // Assert
      expect(config.sources[0].path).toContain("explicit");
    });
  });
});
