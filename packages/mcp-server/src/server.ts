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
import { z } from "zod";

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
   * Note: Call start() to begin accepting MCP protocol messages.
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

    // Register handlers BEFORE connecting (required by SDK)
    this.registerHandlers();

    // Create stdio transport
    this.transport = new StdioServerTransport();
  }

  /**
   * Start the MCP server and begin accepting protocol messages
   * 
   * This connects the server to the stdio transport. The method returns
   * immediately after connection is established. The server will continue
   * running until stdin is closed.
   */
  async start(): Promise<void> {
    await this.mcpServer.connect(this.transport);
  }

  /**
   * Register MCP request handlers
   * 
   * Registers the use_skill tool for retrieving skill instructions.
   * Resource handlers will be implemented in task 1.4.12.
   */
  private registerHandlers(): void {
    // Get skill names for enum
    const skillNames = this.getSkillNames();
    
    // Register use_skill tool with Zod schema
    this.mcpServer.registerTool(
      "use_skill",
      {
        description: this.getToolDescription(),
        inputSchema: {
          skill_name: z.enum(skillNames.length > 0 ? (skillNames as [string, ...string[]]) : ["_no_skills_available"]).describe("Name of the skill to retrieve"),
          arguments: z.object({}).passthrough().optional().describe("Optional arguments for skill execution context"),
        },
      },
      async (args: Record<string, unknown>) => {
        return this.handleUseSkillTool(args);
      }
    );
  }

  /**
   * Get all skill names from the registry
   * 
   * @returns Array of skill names
   */
  private getSkillNames(): string[] {
    const metadata = this.registry.getAllMetadata();
    return metadata.map((m) => m.name);
  }

  /**
   * Get tool description with list of available skills
   * 
   * Generates a dynamic description that includes all loaded skills
   * with their descriptions for better discoverability.
   * 
   * @returns Tool description string with skill list
   */
  private getToolDescription(): string {
    const skills = this.registry.getAllMetadata();
    
    if (skills.length === 0) {
      return "Retrieve skill instructions and metadata for execution. No skills currently loaded.";
    }
    
    const skillList = skills
      .map(skill => `- ${skill.name}: ${skill.description}`)
      .join('\n');
    
    return `Retrieve skill instructions and metadata for execution.

Available skills:
${skillList}`;
  }

  /**
   * Handle use_skill tool execution
   * 
   * Retrieves skill instructions and metadata for the requested skill.
   * Returns skill data as JSON in MCP text content format.
   * 
   * @param args - Tool arguments with skill_name and optional arguments
   * @returns MCP tool result with skill data
   */
  private async handleUseSkillTool(
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    const skillName = args.skill_name as string;

    // Get skill from registry
    const skill = this.registry.getSkill(skillName);

    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    // Build skill data response
    const skillData = {
      name: skill.metadata.name,
      description: skill.metadata.description,
      body: skill.body,
      // Include optional metadata if present
      ...(skill.metadata.license && { license: skill.metadata.license }),
      ...(skill.metadata.compatibility && {
        compatibility: skill.metadata.compatibility,
      }),
      ...(skill.metadata.allowedTools && {
        allowedTools: skill.metadata.allowedTools,
      }),
      // Include Claude Code extensions if present
      ...(skill.metadata.disableModelInvocation !== undefined && {
        disableModelInvocation: skill.metadata.disableModelInvocation,
      }),
      ...(skill.metadata.userInvocable !== undefined && {
        userInvocable: skill.metadata.userInvocable,
      }),
      ...(skill.metadata.argumentHint && {
        argumentHint: skill.metadata.argumentHint,
      }),
      ...(skill.metadata.context && { context: skill.metadata.context }),
      ...(skill.metadata.agent && { agent: skill.metadata.agent }),
      ...(skill.metadata.model && { model: skill.metadata.model }),
      ...(skill.metadata.hooks && { hooks: skill.metadata.hooks }),
    };

    // Return as MCP text content
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(skillData, null, 2),
        },
      ],
    };
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
   * Returns the use_skill tool definition with dynamic skill enumeration.
   * 
   * @returns Array of tool definitions
   */
  getTools(): unknown[] {
    return [
      {
        name: "use_skill",
        description: this.getToolDescription(),
        inputSchema: {
          type: "object",
          properties: {
            skill_name: {
              type: "string",
              description: "Name of the skill to retrieve",
              enum: this.getSkillNames(),
            },
            arguments: {
              type: "object",
              description: "Optional arguments for skill execution context",
            },
          },
          required: ["skill_name"],
        },
      },
    ];
  }

  /**
   * Call a tool
   * 
   * Handles tool execution for use_skill tool.
   * 
   * @param toolName - Name of the tool to call
   * @param args - Arguments object for the tool
   * @returns Tool execution result
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    try {
      if (toolName === "use_skill") {
        return await this.handleUseSkillTool(args);
      }

      // Return error for unknown tools
      return {
        isError: true,
        error: `Unknown tool: ${toolName}`,
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
