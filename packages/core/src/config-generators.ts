/**
 * Configuration Generator Registry Pattern
 *
 * Provides extensible support for generating agent-specific MCP configurations
 * across different AI coding assistant platforms (GitHub Copilot, Kiro, OpenCode, etc.)
 */

/**
 * Supported MCP server types for agent configuration
 */
export type McpServerType = "stdio" | "http" | "sse";

/**
 * Configuration for an MCP server within a skills agent
 */
export interface SkillsMcpServerConfig {
  type?: McpServerType;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  tools?: string[];
}

/**
 * Permission level for tools
 */
export type ToolPermission = "allow" | "ask" | "deny";

/**
 * Tool permission configuration
 * Can be simple (all tools have same permission) or complex (per-command rules)
 */
export type ToolPermissions = Record<
  string,
  ToolPermission | Record<string, ToolPermission>
>;

/**
 * Base skills-MCP agent configuration
 * This is the input format passed to generators
 */
export interface SkillsMcpAgentConfig {
  id: string;
  description: string;
  mcp_servers?: Record<string, SkillsMcpServerConfig>;
  tools?: Record<string, boolean>;
  permissions?: ToolPermissions;
  model?: string;
  temperature?: number;
}

// Re-export Zod schemas for validation if needed (imported elsewhere)
// but they're optional - these are primarily type definitions

/**
 * Options passed to generators for context
 */
export interface GeneratorOptions {
  /** Base directory for agent config files */
  skillsDir: string;
  /** Agent ID (usually 'skills-mcp') */
  agentId: string;
  /** Scope: 'local' (project) or 'global' (home) */
  scope: "local" | "global";
  /** Whether this is for a project or global config */
  isGlobal: boolean;
}

/**
 * Generated configuration file(s)
 */
export interface GeneratedConfig {
  /** File path(s) to write */
  filePath: string | string[];
  /** Content to write (string or object for JSON) */
  content: string | Record<string, unknown>;
  /** Format hint: 'json', 'yaml', 'markdown', 'plaintext' */
  format: "json" | "yaml" | "markdown" | "plaintext";
  /** Optional: multiple files to write */
  files?: Array<{ path: string; content: string | Record<string, unknown> }>;
}

/**
 * Metadata about a generator
 */
export interface GeneratorMetadata {
  /** Display name */
  name: string;
  /** Description of what this generator does */
  description: string;
  /** Supported agent types */
  agentTypes: string[];
  /** URL to documentation */
  docsUrl?: string;
  /** Version of the generator */
  version: string;
}

/**
 * Base interface for config generators
 * Each client/platform implements this to generate their specific agent format
 *
 * ## Filesystem contract
 *
 * Generators MUST only return paths to specific named files.
 * They MUST NOT return paths to existing directories, and the caller
 * MUST NOT delete or clear any directory before or after writing.
 * Each generator owns exactly the file(s) it declares — nothing else.
 */
export interface ConfigGenerator {
  /**
   * Agent type(s) this generator supports
   * e.g., 'github-copilot', 'copilot-cli', 'copilot-coding-agent'
   */
  readonly agentTypes: string[];

  /**
   * Generate agent-specific config from SkillsMcpAgent.
   *
   * The returned `filePath` / `files[].path` MUST be a path to a specific
   * named file, never a directory. The caller will validate this and throw
   * if a directory path is returned.
   *
   * @param config Base skills-MCP agent config
   * @param options Metadata for generation
   * @returns Generated config (file contents, usually as string)
   */
  generate(
    config: SkillsMcpAgentConfig,
    options: GeneratorOptions
  ): Promise<GeneratedConfig>;

  /**
   * Validate if the generator can handle the given agent type
   */
  supports(agentType: string): boolean;

  /**
   * Get the output file path(s) for this agent config
   */
  getOutputPath(skillsDir: string, agentId: string): string | string[];

  /**
   * Get metadata about this generator
   */
  getMetadata(): GeneratorMetadata;
}

/**
 * Registry for config generators
 */
export class ConfigGeneratorRegistry {
  private generators: Map<string, ConfigGenerator> = new Map();

  /**
   * Register a config generator
   */
  register(generator: ConfigGenerator): void {
    for (const agentType of generator.agentTypes) {
      this.generators.set(agentType, generator);
    }
  }

  /**
   * Get a generator for an agent type
   */
  getGenerator(agentType: string): ConfigGenerator | undefined {
    return this.generators.get(agentType);
  }

  /**
   * Generate config for an agent
   */
  async generate(
    agentType: string,
    config: SkillsMcpAgentConfig,
    options: GeneratorOptions
  ): Promise<GeneratedConfig | null> {
    const generator = this.getGenerator(agentType);
    if (!generator) return null;
    return generator.generate(config, options);
  }

  /**
   * List all registered generators
   */
  listGenerators(): GeneratorMetadata[] {
    const seen = new Set<string>();
    const result: GeneratorMetadata[] = [];

    for (const generator of this.generators.values()) {
      const name = generator.getMetadata().name;
      if (!seen.has(name)) {
        result.push(generator.getMetadata());
        seen.add(name);
      }
    }

    return result;
  }

  /**
   * Check if any generator supports an agent type
   */
  supports(agentType: string): boolean {
    return this.generators.has(agentType);
  }

  /**
   * Get all supported agent types
   */
  getSupportedAgentTypes(): string[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Clear all generators (mainly for testing)
   */
  clear(): void {
    this.generators.clear();
  }
}
