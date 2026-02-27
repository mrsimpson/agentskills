export type AgentType =
  | 'amp'
  | 'antigravity'
  | 'augment'
  | 'claude-code'
  | 'openclaw'
  | 'cline'
  | 'codebuddy'
  | 'codex'
  | 'command-code'
  | 'continue'
  | 'cortex'
  | 'crush'
  | 'cursor'
  | 'droid'
  | 'gemini-cli'
  | 'github-copilot'
  | 'goose'
  | 'iflow-cli'
  | 'junie'
  | 'kilo'
  | 'kimi-cli'
  | 'kiro-cli'
  | 'kode'
  | 'mcpjam'
  | 'mistral-vibe'
  | 'mux'
  | 'neovate'
  | 'opencode'
  | 'openhands'
  | 'pi'
  | 'qoder'
  | 'qwen-code'
  | 'replit'
  | 'roo'
  | 'trae'
  | 'trae-cn'
  | 'windsurf'
  | 'zencoder'
  | 'pochi'
  | 'adal'
  | 'universal';

/** Definition of a {{PARAM_NAME}} placeholder in an MCP server dependency. */
export interface McpParameterSpec {
  description: string;
  required: boolean;
  default?: string;
  sensitive?: boolean;
}

/** An MCP server required by a skill (from requires-mcp-servers frontmatter). */
export interface McpServerDependency {
  name: string;
  package?: string;
  description: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  parameters?: Record<string, McpParameterSpec>;
}

export interface Skill {
  name: string;
  description: string;
  path: string;
  /** Raw SKILL.md content for hashing */
  rawContent?: string;
  /** Name of the plugin this skill belongs to (if any) */
  pluginName?: string;
  metadata?: Record<string, unknown>;
  /** MCP servers required by this skill (from requires-mcp-servers frontmatter). */
  requiresMcpServers?: McpServerDependency[];
}

/**
 * Metadata for agents that support a rich agent-config file
 * (beyond a plain mcp.json) via the ConfigGeneratorRegistry.
 */
export interface AgentConfigSupport {
  /**
   * Short hint shown after setup so the user knows how to activate the agent.
   * May be a CLI command string or a plain UI instruction.
   * e.g. "kiro chat --agent skills-mcp"
   */
  activationHint: string;
}

export interface AgentConfig {
  name: string;
  displayName: string;
  skillsDir: string;
  /** Global skills directory. Set to undefined if the agent doesn't support global installation. */
  globalSkillsDir: string | undefined;
  detectInstalled: () => Promise<boolean>;
  /** Whether to show this agent in the universal agents list. Defaults to true. */
  showInUniversalList?: boolean;
  /**
   * Present only for agents that support a structured agent-config file
   * (Kiro, GitHub Copilot, OpenCode). Absence means only mcp.json is supported.
   */
  agentConfigSupport?: AgentConfigSupport;
}

export interface ParsedSource {
  type: 'github' | 'gitlab' | 'git' | 'local' | 'direct-url' | 'well-known';
  url: string;
  subpath?: string;
  localPath?: string;
  ref?: string;
  /** Skill name extracted from @skill syntax (e.g., owner/repo@skill-name) */
  skillFilter?: string;
}

export interface MintlifySkill {
  name: string;
  description: string;
  content: string;
  mintlifySite: string;
  sourceUrl: string;
}

/**
 * Represents a skill fetched from a remote host provider.
 */
export interface RemoteSkill {
  /** Display name of the skill (from frontmatter) */
  name: string;
  /** Description of the skill (from frontmatter) */
  description: string;
  /** Full markdown content including frontmatter */
  content: string;
  /** The identifier used for installation directory name */
  installName: string;
  /** The original source URL */
  sourceUrl: string;
  /** The provider that fetched this skill */
  providerId: string;
  /** Source identifier for telemetry (e.g., "mintlify/bun.com") */
  sourceIdentifier: string;
  /** Any additional metadata from frontmatter */
  metadata?: Record<string, unknown>;
}
