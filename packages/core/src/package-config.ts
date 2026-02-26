import { promises as fs } from "fs";
import { join } from "path";
import type { PackageConfig } from "./types.js";

/**
 * PackageConfigManager - Manages package.json configuration for agent skills
 *
 * Responsibilities:
 * - Read package.json from a directory
 * - Parse `agentskills` field (skill dependencies)
 * - Parse `agentskillsConfig` field (configuration settings)
 * - Provide defaults when package.json doesn't exist
 * - Provide defaults when fields are missing
 * - Validate configuration structure
 * - Save/update skills in package.json
 */
export class PackageConfigManager {
  private projectRoot: string;
  private packageJsonPath: string;

  constructor(projectRoot: string) {
    if (!projectRoot) {
      throw new Error("Project root directory is required");
    }
    this.projectRoot = projectRoot;
    this.packageJsonPath = join(projectRoot, "package.json");
  }

  /**
   * Get default configuration with empty skills and standard defaults
   */
  getDefaultConfig(): PackageConfig {
    return {
      skills: {},
      config: {
        skillsDirectory: ".agents/skills",
        autoDiscover: [".claude/skills"],
        maxSkillSize: 5000,
        logLevel: "info"
      },
      source: {
        type: "defaults"
      }
    };
  }

  /**
   * Load configuration from package.json
   * Returns defaults if package.json doesn't exist
   */
  async loadConfig(): Promise<PackageConfig> {
    try {
      const content = await fs.readFile(this.packageJsonPath, "utf-8");
      let packageJson: Record<string, unknown>;

      try {
        packageJson = JSON.parse(content);
      } catch (error) {
        throw new Error(
          `Failed to parse package.json: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Validate and extract agentskills
      const skills = this.validateAndExtractSkills(packageJson);

      // Validate and extract agentskillsConfig
      const config = this.validateAndExtractConfig(packageJson);

      return {
        skills,
        config,
        source: {
          type: "file",
          path: this.packageJsonPath
        }
      };
    } catch (error: unknown) {
      // Return defaults if file doesn't exist
      if ((error as { code?: string }).code === "ENOENT") {
        return this.getDefaultConfig();
      }

      // Handle permission errors
      if ((error as { code?: string }).code === "EACCES") {
        throw new Error(
          `Permission denied reading package.json at ${this.packageJsonPath}`
        );
      }

      // Re-throw other errors (like parse errors)
      throw error;
    }
  }

  /**
   * Validate and extract skills from package.json
   */
  private validateAndExtractSkills(
    packageJson: Record<string, unknown>
  ): Record<string, string> {
    if (!packageJson.agentskills) {
      return {};
    }

    const agentskills = packageJson.agentskills;

    // Validate agentskills is an object
    if (
      typeof agentskills !== "object" ||
      agentskills === null ||
      Array.isArray(agentskills)
    ) {
      throw new Error("agentskills must be an object");
    }

    // Validate all values are strings
    for (const value of Object.values(agentskills)) {
      if (typeof value !== "string") {
        throw new Error("agentskills values must be strings");
      }
    }

    return agentskills as Record<string, string>;
  }

  /**
   * Validate and extract config from package.json
   */
  private validateAndExtractConfig(
    packageJson: Record<string, unknown>
  ): PackageConfig["config"] {
    const defaultConfig = this.getDefaultConfig().config;

    if (!packageJson.agentskillsConfig) {
      return defaultConfig;
    }

    const agentskillsConfig = packageJson.agentskillsConfig;

    // Validate agentskillsConfig is an object
    if (
      typeof agentskillsConfig !== "object" ||
      agentskillsConfig === null ||
      Array.isArray(agentskillsConfig)
    ) {
      throw new Error("agentskillsConfig must be an object");
    }

    // Type assertion after validation
    const configObj = agentskillsConfig as Record<string, unknown>;

    // Start with defaults and merge
    const config = { ...defaultConfig };

    // Validate and merge skillsDirectory
    if (configObj.skillsDirectory !== undefined) {
      if (typeof configObj.skillsDirectory !== "string") {
        throw new Error("skillsDirectory must be a string");
      }
      if (configObj.skillsDirectory === "") {
        throw new Error("skillsDirectory cannot be empty");
      }
      config.skillsDirectory = configObj.skillsDirectory;
    }

    // Validate and merge autoDiscover
    if (configObj.autoDiscover !== undefined) {
      if (!Array.isArray(configObj.autoDiscover)) {
        throw new Error("autoDiscover must be an array");
      }
      for (const item of configObj.autoDiscover) {
        if (typeof item !== "string") {
          throw new Error("autoDiscover must contain only strings");
        }
      }
      config.autoDiscover = configObj.autoDiscover;
    }

    // Validate and merge maxSkillSize
    if (configObj.maxSkillSize !== undefined) {
      if (typeof configObj.maxSkillSize !== "number") {
        throw new Error("maxSkillSize must be a number");
      }
      if (configObj.maxSkillSize <= 0) {
        throw new Error("maxSkillSize must be a positive number");
      }
      config.maxSkillSize = configObj.maxSkillSize;
    }

    // Validate and merge logLevel
    if (configObj.logLevel !== undefined) {
      if (typeof configObj.logLevel !== "string") {
        throw new Error("logLevel must be a string");
      }
      const validLogLevels = ["error", "warn", "info", "debug"];
      if (!validLogLevels.includes(configObj.logLevel)) {
        throw new Error(
          `Invalid logLevel '${configObj.logLevel}'. Must be one of: error, warn, info, debug`
        );
      }
      config.logLevel = configObj.logLevel as
        | "error"
        | "warn"
        | "info"
        | "debug";
    }

    return config;
  }

  /**
   * Save skills to package.json
   * Creates package.json if it doesn't exist
   * Preserves other fields
   */
  async saveSkills(skills: Record<string, string>): Promise<void> {
    let packageJson: Record<string, unknown>;

    try {
      const content = await fs.readFile(this.packageJsonPath, "utf-8");
      packageJson = JSON.parse(content);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        // Create minimal package.json
        packageJson = {
          name: "agentskills-project"
        };
      } else {
        throw error;
      }
    }

    // Update agentskills field
    packageJson.agentskills = skills;

    // Write back to file with proper formatting
    await fs.writeFile(
      this.packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      "utf-8"
    );
  }

  /**
   * Add a single skill to package.json
   * Updates existing skill if name already exists
   */
  async addSkill(name: string, spec: string): Promise<void> {
    if (!name) {
      throw new Error("Skill name cannot be empty");
    }
    if (!spec) {
      throw new Error("Skill spec cannot be empty");
    }

    let packageJson: Record<string, unknown>;

    try {
      const content = await fs.readFile(this.packageJsonPath, "utf-8");
      packageJson = JSON.parse(content);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        // Create minimal package.json
        packageJson = {
          name: "agentskills-project"
        };
      } else {
        throw error;
      }
    }

    // Initialize agentskills if it doesn't exist
    if (!packageJson.agentskills) {
      packageJson.agentskills = {};
    }

    // Add or update skill - use type assertion after validation
    const agentskills = packageJson.agentskills as Record<string, string>;
    agentskills[name] = spec;

    // Write back to file with proper formatting
    await fs.writeFile(
      this.packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      "utf-8"
    );
  }

  /**
   * Remove a skill from package.json
   * Does not error if skill doesn't exist or file doesn't exist
   */
  async removeSkill(name: string): Promise<void> {
    if (!name) {
      throw new Error("Skill name cannot be empty");
    }

    try {
      const content = await fs.readFile(this.packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      // If agentskills doesn't exist, nothing to remove
      if (!packageJson.agentskills) {
        return;
      }

      // Remove skill
      delete packageJson.agentskills[name];

      // Write back to file with proper formatting
      await fs.writeFile(
        this.packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        "utf-8"
      );
    } catch (error: unknown) {
      // If file doesn't exist, nothing to remove
      if ((error as { code?: string }).code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}
