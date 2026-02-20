/**
 * ConfigManager - Load and validate Agent Skills configuration
 * 
 * Handles loading configuration from YAML/JSON files with auto-discovery,
 * validation, and path resolution.
 */

import { promises as fs } from "fs";
import { homedir } from "os";
import { resolve, dirname, isAbsolute } from "path";
import { load as yamlLoad } from "js-yaml";
import type { Config, SkillSource, ConfigSettings } from "./types";

/**
 * Get the default configuration
 * Used when no config file is found
 */
export function getDefaultConfig(): Config {
  return {
    version: "1.0",
    sources: [
      { type: "local_directory", path: ".claude/skills/", priority: 1 },
      { type: "local_directory", path: "~/.claude/skills/", priority: 2 },
    ],
    settings: {
      maxSkillSize: 5000,
      logLevel: "info",
    },
  };
}

/**
 * Load configuration from file or auto-discover
 * 
 * @param configPath - Optional explicit path to config file
 * @returns Parsed and validated configuration
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  let effectiveConfigPath: string | null = null;
  let configDir: string;

  if (configPath) {
    // Explicit path provided
    effectiveConfigPath = configPath;
    configDir = dirname(configPath);
  } else {
    // Auto-discover config file
    effectiveConfigPath = await discoverConfigFile();
    if (effectiveConfigPath) {
      configDir = dirname(effectiveConfigPath);
    } else {
      // No config file found, return defaults
      return getDefaultConfig();
    }
  }

  // Read and parse the config file
  const content = await fs.readFile(effectiveConfigPath, "utf-8");
  const parsed = parseConfigFile(effectiveConfigPath, content);

  // Validate the config
  validateConfig(parsed);

  // Resolve paths relative to config file location
  const config = resolveConfigPaths(parsed, configDir);

  return config;
}

/**
 * Discover config file with precedence
 * Returns null if no config file found
 */
async function discoverConfigFile(): Promise<string | null> {
  const cwd = process.cwd();
  const home = homedir();

  // Precedence order:
  // 1. .agentskills/config.yaml (current dir)
  // 2. .agentskills/config.json (current dir)
  // 3. ~/.agentskills/config.yaml (home dir)
  // 4. ~/.agentskills/config.json (home dir)

  const searchPaths = [
    resolve(cwd, ".agentskills", "config.yaml"),
    resolve(cwd, ".agentskills", "config.json"),
    resolve(home, ".agentskills", "config.yaml"),
    resolve(home, ".agentskills", "config.json"),
  ];

  for (const path of searchPaths) {
    try {
      await fs.access(path);
      return path;
    } catch {
      // File doesn't exist, continue
    }
  }

  return null;
}

/**
 * Parse config file based on extension
 */
function parseConfigFile(filePath: string, content: string): unknown {
  const ext = filePath.toLowerCase();

  if (ext.endsWith(".yaml") || ext.endsWith(".yml")) {
    try {
      return yamlLoad(content);
    } catch (error) {
      throw new Error(`Failed to parse YAML config: ${(error as Error).message}`);
    }
  } else if (ext.endsWith(".json")) {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse JSON config: ${(error as Error).message}`);
    }
  } else {
    throw new Error(`Unsupported config file format: ${filePath}`);
  }
}

/**
 * Validate config structure and types
 */
function validateConfig(config: unknown): asserts config is Config {
  if (!config || typeof config !== "object") {
    throw new Error("Config must be an object");
  }

  const cfg = config as Record<string, unknown>;

  // Validate version (required string)
  if (!cfg.version) {
    throw new Error("Config validation failed: version field is required");
  }
  if (typeof cfg.version !== "string") {
    throw new Error("Config validation failed: version must be a string");
  }

  // Validate sources (required non-empty array)
  if (!cfg.sources) {
    throw new Error("Config validation failed: sources field is required");
  }
  if (!Array.isArray(cfg.sources)) {
    throw new Error("Config validation failed: sources must be an array");
  }
  if (cfg.sources.length === 0) {
    throw new Error("Config validation failed: sources array cannot be empty");
  }

  // Validate each source
  for (const source of cfg.sources) {
    validateSource(source);
  }

  // Validate settings (optional object)
  if (cfg.settings !== undefined) {
    if (typeof cfg.settings !== "object" || cfg.settings === null || Array.isArray(cfg.settings)) {
      throw new Error("Config validation failed: settings must be an object");
    }

    const settings = cfg.settings as Record<string, unknown>;

    // Validate maxSkillSize if present
    if (settings.maxSkillSize !== undefined) {
      if (typeof settings.maxSkillSize !== "number") {
        throw new Error("Config validation failed: maxSkillSize must be a number");
      }
    }

    // Validate logLevel if present
    if (settings.logLevel !== undefined) {
      const validLevels = ["error", "warn", "info", "debug"];
      if (!validLevels.includes(settings.logLevel as string)) {
        throw new Error(
          `Config validation failed: logLevel must be one of: ${validLevels.join(", ")}`
        );
      }
    }
  }
}

/**
 * Validate a single source object
 */
function validateSource(source: unknown): asserts source is SkillSource {
  if (!source || typeof source !== "object") {
    throw new Error("Config validation failed: each source must be an object");
  }

  const src = source as Record<string, unknown>;

  // Validate type
  if (!src.type) {
    throw new Error("Config validation failed: source type is required");
  }
  if (src.type !== "local_directory") {
    throw new Error(
      `Config validation failed: invalid source type '${src.type}', only 'local_directory' is supported`
    );
  }

  // Validate path
  if (!src.path) {
    throw new Error("Config validation failed: source path is required");
  }
  if (typeof src.path !== "string") {
    throw new Error("Config validation failed: source path must be a string");
  }

  // Validate priority (optional number)
  if (src.priority !== undefined && typeof src.priority !== "number") {
    throw new Error("Config validation failed: source priority must be a number");
  }
}

/**
 * Resolve paths in config
 * - Expand ~ to home directory
 * - Resolve explicit relative paths (./ or ../) relative to config file location
 * - Keep absolute paths unchanged
 * - Keep non-explicit relative paths (like .claude/skills) unchanged
 */
function resolveConfigPaths(config: Config, configDir: string): Config {
  const home = homedir();

  const resolvedSources = config.sources.map((source) => {
    let resolvedPath = source.path;

    // Expand tilde
    if (resolvedPath.startsWith("~/")) {
      resolvedPath = resolve(home, resolvedPath.slice(2));
    } else if (resolvedPath === "~") {
      resolvedPath = home;
    }
    // Resolve explicit relative paths (starting with ./ or ../)
    else if (resolvedPath.startsWith("./") || resolvedPath.startsWith("../")) {
      resolvedPath = resolve(configDir, resolvedPath);
    }
    // Keep absolute paths and non-explicit relative paths unchanged

    return {
      ...source,
      path: resolvedPath,
    };
  });

  // Ensure settings is defined (use defaults if missing)
  const settings: ConfigSettings = config.settings || {};
  if (settings.maxSkillSize === undefined) {
    settings.maxSkillSize = 5000;
  }
  if (settings.logLevel === undefined) {
    settings.logLevel = "info";
  }

  return {
    ...config,
    sources: resolvedSources,
    settings,
  };
}

/**
 * ConfigManager singleton for backwards compatibility
 */
export const ConfigManager = {
  loadConfig,
  getDefaultConfig,
};
