import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { AgentType } from './types.ts';
import type { McpConfig, McpServerConfig, SkillsMcpAgentConfig } from '@codemcp/agentskills-core';
import {
  McpConfigAdapterRegistry,
  ConfigGeneratorRegistry,
  GitHubCopilotGenerator,
  KiroGenerator,
  OpenCodeGenerator,
} from '@codemcp/agentskills-core';

/**
 * Type mapping from simplified agent names to MCP client types
 */
const AGENT_TO_MCP_CLIENT: Record<string, string> = {
  'claude-code': 'claude-desktop',
  claude: 'claude-desktop',
  cline: 'cline',
  cursor: 'cursor',
  'kiro-cli': 'kiro',
  kiro: 'kiro',
  junie: 'junie',
  opencode: 'opencode',
  zed: 'zed',
  continue: 'continue',
  'github-copilot': 'github-copilot',
  'mistral-vibe': 'mistral-vibe',
  windsurf: 'windsurf',
  codex: 'codex',
  'command-code': 'command-code',
  cortex: 'cortex',
  crush: 'crush',
  droid: 'droid',
  'gemini-cli': 'gemini-cli',
  goose: 'goose',
  'iflow-cli': 'iflow-cli',
  kilo: 'kilo',
  'kimi-cli': 'kimi-cli',
  kode: 'kode',
  mcpjam: 'mcpjam',
  mux: 'mux',
  neovate: 'neovate',
  openhands: 'openhands',
  pi: 'pi',
  qoder: 'qoder',
  'qwen-code': 'qwen-code',
  replit: 'replit',
  roo: 'roo',
  trae: 'trae',
  'trae-cn': 'trae-cn',
  zencoder: 'zencoder',
  pochi: 'pochi',
  adal: 'adal',
  universal: 'universal',
  amp: 'amp',
  antigravity: 'antigravity',
  augment: 'augment',
  openclaw: 'openclaw',
  codebuddy: 'codebuddy',
};

/**
 * Get the MCP configuration file path for an agent
 * @param agentType The agent type
 * @param cwd Current working directory (or home directory for global)
 * @param scope 'local' for project, 'global' for home directory
 * @returns The full path to the agent's MCP config file
 */
export function getAgentConfigPath(
  agentType: AgentType | string,
  cwd: string,
  scope: 'local' | 'global' = 'local'
): string {
  const mappedType = AGENT_TO_MCP_CLIENT[agentType] || agentType;
  // Note: cwd already contains the home directory if scope='global'

  switch (mappedType) {
    case 'claude-desktop':
      // Claude Desktop: store MCP config in project or home .claude/mcp.json
      return join(cwd, '.claude', 'mcp.json');
    case 'cline':
      // Cline: store in .cline/mcp.json
      return join(cwd, '.cline', 'mcp.json');
    case 'cursor':
      return join(cwd, '.cursor', 'mcp.json');
    case 'kiro':
      // Kiro: local .kiro/mcp.json | global ~/.kiro/agents/default.json
      if (scope === 'global') {
        return join(cwd, '.kiro', 'agents', 'default.json');
      }
      return join(cwd, '.kiro', 'mcp.json');
    case 'junie':
      // Junie: store in .junie/mcp.json
      return join(cwd, '.junie', 'mcp.json');
    case 'opencode':
      // OpenCode: local opencode.json | global ~/.config/opencode/opencode.json
      if (scope === 'global') {
        return join(cwd, '.config', 'opencode', 'opencode.json');
      }
      return join(cwd, 'opencode.json');
    case 'zed':
      return join(cwd, '.config', 'zed', 'settings.json');
    case 'continue':
      // Continue: store in .continue/config.json
      return join(cwd, '.continue', 'config.json');
    // For other agents, try to infer config path
    default:
      // Try to infer from agent name if possible
      const sanitized = mappedType.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
      return join(cwd, `.${sanitized}`, 'mcp.json');
  }
}

/**
 * Read an agent's MCP configuration file
 * @param configPath Path to the config file
 * @returns The parsed config object, or empty object if file doesn't exist
 */
export async function readAgentConfig(configPath: string): Promise<McpConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as McpConfig;
  } catch (error) {
    // File doesn't exist or is unreadable - return empty config
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { mcpServers: {} };
    }
    // Other errors (invalid JSON, permission denied, etc.) should be thrown
    throw error;
  }
}

