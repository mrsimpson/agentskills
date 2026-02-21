/**
 * MCP Configuration Manager
 *
 * Manages MCP server configurations across different MCP clients
 * (Claude Desktop, Cline, Continue, Cursor, Junie, Kiro, Zed)
 *
 * NOTE: MCP configs are now project-relative instead of home-directory based.
 * This allows for version control and team collaboration.
 */

import { promises as fs } from "fs";
import { join, dirname } from "path";
import type { McpClientType, McpConfig, McpServerConfig } from "./types.js";

/**
 * Manages MCP server configurations for different clients
 */
export class MCPConfigManager {
  /**
   * Gets the configuration file path for a specific MCP client
   * @param clientType - The MCP client type
   * @param projectRoot - Optional project root directory (defaults to process.cwd())
   * @returns Absolute path to the config file
   * @throws Error if client type is unknown
   */
  getConfigPath(clientType: McpClientType, projectRoot?: string): string {
    const baseDir = projectRoot || process.cwd();

    switch (clientType) {
      case "claude-desktop":
        return join(baseDir, ".claude/mcp_settings.json");
      case "cline":
        return join(baseDir, ".cline/mcp_settings.json");
      case "continue":
        return join(baseDir, ".continue/config.json");
      case "cursor":
        return join(baseDir, ".cursor/mcp_settings.json");
      case "junie":
        return join(baseDir, ".junie/mcp_settings.json");
      case "kiro":
        return join(baseDir, ".kiro/settings/mcp.json");
      case "zed":
        return join(baseDir, ".zed/mcp_settings.json");
      default:
        throw new Error(`Unknown client type: ${clientType}`);
    }
  }

  /**
   * Reads the MCP configuration from a client's config file
   * @param clientType - The MCP client type
   * @param projectRoot - Optional project root directory (defaults to process.cwd())
   * @returns The parsed MCP configuration
   * @throws Error if the file contains invalid JSON
   */
  async readConfig(
    clientType: McpClientType,
    projectRoot?: string
  ): Promise<McpConfig> {
    const configPath = this.getConfigPath(clientType, projectRoot);

    try {
      const content = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(content);

      // Ensure mcpServers exists
      if (!config.mcpServers) {
        config.mcpServers = {};
      }

      return config as McpConfig;
    } catch (error) {
      // If file doesn't exist, return empty config
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { mcpServers: {} };
      }

      // Re-throw other errors (like JSON parse errors)
      throw error;
    }
  }

  /**
   * Checks if a specific MCP server is configured in the client
   * @param clientType - The MCP client type
   * @param serverName - The server name to check
   * @param projectRoot - Optional project root directory (defaults to process.cwd())
   * @returns True if the server is configured
   */
  async isServerConfigured(
    clientType: McpClientType,
    serverName: string,
    projectRoot?: string
  ): Promise<boolean> {
    try {
      const config = await this.readConfig(clientType, projectRoot);
      return serverName in config.mcpServers;
    } catch {
      return false;
    }
  }

  /**
   * Adds a new MCP server to the client configuration
   * @param clientType - The MCP client type
   * @param serverName - The server name
   * @param config - The server configuration
   * @param projectRoot - Optional project root directory (defaults to process.cwd())
   * @throws Error if the server already exists
   */
  async addServer(
    clientType: McpClientType,
    serverName: string,
    config: McpServerConfig,
    projectRoot?: string
  ): Promise<void> {
    const configPath = this.getConfigPath(clientType, projectRoot);

    // Read existing config
    const existingConfig = await this.readConfig(clientType, projectRoot);

    // Check for duplicate
    if (serverName in existingConfig.mcpServers) {
      throw new Error(`Server ${serverName} already exists in configuration`);
    }

    // Add new server
    existingConfig.mcpServers[serverName] = config;

    // Write back to file
    await this.writeConfig(configPath, existingConfig);
  }

  /**
   * Removes an MCP server from the client configuration
   * @param clientType - The MCP client type
   * @param serverName - The server name to remove
   * @param projectRoot - Optional project root directory (defaults to process.cwd())
   * @throws Error if the server doesn't exist or config file doesn't exist
   */
  async removeServer(
    clientType: McpClientType,
    serverName: string,
    projectRoot?: string
  ): Promise<void> {
    const configPath = this.getConfigPath(clientType, projectRoot);

    // Read existing config (will throw if file doesn't exist)
    const existingConfig = await this.readConfig(clientType, projectRoot);

    // Check if server exists
    if (!(serverName in existingConfig.mcpServers)) {
      throw new Error(`Server ${serverName} not found in configuration`);
    }

    // Remove server
    delete existingConfig.mcpServers[serverName];

    // Write back to file
    await this.writeConfig(configPath, existingConfig);
  }

  /**
   * Writes configuration to file with proper formatting
   * Creates parent directories if they don't exist
   */
  private async writeConfig(
    configPath: string,
    config: McpConfig
  ): Promise<void> {
    // Ensure directory exists
    const dir = dirname(configPath);
    await fs.mkdir(dir, { recursive: true });

    // Write with proper formatting (2 spaces, newline at end)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }
}
