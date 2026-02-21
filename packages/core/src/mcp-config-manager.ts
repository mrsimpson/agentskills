/**
 * MCP Configuration Manager
 *
 * Manages MCP server configurations across different MCP clients
 * (Claude Desktop, Cline, Continue, Cursor, Junie)
 */

import { promises as fs } from "fs";
import { join, dirname } from "path";
import * as os from "os";
import type { McpClientType, McpConfig, McpServerConfig } from "./types.js";

/**
 * Manages MCP server configurations for different clients
 */
export class MCPConfigManager {
  /**
   * Detects which MCP client is active based on environment variables
   * Returns null if no client is detected
   */
  detectClient(): McpClientType | null {
    // Priority order: claude-desktop, cline, continue, cursor, junie
    if (process.env.CLAUDE_DESKTOP) {
      return "claude-desktop";
    }
    if (process.env.CLINE_MCP) {
      return "cline";
    }
    if (process.env.CONTINUE_MCP) {
      return "continue";
    }
    if (process.env.CURSOR_MCP) {
      return "cursor";
    }
    if (process.env.JUNIE_MCP) {
      return "junie";
    }
    return null;
  }

  /**
   * Gets the configuration file path for a specific MCP client
   * @param clientType - The MCP client type
   * @returns Absolute path to the config file
   * @throws Error if client type is unknown or platform is unsupported for claude-desktop
   */
  getConfigPath(clientType: McpClientType): string {
    const home = os.homedir();

    switch (clientType) {
      case "claude-desktop":
        return this.getClaudeDesktopPath(home);
      case "cline":
        return join(home, ".cline/mcp_settings.json");
      case "continue":
        return join(home, ".continue/config.json");
      case "cursor":
        return join(home, ".cursor/mcp_settings.json");
      case "junie":
        return join(home, ".junie/mcp_settings.json");
      default:
        throw new Error(`Unknown client type: ${clientType}`);
    }
  }

  /**
   * Gets the Claude Desktop config path based on platform
   */
  private getClaudeDesktopPath(home: string): string {
    const platform = process.platform;

    switch (platform) {
      case "darwin":
        return join(
          home,
          "Library/Application Support/Claude/claude_desktop_config.json"
        );
      case "linux":
        return join(home, ".config/Claude/claude_desktop_config.json");
      case "win32": {
        const appData = process.env.APPDATA || join(home, "AppData/Roaming");
        return join(appData, "Claude/claude_desktop_config.json");
      }
      default:
        throw new Error(`Unsupported platform: ${platform} for claude-desktop`);
    }
  }

  /**
   * Reads the MCP configuration from a client's config file
   * @param clientType - The MCP client type
   * @returns The parsed MCP configuration
   * @throws Error if the file contains invalid JSON
   */
  async readConfig(clientType: McpClientType): Promise<McpConfig> {
    const configPath = this.getConfigPath(clientType);

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
   * @returns True if the server is configured
   */
  async isServerConfigured(
    clientType: McpClientType,
    serverName: string
  ): Promise<boolean> {
    try {
      const config = await this.readConfig(clientType);
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
   * @throws Error if the server already exists
   */
  async addServer(
    clientType: McpClientType,
    serverName: string,
    config: McpServerConfig
  ): Promise<void> {
    const configPath = this.getConfigPath(clientType);

    // Read existing config
    const existingConfig = await this.readConfig(clientType);

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
   * @throws Error if the server doesn't exist or config file doesn't exist
   */
  async removeServer(
    clientType: McpClientType,
    serverName: string
  ): Promise<void> {
    const configPath = this.getConfigPath(clientType);

    // Read existing config (will throw if file doesn't exist)
    const existingConfig = await this.readConfig(clientType);

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
