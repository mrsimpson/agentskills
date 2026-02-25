import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PackageConfigManager } from "../package-config.js";
import * as globalConfigPaths from "../global-config-paths.js";

interface PackageConfig {
  skills: Record<string, string>;
  config: {
    skillsDirectory: string;
    autoDiscover: string[];
    maxSkillSize: number;
    logLevel: "error" | "warn" | "info" | "debug";
  };
  source:
    | {
        type: "file" | "defaults";
        path?: string;
      }
    | {
        type: "merged";
        global?: string;
        local?: string;
      };
}

describe("PackageConfigManager", () => {
  let tempDir: string;
  let projectRoot: string;
  let packageJsonPath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `package-config-test-${Date.now()}`);
    projectRoot = join(tempDir, "project");
    packageJsonPath = join(projectRoot, "package.json");
    await fs.mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Constructor and defaults", () => {
    it("should throw error for invalid project root", () => {
      expect(() => new PackageConfigManager("")).toThrow(
        "Project root directory is required"
      );
      expect(() => new PackageConfigManager(null as any)).toThrow();
    });

    it("should return default configuration", () => {
      const manager = new PackageConfigManager(projectRoot);
      const config = manager.getDefaultConfig();

      expect(config).toEqual({
        skills: {},
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [".claude/skills"],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: { type: "defaults" }
      });
    });
  });

  describe("loadConfig - Various scenarios", () => {
    it("should return defaults when package.json does not exist", async () => {
      const manager = new PackageConfigManager(projectRoot);
      const config = await manager.loadConfig();
      expect(config.source.type).toBe("defaults");
      expect(config.skills).toEqual({});
    });

    it("should load complete config with both fields", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: "project",
          agentskills: {
            "api-integration": "github:user/api#v1.0.0",
            "database-query": "git+https://github.com/org/db.git"
          },
          agentskillsConfig: {
            skillsDirectory: ".agentskills/skills",
            autoDiscover: [".claude/skills", "~/custom"],
            maxSkillSize: 5000,
            logLevel: "info"
          }
        }),
        "utf-8"
      );

      const config = await new PackageConfigManager(projectRoot).loadConfig();
      expect(config.source.type).toBe("file");
      expect(config.skills).toEqual({
        "api-integration": "github:user/api#v1.0.0",
        "database-query": "git+https://github.com/org/db.git"
      });
      expect(config.config.skillsDirectory).toBe(".agentskills/skills");
    });

    it("should load skills only and use default config", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: "project",
          agentskills: { "skill-one": "github:user/skill-one" }
        }),
        "utf-8"
      );

      const config = await new PackageConfigManager(projectRoot).loadConfig();
      expect(config.skills).toEqual({ "skill-one": "github:user/skill-one" });
      expect(config.config.logLevel).toBe("info");
    });

    it("should merge partial config with defaults", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          agentskillsConfig: {
            skillsDirectory: "custom/path",
            logLevel: "debug"
          }
        }),
        "utf-8"
      );

      const config = await new PackageConfigManager(projectRoot).loadConfig();
      expect(config.config.skillsDirectory).toBe("custom/path");
      expect(config.config.logLevel).toBe("debug");
      expect(config.config.autoDiscover).toEqual([".claude/skills"]);
    });
  });

  describe("loadConfig - Validation errors", () => {
    it("should throw for invalid JSON", async () => {
      await fs.writeFile(packageJsonPath, "{ invalid json", "utf-8");
      await expect(
        new PackageConfigManager(projectRoot).loadConfig()
      ).rejects.toThrow(/Failed to parse/);
    });

    it.each([
      ["invalid logLevel", { logLevel: "invalid" }, /Invalid logLevel/i],
      [
        "non-array autoDiscover",
        { autoDiscover: "string" },
        /autoDiscover must be an array/i
      ],
      [
        "non-number maxSkillSize",
        { maxSkillSize: "5000" },
        /maxSkillSize must be a number/i
      ],
      [
        "negative maxSkillSize",
        { maxSkillSize: -100 },
        /maxSkillSize must be a positive/i
      ],
      [
        "empty skillsDirectory",
        { skillsDirectory: "" },
        /skillsDirectory cannot be empty/i
      ]
    ])("should throw for %s", async (_, config, expectedError) => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ agentskillsConfig: config }),
        "utf-8"
      );
      await expect(
        new PackageConfigManager(projectRoot).loadConfig()
      ).rejects.toThrow(expectedError);
    });

    it("should throw for non-object agentskills", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ agentskills: "not-object" }),
        "utf-8"
      );
      await expect(
        new PackageConfigManager(projectRoot).loadConfig()
      ).rejects.toThrow(/agentskills must be an object/i);
    });

    it("should throw for agentskills with non-string values", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ agentskills: { skill: 123 } }),
        "utf-8"
      );
      await expect(
        new PackageConfigManager(projectRoot).loadConfig()
      ).rejects.toThrow(/values must be strings/i);
    });
  });

  describe("saveSkills", () => {
    it("should create package.json with skills when file does not exist", async () => {
      const manager = new PackageConfigManager(projectRoot);
      await manager.saveSkills({ "skill-one": "github:user/skill-one" });

      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );
      expect(packageJson.agentskills).toEqual({
        "skill-one": "github:user/skill-one"
      });
    });

    it("should update existing package.json and preserve other fields", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: "project",
          version: "1.0.0",
          dependencies: { express: "^4.0.0" },
          agentskillsConfig: { logLevel: "debug" }
        }),
        "utf-8"
      );

      await new PackageConfigManager(projectRoot).saveSkills({
        "new-skill": "github:user/new"
      });

      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );
      expect(packageJson.agentskills).toEqual({
        "new-skill": "github:user/new"
      });
      expect(packageJson.name).toBe("project");
      expect(packageJson.dependencies).toEqual({ express: "^4.0.0" });
      expect(packageJson.agentskillsConfig).toEqual({ logLevel: "debug" });
    });
  });

  describe("addSkill", () => {
    it("should add skill to existing agentskills", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          agentskills: { existing: "github:user/existing" }
        }),
        "utf-8"
      );

      await new PackageConfigManager(projectRoot).addSkill(
        "new-skill",
        "github:user/new"
      );

      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );
      expect(packageJson.agentskills).toEqual({
        existing: "github:user/existing",
        "new-skill": "github:user/new"
      });
    });

    it("should create package.json if it does not exist", async () => {
      await new PackageConfigManager(projectRoot).addSkill(
        "first",
        "github:user/first"
      );
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );
      expect(packageJson.agentskills).toEqual({ first: "github:user/first" });
    });

    it("should update existing skill with new spec", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          agentskills: { skill: "github:user/skill#v1.0.0" }
        }),
        "utf-8"
      );

      await new PackageConfigManager(projectRoot).addSkill(
        "skill",
        "github:user/skill#v2.0.0"
      );

      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );
      expect(packageJson.agentskills["skill"]).toBe("github:user/skill#v2.0.0");
    });

    it("should throw for empty name or spec", async () => {
      const manager = new PackageConfigManager(projectRoot);
      await expect(manager.addSkill("", "github:user/skill")).rejects.toThrow(
        /name cannot be empty/i
      );
      await expect(manager.addSkill("skill", "")).rejects.toThrow(
        /spec cannot be empty/i
      );
    });
  });

  describe("removeSkill", () => {
    it("should remove skill from agentskills", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          agentskills: {
            "skill-one": "github:user/one",
            "skill-two": "github:user/two"
          }
        }),
        "utf-8"
      );

      await new PackageConfigManager(projectRoot).removeSkill("skill-one");

      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );
      expect(packageJson.agentskills).toEqual({
        "skill-two": "github:user/two"
      });
    });

    it("should not error when removing non-existent skill or when file does not exist", async () => {
      const manager = new PackageConfigManager(projectRoot);
      await expect(manager.removeSkill("non-existent")).resolves.not.toThrow();
    });

    it("should throw for empty skill name", async () => {
      await expect(
        new PackageConfigManager(projectRoot).removeSkill("")
      ).rejects.toThrow(/name cannot be empty/i);
    });
  });

  describe("Integration - Complete workflow", () => {
    it("should support add/load/remove/save workflow", async () => {
      const manager = new PackageConfigManager(projectRoot);

      await manager.addSkill("skill-one", "github:user/one#v1.0.0");
      let config = await manager.loadConfig();
      expect(config.skills).toEqual({ "skill-one": "github:user/one#v1.0.0" });

      await manager.addSkill("skill-two", "github:user/two#v2.0.0");
      config = await manager.loadConfig();
      expect(Object.keys(config.skills)).toHaveLength(2);

      await manager.removeSkill("skill-one");
      config = await manager.loadConfig();
      expect(config.skills).toEqual({ "skill-two": "github:user/two#v2.0.0" });

      await manager.saveSkills({ "skill-three": "github:user/three" });
      config = await manager.loadConfig();
      expect(config.skills).toEqual({ "skill-three": "github:user/three" });
    });

    it("should preserve config settings throughout operations", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          agentskills: { initial: "github:user/initial" },
          agentskillsConfig: {
            skillsDirectory: "custom",
            maxSkillSize: 8000,
            logLevel: "debug"
          }
        }),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);
      await manager.addSkill("new", "github:user/new");
      await manager.removeSkill("initial");

      const config = await manager.loadConfig();
      expect(config.config.skillsDirectory).toBe("custom");
      expect(config.config.maxSkillSize).toBe(8000);
      expect(config.config.logLevel).toBe("debug");
    });
  });

  describe("Scope parameter and global configuration", () => {
    let globalTempDir: string;
    let globalPackageJsonPath: string;

    beforeEach(async () => {
      // Setup a mock global config directory
      globalTempDir = join(tempDir, "global");
      globalPackageJsonPath = join(globalTempDir, "package.json");
      await fs.mkdir(globalTempDir, { recursive: true });

      // Mock the global config path function
      vi.spyOn(globalConfigPaths, "getGlobalPackageJsonPath").mockReturnValue(
        globalPackageJsonPath
      );
      vi.spyOn(globalConfigPaths, "getGlobalConfigDir").mockReturnValue(
        globalTempDir
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should default to 'merged' scope", () => {
      const manager = new PackageConfigManager(projectRoot);
      expect(manager.getScope()).toBe("merged");
    });

    it("should accept 'local' scope", () => {
      const manager = new PackageConfigManager(projectRoot, "local");
      expect(manager.getScope()).toBe("local");
    });

    it("should accept 'global' scope", () => {
      const manager = new PackageConfigManager(projectRoot, "global");
      expect(manager.getScope()).toBe("global");
    });

    it("should load global config when it exists", async () => {
      await fs.writeFile(
        globalPackageJsonPath,
        JSON.stringify({
          name: "global-config",
          agentskills: {
            "global-skill": "github:user/global#v1.0.0"
          }
        }),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);
      const config = await manager.loadGlobalConfig();

      expect(config.source.type).toBe("file");
      expect(config.source).toHaveProperty("path", globalPackageJsonPath);
      expect(config.skills).toEqual({
        "global-skill": "github:user/global#v1.0.0"
      });
    });

    it("should return defaults when global config doesn't exist", async () => {
      const manager = new PackageConfigManager(projectRoot);
      const config = await manager.loadGlobalConfig();

      expect(config.source.type).toBe("defaults");
      expect(config.skills).toEqual({});
    });

    it("should merge global and local configs with local taking precedence", async () => {
      // Setup global config
      await fs.writeFile(
        globalPackageJsonPath,
        JSON.stringify({
          agentskills: {
            "global-skill": "github:user/global#v1.0.0",
            "shared-skill": "github:user/global-version#v1.0.0"
          },
          agentskillsConfig: {
            maxSkillSize: 3000,
            logLevel: "error"
          }
        }),
        "utf-8"
      );

      // Setup local config
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          agentskills: {
            "local-skill": "github:user/local#v1.0.0",
            "shared-skill": "github:user/local-version#v2.0.0"
          },
          agentskillsConfig: {
            maxSkillSize: 8000
          }
        }),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);
      const config = await manager.loadMergedConfig();

      expect(config.source.type).toBe("merged");
      if (config.source.type === "merged") {
        expect(config.source.global).toBe(globalPackageJsonPath);
        expect(config.source.local).toBe(packageJsonPath);
      }

      // Local skill + global skill + local override of shared skill
      expect(config.skills).toEqual({
        "global-skill": "github:user/global#v1.0.0",
        "local-skill": "github:user/local#v1.0.0",
        "shared-skill": "github:user/local-version#v2.0.0" // Local wins
      });

      // Local config values override global
      expect(config.config.maxSkillSize).toBe(8000); // Local wins
      expect(config.config.logLevel).toBe("error"); // From global (not overridden locally)
    });

    it("should handle merged config when only global exists", async () => {
      await fs.writeFile(
        globalPackageJsonPath,
        JSON.stringify({
          agentskills: {
            "global-skill": "github:user/global#v1.0.0"
          }
        }),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);
      const config = await manager.loadMergedConfig();

      expect(config.source.type).toBe("merged");
      if (config.source.type === "merged") {
        expect(config.source.global).toBe(globalPackageJsonPath);
        expect(config.source.local).toBeUndefined();
      }
      expect(config.skills).toEqual({
        "global-skill": "github:user/global#v1.0.0"
      });
    });

    it("should handle merged config when only local exists", async () => {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          agentskills: {
            "local-skill": "github:user/local#v1.0.0"
          }
        }),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot);
      const config = await manager.loadMergedConfig();

      expect(config.source.type).toBe("merged");
      if (config.source.type === "merged") {
        expect(config.source.global).toBeUndefined();
        expect(config.source.local).toBe(packageJsonPath);
      }
      expect(config.skills).toEqual({
        "local-skill": "github:user/local#v1.0.0"
      });
    });

    it("should return defaults when neither global nor local exist", async () => {
      const manager = new PackageConfigManager(projectRoot);
      const config = await manager.loadMergedConfig();

      expect(config.source.type).toBe("defaults");
      expect(config.skills).toEqual({});
    });

    it("should write to global package.json when scope is 'global'", async () => {
      const manager = new PackageConfigManager(projectRoot, "global");
      await manager.addSkill("global-skill", "github:user/skill#v1.0.0");

      const content = await fs.readFile(globalPackageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.agentskills).toEqual({
        "global-skill": "github:user/skill#v1.0.0"
      });

      // Verify local doesn't exist
      await expect(fs.access(packageJsonPath)).rejects.toThrow();
    });

    it("should write to local package.json when scope is 'local'", async () => {
      const manager = new PackageConfigManager(projectRoot, "local");
      await manager.addSkill("local-skill", "github:user/skill#v1.0.0");

      const content = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.agentskills).toEqual({
        "local-skill": "github:user/skill#v1.0.0"
      });

      // Verify global doesn't exist
      await expect(fs.access(globalPackageJsonPath)).rejects.toThrow();
    });

    it("should write to local package.json when scope is 'merged'", async () => {
      const manager = new PackageConfigManager(projectRoot, "merged");
      await manager.addSkill("merged-skill", "github:user/skill#v1.0.0");

      const content = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.agentskills).toEqual({
        "merged-skill": "github:user/skill#v1.0.0"
      });
    });

    it("should create global config directory if it doesn't exist", async () => {
      // Remove the global directory
      await fs.rm(globalTempDir, { recursive: true, force: true });

      const manager = new PackageConfigManager(projectRoot, "global");
      await manager.addSkill("new-global", "github:user/skill#v1.0.0");

      // Verify the directory was created
      const stats = await fs.stat(globalTempDir);
      expect(stats.isDirectory()).toBe(true);

      // Verify the file was created
      const content = await fs.readFile(globalPackageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);
      expect(packageJson.agentskills).toHaveProperty("new-global");
    });

    it("should remove skills from global config when scope is 'global'", async () => {
      await fs.writeFile(
        globalPackageJsonPath,
        JSON.stringify({
          agentskills: {
            "skill-to-remove": "github:user/skill#v1.0.0",
            "skill-to-keep": "github:user/keep#v1.0.0"
          }
        }),
        "utf-8"
      );

      const manager = new PackageConfigManager(projectRoot, "global");
      await manager.removeSkill("skill-to-remove");

      const content = await fs.readFile(globalPackageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      expect(packageJson.agentskills).toEqual({
        "skill-to-keep": "github:user/keep#v1.0.0"
      });
    });
  });
});
