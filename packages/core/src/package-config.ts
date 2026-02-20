import { promises as fs } from "fs";
import { join } from "path";
import type { PackageConfig } from "./types";

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
        skillsDirectory: ".agentskills/skills",
        autoDiscover: [".claude/skills"],
        maxSkillSize: 5000,
        logLevel: "info",
      },
      source: {
        type: "defaults",
      },
    };
  }

  /**
   * Load configuration from package.json
   * Returns defaults if package.json doesn't exist
   */
  async loadConfig(): Promise<PackageConfig> {
    try {
      const content = await fs.readFile(this.packageJsonPath, "utf-8");
      let packageJson: any;

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
          path: this.packageJsonPath,
        },
      };
    } catch (error: any) {
      // Return defaults if file doesn't exist
      if (error.code === "ENOENT") {
        return this.getDefaultConfig();
      }

      // Handle permission errors
      if (error.code === "EACCES") {
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
  private validateAndExtractSkills(packageJson: any): Record<string, string> {
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
    for (const [key, value] of Object.entries(agentskills)) {
      if (typeof value !== "string") {
        throw new Error("agentskills values must be strings");
      }
    }

    return agentskills;
  }

  /**
   * Validate and extract config from package.json
   */
  private validateAndExtractConfig(packageJson: any): PackageConfig["config"] {
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

    // Start with defaults and merge
    const config = { ...defaultConfig };

    // Validate and merge skillsDirectory
    if (agentskillsConfig.skillsDirectory !== undefined) {
      if (typeof agentskillsConfig.skillsDirectory !== "string") {
        throw new Error("skillsDirectory must be a string");
      }
      if (agentskillsConfig.skillsDirectory === "") {
        throw new Error("skillsDirectory cannot be empty");
      }
      config.skillsDirectory = agentskillsConfig.skillsDirectory;
    }

    // Validate and merge autoDiscover
    if (agentskillsConfig.autoDiscover !== undefined) {
      if (!Array.isArray(agentskillsConfig.autoDiscover)) {
        throw new Error("autoDiscover must be an array");
      }
      for (const item of agentskillsConfig.autoDiscover) {
        if (typeof item !== "string") {
          throw new Error("autoDiscover must contain only strings");
        }
      }
      config.autoDiscover = agentskillsConfig.autoDiscover;
    }

    // Validate and merge maxSkillSize
    if (agentskillsConfig.maxSkillSize !== undefined) {
      if (typeof agentskillsConfig.maxSkillSize !== "number") {
        throw new Error("maxSkillSize must be a number");
      }
      if (agentskillsConfig.maxSkillSize <= 0) {
        throw new Error("maxSkillSize must be a positive number");
      }
      config.maxSkillSize = agentskillsConfig.maxSkillSize;
    }

    // Validate and merge logLevel
    if (agentskillsConfig.logLevel !== undefined) {
      if (typeof agentskillsConfig.logLevel !== "string") {
        throw new Error("logLevel must be a string");
      }
      const validLogLevels = ["error", "warn", "info", "debug"];
      if (!validLogLevels.includes(agentskillsConfig.logLevel)) {
        throw new Error(
          `Invalid logLevel '${agentskillsConfig.logLevel}'. Must be one of: error, warn, info, debug`
        );
      }
      config.logLevel = agentskillsConfig.logLevel;
    }

    return config;
  }

  /**
   * Save skills to package.json
   * Creates package.json if it doesn't exist
   * Preserves other fields
   */
  async saveSkills(skills: Record<string, string>): Promise<void> {
    let packageJson: any;

    try {
      const content = await fs.readFile(this.packageJsonPath, "utf-8");
      packageJson = JSON.parse(content);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // Create minimal package.json
        packageJson = {
          name: "agentskills-project",
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

    let packageJson: any;

    try {
      const content = await fs.readFile(this.packageJsonPath, "utf-8");
      packageJson = JSON.parse(content);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // Create minimal package.json
        packageJson = {
          name: "agentskills-project",
        };
      } else {
        throw error;
      }
    }

    // Initialize agentskills if it doesn't exist
    if (!packageJson.agentskills) {
      packageJson.agentskills = {};
    }

    // Add or update skill
    packageJson.agentskills[name] = spec;

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
    } catch (error: any) {
      // If file doesn't exist, nothing to remove
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}
