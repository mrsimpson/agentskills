/**
 * MCPServer - Core MCP server implementation for Agent Skills
 * 
 * This class implements the Model Context Protocol (MCP) server that exposes
 * Agent Skills as tools and resources. It uses the @modelcontextprotocol/sdk
 * with stdio transport for communication with MCP clients.
 * 
 * Architecture:
 * - Uses McpServer from @modelcontextprotocol/sdk for MCP protocol handling
 * - Integrates with SkillRegistry from @agentskills/core for skill management
 * - Announces capabilities: tools and resources
 * - Routes requests to appropriate handlers
 * - Provides lifecycle management (start/stop)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SkillRegistry } from "@agentskills/core";
import { existsSync, statSync } from "fs";

/**
 * Options for initializing MCPServer
 */
export interface MCPServerOptions {
  /**
   * Pre-initialized SkillRegistry instance
   */
  registry?: SkillRegistry;
  
  /**
   * Path to skills directory (will create registry internally)
   */
  skillsDir?: string;
}

/**
 * MCPServer - Main server class for Agent Skills MCP integration
 * 
 * Features:
 * - Accepts SkillRegistry or skillsDir in constructor
 * - Announces tools and resources capabilities
 * - Provides start() and stop() lifecycle methods
 * - Routes tools/list, tools/call, resources/list, resources/read requests
 * - Error handling without crashes
 */
export class MCPServer {
  private mcpServer: McpServer;
  private registry: SkillRegistry;
  private transport?: StdioServerTransport;
  private isStarted: boolean = false;

  /**
   * Creates a new MCPServer instance
   * 
   * @param options - Configuration options
   * @throws Error if neither registry nor skillsDir is provided
   * @throws Error if skillsDir doesn't exist
   */
  constructor(options: MCPServerOptions) {
    // Validate options
    if (!options.registry && !options.skillsDir) {
      throw new Error("Either registry or skillsDir must be provided");
    }

    // Initialize or use provided registry
    if (options.registry) {
      this.registry = options.registry;
    } else {
      // Validate skills directory exists
      if (!existsSync(options.skillsDir!)) {
        throw new Error(`Skills directory does not exist: ${options.skillsDir}`);
      }
      
      // Verify it's a directory
      const stat = statSync(options.skillsDir!);
      if (!stat.isDirectory()) {
        throw new Error(`Skills directory is not a directory: ${options.skillsDir}`);
      }

      // Create new registry (will be loaded on start)
      this.registry = new SkillRegistry();
    }

    // Initialize MCP server with capabilities
    this.mcpServer = new McpServer(
      {
        name: "agent-skills-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Register handlers (stubs for now - full implementation in tasks 1.4.11 and 1.4.12)
    this.registerHandlers();
  }

  /**
   * Register MCP request handlers
   * 
   * This is a stub implementation. Full tool and resource handlers
   * will be implemented in tasks 1.4.11 and 1.4.12.
   */
  private registerHandlers(): void {
    // Tool handlers will be implemented in task 1.4.11
    // For now, we'll keep it simple - McpServer handles tools/list internally
    // based on registered tools
    
    // We'll register a dummy handler to show the pattern
    // Full implementation will come in task 1.4.11
  }

  /**
   * Get server capabilities
   * 
   * @returns Server capabilities object
   */
  getCapabilities(): { tools?: object; resources?: object } {
    return {
      tools: {},
      resources: {},
    };
  }

  /**
   * Get list of available tools
   * 
   * Stub implementation - will be fully implemented in task 1.4.11
   * 
   * @returns Array of tool definitions
   */
  getTools(): unknown[] {
    // Stub: return empty array
    // Full implementation in task 1.4.11 will return skills as tools
    return [];
  }

  /**
   * Call a tool
   * 
   * Stub implementation - will be fully implemented in task 1.4.11
   * 
   * @param toolName - Name of the tool to call
   * @param args - Arguments for the tool
   * @returns Tool execution result
   */
  async callTool(toolName: string, args: unknown[]): Promise<unknown> {
    // Stub: return error for non-existent skills
    try {
      const skill = this.registry.getSkill(toolName);
      if (!skill) {
        return {
          isError: true,
          error: `Skill not found: ${toolName}`,
        };
      }
      
      // Stub: return success
      return {
        content: "Stub implementation - full tool execution in task 1.4.11",
      };
    } catch (error) {
      return {
        isError: true,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get list of available resources
   * 
   * Stub implementation - will be fully implemented in task 1.4.12
   * 
   * @returns Array of resource definitions
   */
  getResources(): unknown[] {
    // Stub: return empty array
    // Full implementation in task 1.4.12 will return skill resources
    return [];
  }

  /**
   * Read a resource
   * 
   * Stub implementation - will be fully implemented in task 1.4.12
   * 
   * @param uri - Resource URI
   * @returns Resource content
   */
  async readResource(uri: string): Promise<unknown> {
    // Stub: return success
    try {
      return {
        uri,
        content: "Stub implementation - full resource reading in task 1.4.12",
      };
    } catch (error) {
      return {
        isError: true,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Start the MCP server
   * 
   * Initializes transport and begins listening for MCP protocol messages
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return; // Already started, nothing to do
    }

    try {
      // Create stdio transport
      this.transport = new StdioServerTransport();
      
      // Connect MCP server to transport
      await this.mcpServer.connect(this.transport);
      
      this.isStarted = true;
    } catch (error) {
      throw new Error(
        `Failed to start MCP server: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Stop the MCP server
   * 
   * Closes the transport and cleans up resources
   * Safe to call multiple times
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return; // Not started, nothing to do
    }

    try {
      // Close the MCP server connection
      await this.mcpServer.close();
      
      this.transport = undefined;
      this.isStarted = false;
    } catch (error) {
      // Log error but don't throw - stop should be idempotent
      console.error("Error stopping MCP server:", error);
    }
  }
}
