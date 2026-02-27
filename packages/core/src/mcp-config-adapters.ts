/**
 * MCP Configuration Adapters
 *
 * Provides a registry pattern for handling different MCP client configuration formats.
 * Each client can have its own adapter that knows how to read/write its specific format.
 */

import type { McpConfig, McpServerConfig, McpClientType } from "./types.js";

/**
 * Interface for MCP configuration format adapters
 */
export interface McpConfigAdapter {
  /**
   * Converts client-specific config to standard McpConfig format
   */
  toStandard(clientConfig: unknown): McpConfig;

  /**
   * Converts standard McpConfig to client-specific format
   * @param mcpConfig - Standard format config
   * @param existingConfig - Existing client config to preserve other settings
   */
  toClient(mcpConfig: McpConfig, existingConfig?: unknown): unknown;
}

/**
 * Standard adapter for most MCP clients (Claude Desktop, Cline, Cursor, etc.)
 * These clients use the format: { mcpServers: { [name]: { command, args, env } } }
 */
export class StandardMcpConfigAdapter implements McpConfigAdapter {
  toStandard(clientConfig: unknown): McpConfig {
    const config = clientConfig as {
      mcpServers?: Record<string, McpServerConfig>;
    };

    // Ensure mcpServers exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    return config as McpConfig;
  }

  toClient(mcpConfig: McpConfig): unknown {
    return mcpConfig;
  }
}

/**
 * OpenCode adapter
 * OpenCode uses: { mcp: { [name]: { type, command, enabled, environment } } }
 */
export class OpenCodeConfigAdapter implements McpConfigAdapter {
  toStandard(clientConfig: unknown): McpConfig {
    const config = clientConfig as { mcp?: Record<string, unknown> };
    const mcpServers: Record<string, McpServerConfig> = {};

    if (config.mcp) {
      for (const [name, serverConfig] of Object.entries(config.mcp)) {
        const server = serverConfig as {
          type?: string;
          command?: string[];
          environment?: Record<string, string>;
        };

        if (server.type === "local" && server.command) {
          // Convert OpenCode format to standard format
          const [command, ...args] = server.command;
          mcpServers[name] = {
            command,
            args,
            env: server.environment || {}
          };
        }
        // Note: We only support local servers for agent-skills
        // Remote servers are not converted
      }
    }

    return { mcpServers };
  }

  toClient(mcpConfig: McpConfig, existingConfig?: unknown): unknown {
    const openCodeConfig = (existingConfig as {
      $schema?: string;
      permission?: Record<string, unknown>;
      mcp?: Record<string, unknown>;
      mcpServers?: Record<string, unknown>;
      [key: string]: unknown;
    }) || {
      $schema: "https://opencode.ai/config.json"
    };

    // Add permission to disable native skill tool
    // This prevents conflicts with our agentskills_use_skill MCP tool
    openCodeConfig.permission = {
      ...(openCodeConfig.permission || {}),
      skill: "deny"
    };

    // Replace the mcp section completely with the new config
    // This ensures removed servers are actually removed
    openCodeConfig.mcp = {};

    for (const [name, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
      openCodeConfig.mcp[name] = {
        type: "local",
        command: [serverConfig.command, ...(serverConfig.args || [])],
        enabled: true,
        environment: serverConfig.env || {}
      };
    }

    // Remove the old mcpServers key if it exists (it's OpenCode-incompatible)
    delete openCodeConfig.mcpServers;

    return openCodeConfig;
  }
}

/**
 * VS Code adapter for GitHub Copilot
 * VS Code uses: { servers: { [name]: { command, args, ... } } }
 */
export class VsCodeConfigAdapter implements McpConfigAdapter {
  toStandard(clientConfig: unknown): McpConfig {
    const config = clientConfig as {
      servers?: Record<string, McpServerConfig>;
    };

    // Convert "servers" key to standard "mcpServers" format
    const mcpServers = config.servers || {};

    return { mcpServers };
  }

  toClient(mcpConfig: McpConfig, existingConfig?: unknown): unknown {
    const vsCodeConfig = (existingConfig as {
      $schema?: string;
      [key: string]: unknown;
    }) || {
      $schema: "https://opencode.ai/config.json"
    };

    // VS Code expects the "servers" key, not "mcpServers"
    return {
      ...vsCodeConfig,
      servers: mcpConfig.mcpServers
    };
  }
}

/**
 * Registry for MCP configuration adapters
 */
export class McpConfigAdapterRegistry {
  private static adapters = new Map<McpClientType, McpConfigAdapter>();
  private static standardAdapter = new StandardMcpConfigAdapter();

  /**
   * Initialize the registry with default adapters
   */
  static initialize(): void {
    // OpenCode uses a different format
    this.register("opencode", new OpenCodeConfigAdapter());

    // GitHub Copilot/VS Code uses "servers" instead of "mcpServers"
    this.register("github-copilot", new VsCodeConfigAdapter());

    // All other clients use the standard format
    // (claude-desktop, cline, continue, cursor, junie, kiro, zed)
  }

  /**
   * Register a custom adapter for a client type
   */
  static register(clientType: McpClientType, adapter: McpConfigAdapter): void {
    this.adapters.set(clientType, adapter);
  }

  /**
   * Get the adapter for a client type
   * Returns standard adapter if no custom adapter is registered
   */
  static getAdapter(clientType: McpClientType): McpConfigAdapter {
    return this.adapters.get(clientType) || this.standardAdapter;
  }

  /**
   * Check if a client has a custom adapter
   */
  static hasCustomAdapter(clientType: McpClientType): boolean {
    return this.adapters.has(clientType);
  }
}

// Initialize the registry
McpConfigAdapterRegistry.initialize();
