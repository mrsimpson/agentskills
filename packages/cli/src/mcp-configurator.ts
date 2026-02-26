import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { AgentType } from './types.ts';
import type { McpConfig, McpServerConfig } from '@agent-skills/core';
import { McpConfigAdapterRegistry } from '@agent-skills/core';

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
 * @param cwd Current working directory
 * @returns The full path to the agent's MCP config file
 */
export function getAgentConfigPath(agentType: AgentType | string, cwd: string): string {
  const mappedType = AGENT_TO_MCP_CLIENT[agentType] || agentType;
  const home = homedir();

  switch (mappedType) {
    case 'claude-desktop':
      // Claude Desktop uses a file in the project directory
      return join(cwd, '.claude', 'claude_desktop_config.json');
    case 'cline':
      return join(cwd, '.cline', 'cline_mcp_config.json');
    case 'cursor':
      return join(cwd, '.cursor', 'mcp.json');
    case 'kiro':
      return join(cwd, '.kiro', 'kiro_config.json');
    case 'junie':
      return join(cwd, '.junie', 'junie_config.json');
    case 'opencode':
      return join(cwd, 'opencode.json');
    case 'zed':
      return join(home, '.config', 'zed', 'settings.json');
    case 'continue':
      return join(cwd, '.continue', 'config.json');
    // For other agents, use a generic config path
    default:
      // Try to infer from agent name if possible
      const sanitized = mappedType.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
      return join(cwd, `.${sanitized}`, `${sanitized}_config.json`);
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
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is unreadable - return empty config
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
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
 * @param cwd Current working directory
 */
export async function configureAgentMcp(agentType: AgentType | string, cwd: string): Promise<void> {
  // Validate agent type
  if (!agentType || typeof agentType !== 'string') {
    throw new Error(`Invalid agent type: ${agentType}`);
  }

  if (!AGENT_TO_MCP_CLIENT[agentType] && !isValidMcpClientType(agentType)) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  // Get config path for this agent
  const configPath = getAgentConfigPath(agentType, cwd);

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
