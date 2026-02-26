import type { AgentType } from './types.ts';
import { configureAgentMcp } from './mcp-configurator.ts';
import { agents, detectInstalledAgents } from './agents.ts';

/**
 * Options parsed from mcp setup command
 */
export interface McpSetupOptions {
  mode: 'tui' | 'cli';
  agents: AgentType[];
  cwd?: string;
}

/**
 * Parse mcp setup command arguments
 * Reuses the --agent flag pattern from add.ts
 * @param args Command arguments (e.g., ['setup', '--agent', 'claude-code', 'cline'])
 * @returns Parsed options with mode and agents
 */
export function parseMcpOptions(args: string[]): McpSetupOptions {
  const agents: AgentType[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-a' || arg === '--agent') {
      // Get agent values after --agent flag
      i++;
      let nextArg = args[i];
      while (i < args.length && nextArg && !nextArg.startsWith('-')) {
        agents.push(nextArg as AgentType);
        i++;
        nextArg = args[i];
      }
      i--; // Back up one since the loop will increment
    }
    // Ignore other flags
  }

  const mode = agents.length > 0 ? 'cli' : 'tui';

  return {
    mode,
    agents,
  };
}

/**
 * Run the MCP setup command
 * @param options Options from parseMcpOptions
 * @param cwd Current working directory (defaults to process.cwd())
 */
export async function runMcpSetup(
  options: McpSetupOptions,
  cwd: string = process.cwd()
): Promise<void> {
  if (options.mode === 'tui') {
    await setupTuiMode(cwd);
  } else {
    await setupCliMode(options.agents, cwd);
  }
}

/**
 * TUI mode - interactive agent selection
 * @param cwd Current working directory
 */
async function setupTuiMode(cwd: string): Promise<void> {
  // Detect installed agents
  const installedAgents = await detectInstalledAgents();

  if (installedAgents.length === 0) {
    console.log('No supported agents detected. Please install an agent first.');
    return;
  }

  // TODO: Show interactive multi-select prompt using @clack/prompts
  // For now, configure all detected agents
  for (const agentType of installedAgents) {
    try {
      await configureAgentMcp(agentType, cwd);
      console.log(`✓ Configured ${agents[agentType]?.displayName || agentType}`);
    } catch (error) {
      console.error(`✗ Failed to configure ${agentType}:`, (error as Error).message);
    }
  }
}

/**
 * CLI mode - configure specified agents
 * @param agentTypes List of agent types to configure
 * @param cwd Current working directory
 */
async function setupCliMode(agentTypes: AgentType[], cwd: string): Promise<void> {
  // Handle wildcard - configure all installed agents
  if (agentTypes.includes('*' as AgentType)) {
    const installedAgents = await detectInstalledAgents();
    agentTypes = installedAgents;
  }

  // Configure each agent
  let successCount = 0;
  let failureCount = 0;

  for (const agentType of agentTypes) {
    try {
      await configureAgentMcp(agentType, cwd);
      console.log(`✓ Configured ${agents[agentType]?.displayName || agentType}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to configure ${agentType}:`, (error as Error).message);
      failureCount++;
    }
  }

  // Show summary
  if (successCount > 0) {
    console.log(`\n✓ Successfully configured ${successCount} agent(s)`);
  }
  if (failureCount > 0) {
    console.error(`✗ Failed to configure ${failureCount} agent(s)`);
  }
}
