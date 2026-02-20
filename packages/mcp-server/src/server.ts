/**
 * MCPServer - Core MCP server implementation for Agent Skills
 * 
 * This class implements the Model Context Protocol (MCP) server that exposes
 * Agent Skills as tools and resources. It uses the @modelcontextprotocol/sdk
 * with stdio transport for communication with MCP clients.
 * 
 * Architecture:
 * - Uses McpServer from @modelcontextprotocol/sdk for MCP protocol handling
 * - Accepts SkillRegistry via dependency injection (separation of concerns)
 * - Announces capabilities: tools and resources
 * - Routes requests to appropriate handlers
 * - Server is immediately ready after construction (no explicit lifecycle)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SkillRegistry } from "@agentskills/core";

/**
 * MCPServer - Main server class for Agent Skills MCP integration
 * 
 * Features:
 * - Accepts SkillRegistry via dependency injection
 * - Announces tools and resources capabilities
 * - Server is "live" immediately upon construction
 * - Routes tools/list, tools/call, resources/list, resources/read requests
 * - Error handling without crashes
 */
export class MCPServer {
  private mcpServer: McpServer;
  private registry: SkillRegistry;
  private transport: StdioServerTransport;

  /**
   * Creates a new MCPServer instance
   * 
   * The server is immediately ready after construction. The stdio transport
   * lifecycle is synchronous - the process spawns, the server runs, and the
   * process exits. The SDK's connect() handles everything automatically.
   * 
   * @param registry - Pre-initialized SkillRegistry instance
   */
  constructor(registry: SkillRegistry) {
    this.registry = registry;

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

    // Create stdio transport
    this.transport = new StdioServerTransport();

    // Connect immediately - server is ready when constructor completes
    // The SDK handles the connection lifecycle automatically
    this.mcpServer.connect(this.transport).catch((error) => {
      // Log error but don't throw - the process will exit on stdio close
      console.error("Failed to connect MCP server:", error);
    });

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
}
