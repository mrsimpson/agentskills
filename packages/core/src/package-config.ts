import { promises as fs } from "fs";
import { join } from "path";
import type { PackageConfig, PackageConfigScope } from "./types.js";
import { getGlobalPackageJsonPath } from "./global-config-paths.js";

/**
 * PackageConfigManager - Manages package.json configuration for agent skills
 *
 * Responsibilities:
 * - Read package.json from local (project) or global (system) directory
 * - Parse `agentskills` field (skill dependencies)
 * - Parse `agentskillsConfig` field (configuration settings)
 * - Merge global and local configurations (with local taking precedence)
 * - Provide defaults when package.json doesn't exist
 * - Provide defaults when fields are missing
 * - Validate configuration structure
 * - Save/update skills in package.json
 *
 * @param projectRoot - The project root directory for local config
 * @param scope - The configuration scope: "local", "global", or "merged" (default: "merged")
 */
export class PackageConfigManager {
  private projectRoot: string;
  private packageJsonPath: string;
  private scope: PackageConfigScope;

  constructor(projectRoot: string, scope: PackageConfigScope = "merged") {
    if (!projectRoot) {
      throw new Error("Project root directory is required");
    }
    this.projectRoot = projectRoot;
    this.packageJsonPath = join(projectRoot, "package.json");
    this.scope = scope;
  }

  /**
   * Get the current configuration scope
   */
  getScope(): PackageConfigScope {
    return this.scope;
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
    return this.loadConfigFromPath(this.packageJsonPath);
  }

  /**
   * Load configuration from global package.json
   * Returns defaults if global package.json doesn't exist
   */
  async loadGlobalConfig(): Promise<PackageConfig> {
    const globalPath = getGlobalPackageJsonPath();
    return this.loadConfigFromPath(globalPath);
  }

  /**
   * Load and merge global and local configurations
   * Local configuration takes precedence over global at the field level
   * Returns merged config with source tracking both files
   */
  async loadMergedConfig(): Promise<PackageConfig> {
    const globalPath = getGlobalPackageJsonPath();
    const localPath = this.packageJsonPath;

    // Load raw package.json files without defaults
    const globalRaw = await this.loadRawPackageJson(globalPath);
    const localRaw = await this.loadRawPackageJson(localPath);

    // If both are null, return defaults
    if (!globalRaw && !localRaw) {
      return this.getDefaultConfig();
    }

    // Merge skills: local overrides global
    const globalSkills = globalRaw?.agentskills || {};
    const localSkills = localRaw?.agentskills || {};
    const mergedSkills = { ...globalSkills, ...localSkills };

    // Merge config at field level: local overrides global, then apply defaults
    const globalConfigRaw = (globalRaw?.agentskillsConfig || {}) as Record<
      string,
      unknown
    >;
    const localConfigRaw = (localRaw?.agentskillsConfig || {}) as Record<
      string,
      unknown
    >;
    const defaults = this.getDefaultConfig().config;

    const mergedConfig = {
      skillsDirectory:
        (localConfigRaw.skillsDirectory as string) ||
        (globalConfigRaw.skillsDirectory as string) ||
        defaults.skillsDirectory,
      autoDiscover:
        (localConfigRaw.autoDiscover as string[]) ||
        (globalConfigRaw.autoDiscover as string[]) ||
        defaults.autoDiscover,
      maxSkillSize:
        (localConfigRaw.maxSkillSize as number) ??
        (globalConfigRaw.maxSkillSize as number) ??
        defaults.maxSkillSize,
      logLevel:
        (localConfigRaw.logLevel as PackageConfig["config"]["logLevel"]) ||
        (globalConfigRaw.logLevel as PackageConfig["config"]["logLevel"]) ||
        defaults.logLevel
    };

    // Build source tracking
    const source: PackageConfig["source"] = {
      type: "merged",
      global: globalRaw ? globalPath : undefined,
      local: localRaw ? localPath : undefined
    };

    return {
      skills: mergedSkills,
      config: mergedConfig,
      source
    };
  }

  /**
   * Load raw package.json without validation or defaults
   * Returns null if file doesn't exist
   */
  private async loadRawPackageJson(
    packageJsonPath: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const content = await fs.readFile(packageJsonPath, "utf-8");
      return JSON.parse(content);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Load configuration from a specific package.json path
   * Returns defaults if the file doesn't exist
   */
  private async loadConfigFromPath(
    packageJsonPath: string
  ): Promise<PackageConfig> {
    try {
      const content = await fs.readFile(packageJsonPath, "utf-8");
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
          path: packageJsonPath
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
          `Permission denied reading package.json at ${packageJsonPath}`
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
   * Get the target path for write operations based on scope
   * - "local": writes to project package.json
   * - "global": writes to global package.json
   * - "merged": writes to project package.json (local takes precedence)
   */
  private getTargetPath(): string {
    if (this.scope === "global") {
      return getGlobalPackageJsonPath();
    }
    // For "local" and "merged", write to local project package.json
    return this.packageJsonPath;
  }

  /**
   * Ensure the directory for a package.json path exists
   */
  private async ensureDirectoryExists(packageJsonPath: string): Promise<void> {
    const dir = packageJsonPath.substring(0, packageJsonPath.lastIndexOf("/"));
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error: unknown) {
      // Ignore if directory already exists
      if ((error as { code?: string }).code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Save skills to package.json
   * Creates package.json if it doesn't exist
   * Preserves other fields
   * Respects the configured scope (local/global/merged)
   */
  async saveSkills(skills: Record<string, string>): Promise<void> {
    const targetPath = this.getTargetPath();
    await this.ensureDirectoryExists(targetPath);
    let packageJson: Record<string, unknown>;

    try {
      const content = await fs.readFile(targetPath, "utf-8");
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
      targetPath,
      JSON.stringify(packageJson, null, 2),
      "utf-8"
    );
  }

  /**
   * Add a single skill to package.json
   * Updates existing skill if name already exists
   * Respects the configured scope (local/global/merged)
   */
  async addSkill(name: string, spec: string): Promise<void> {
    if (!name) {
      throw new Error("Skill name cannot be empty");
    }
    if (!spec) {
      throw new Error("Skill spec cannot be empty");
    }

    const targetPath = this.getTargetPath();
    await this.ensureDirectoryExists(targetPath);
    let packageJson: Record<string, unknown>;

    try {
      const content = await fs.readFile(targetPath, "utf-8");
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
      targetPath,
      JSON.stringify(packageJson, null, 2),
      "utf-8"
    );
  }

  /**
   * Remove a skill from package.json
   * Does not error if skill doesn't exist or file doesn't exist
   * Respects the configured scope (local/global/merged)
   */
  async removeSkill(name: string): Promise<void> {
    if (!name) {
      throw new Error("Skill name cannot be empty");
    }

    const targetPath = this.getTargetPath();

    try {
      const content = await fs.readFile(targetPath, "utf-8");
      const packageJson = JSON.parse(content);

      // If agentskills doesn't exist, nothing to remove
      if (!packageJson.agentskills) {
        return;
      }

      // Remove skill
      delete packageJson.agentskills[name];

      // Write back to file with proper formatting
      await fs.writeFile(
        targetPath,
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