/**
 * Write an agent's MCP configuration file
 * @param configPath Path to the config file
 * @param config The config object to write
 */
export async function writeAgentConfig(configPath: string, config: McpConfig): Promise<void> {
  const dir = dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Configure MCP server for an agent
 * @param agentType The agent type (e.g., 'claude-code', 'cline', 'cursor')
 * @param cwd Current working directory (or home directory if configuring globally)
 * @param scope 'local' for project, 'global' for home directory
 */
export async function configureAgentMcp(
  agentType: AgentType | string,
  cwd: string,
  scope: 'local' | 'global' = 'local'
): Promise<void> {
  // Validate agent type
  if (!agentType || typeof agentType !== 'string') {
    throw new Error(`Invalid agent type: ${agentType}`);
  }

  if (!AGENT_TO_MCP_CLIENT[agentType] && !isValidMcpClientType(agentType)) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  // Get config path for this agent
  const configPath = getAgentConfigPath(agentType, cwd, scope);

  // Read existing config
  let config = await readAgentConfig(configPath);

  // Ensure mcpServers exists (or use agent-specific format)
  const mappedType = AGENT_TO_MCP_CLIENT[agentType] || agentType;

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Define the MCP server config
  const mcpServerConfig: McpServerConfig = {
    command: 'npx',
    args: ['-y', '@codemcp/agentskills-mcp'],
  };

  // Update or add agentskills server
  config.mcpServers.agentskills = mcpServerConfig;

  // Write config using adapter if needed
  // For now, we write directly - adapters handle OpenCode format
  if (mappedType === 'opencode') {
    // OpenCode uses 'mcp' field instead of 'mcpServers'
    const openCodeConfig = {
      ...config,
      mcp: config.mcpServers,
    };
    delete (openCodeConfig as any).mcpServers;
    await writeAgentConfig(configPath, openCodeConfig as any);
  } else {
    await writeAgentConfig(configPath, config);
  }
}

/**
 * Check if a string is a valid MCP client type
 */
function isValidMcpClientType(type: string): boolean {
  const validTypes = [
    'claude-desktop',
    'cline',
    'cursor',
    'kiro',
    'junie',
    'opencode',
    'zed',
    'continue',
    'codium',
  ];
  return validTypes.includes(type);
}

/**
 * Generate skills-mcp agent configuration using the ConfigGeneratorRegistry
 * @param agentType The agent type
 * @param cwd Current working directory (or home directory for global)
 * @param scope 'local' for project, 'global' for home directory
 */
export async function generateSkillsMcpAgent(
  agentType: AgentType | string,
  cwd: string,
  scope: 'local' | 'global' = 'local'
): Promise<void> {
  // Initialize registry with generators
  const registry = new ConfigGeneratorRegistry();
  registry.register(new GitHubCopilotGenerator());
  registry.register(new KiroGenerator());
  registry.register(new OpenCodeGenerator());

  // Get the skills directory path
  const skillsDir = scope === 'global' ? homedir() : cwd;

  // Create base skills-mcp agent config
  const baseConfig: SkillsMcpAgentConfig = {
    id: 'skills-mcp',
    description: 'Agent-skills MCP server with use_skill tool access',
    mcp_servers: {
      'agent-skills': {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@codemcp/agentskills-mcp'],
        tools: ['*'],
      },
    },
    tools: {
      use_skill: true,
    },
    permissions: {
      use_skill: 'allow',
    },
  };

  // Get generator for this agent type
  const generator = registry.getGenerator(agentType as string);
  if (!generator) {
    throw new Error(
      `No config generator found for agent type: ${agentType}. Supported types: ${registry
        .getSupportedAgentTypes()
        .join(', ')}`
    );
  }

  // Generate config
  const generatedConfig = await generator.generate(baseConfig, {
    skillsDir,
    agentId: 'skills-mcp',
    scope,
    isGlobal: scope === 'global',
  });

  // Write config file(s)
  if (generatedConfig.files) {
    // Multiple files
    for (const file of generatedConfig.files) {
      const content =
        typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2);

      // Ensure directory exists
      const dir = dirname(file.path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file.path, content, 'utf-8');
    }
  } else {
    // Single file
    const content =
      typeof generatedConfig.content === 'string'
        ? generatedConfig.content
        : JSON.stringify(generatedConfig.content, null, 2);

    const filePath = generatedConfig.filePath as string;
    const dir = dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }
}
