import envPaths from "env-paths";
import { join } from "path";
import { homedir } from "os";

/**
 * Configuration directory paths for agentskills-mcp.
 *
 * Uses platform-specific configuration directories:
 * - Linux: ~/.config/agentskills-mcp
 * - macOS: ~/.config/agentskills-mcp (CLI-style for consistency)
 * - Windows: %APPDATA%\agentskills-mcp
 */

/**
 * Get the global configuration directory path.
 * This is where the global package.json will be stored.
 *
 * @returns The absolute path to the global config directory
 */
export function getGlobalConfigDir(): string {
  // Use XDG-style ~/.config on Unix-like systems (Linux & macOS) for consistency
  // Use %APPDATA% on Windows
  if (process.platform === "win32") {
    const paths = envPaths("agentskills-mcp", { suffix: "" });
    return paths.config;
  } else {
    // Unix-like: force ~/.config/agentskills-mcp for consistency
    const configHome =
      process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
    return join(configHome, "agentskills-mcp");
  }
}

/**
 * Get the full path to the global package.json file.
 *
 * @returns The absolute path to the global package.json
 */
export function getGlobalPackageJsonPath(): string {
  return join(getGlobalConfigDir(), "package.json");
}
