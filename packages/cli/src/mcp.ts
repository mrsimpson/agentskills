import { homedir } from 'os';
import type { AgentType } from './types.ts';
import { configureAgentMcp } from './mcp-configurator.ts';
import { agents, detectInstalledAgents } from './agents.ts';
import { multiselect, select, cancel } from '@clack/prompts';

/**
 * Options parsed from mcp setup command
 */
export interface McpSetupOptions {
  mode: 'tui' | 'cli';
  agents: AgentType[];
  cwd?: string;
  scope?: 'local' | 'global'; // 'local' = project, 'global' = home directory
}

/**
 * Parse mcp setup command arguments
 * Reuses the --agent flag pattern from add.ts
 * @param args Command arguments (e.g., ['setup', '--agent', 'claude-code', '--global'])
 * @returns Parsed options with mode, agents, and scope
 */
export function parseMcpOptions(args: string[]): McpSetupOptions {
  const agents: AgentType[] = [];
  let scope: 'local' | 'global' = 'local'; // Default to local (project)

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
    } else if (arg === '-g' || arg === '--global') {
      // Set scope to global (home directory)
      scope = 'global';
    }
    // Ignore other flags
  }

  const mode = agents.length > 0 ? 'cli' : 'tui';

  return {
    mode,
    agents,
    scope,
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
  const scope = options.scope || 'local';
  const configCwd = scope === 'global' ? homedir() : cwd;

  if (options.mode === 'tui') {
    await setupTuiMode(configCwd, scope);
  } else {
    await setupCliMode(options.agents, configCwd, scope);
  }
}

/**
 * TUI mode - interactive agent selection and scope selection
 * @param cwd Current working directory (or home directory if global)
 * @param scope 'local' for project, 'global' for home directory (can be overridden by TUI selection)
 */
async function setupTuiMode(cwd: string, scope: 'local' | 'global' = 'local'): Promise<void> {
  // Detect installed agents
  const installedAgents = await detectInstalledAgents();

  if (installedAgents.length === 0) {
    console.log('No supported agents detected. Please install an agent first.');
    return;
  }

  // First, ask user to choose configuration scope
  const selectedScope = await select({
    message: 'Where should MCP configs be stored?',
    options: [
      {
        value: 'local',
        label: 'Local (Project directory) - shared via Git',
      },
      {
        value: 'global',
        label: 'Global (Home directory) - personal settings only',
      },
    ],
  });

  // Handle cancellation
  if (typeof selectedScope === 'symbol') {
    cancel('Operation cancelled');
    return;
  }

  scope = selectedScope as 'local' | 'global';
  const home = homedir();
  const configCwd = scope === 'global' ? home : cwd;

  // Show interactive multi-select prompt for agents using @clack/prompts
  const selectedAgents = await multiselect({
    message: 'Select agents to configure for MCP:',
    options: installedAgents.map((agentType) => ({
      value: agentType as any,
      label: agents[agentType]?.displayName || agentType,
    })),
  });

  // Handle cancellation
  if (typeof selectedAgents === 'symbol') {
    cancel('Operation cancelled');
    return;
  }

  if (!selectedAgents || selectedAgents.length === 0) {
    console.log('No agents selected.');
    return;
  }

  // Configure selected agents
  let successCount = 0;
  let failureCount = 0;

  for (const agentType of selectedAgents) {
    try {
      await configureAgentMcp(agentType as AgentType, configCwd, scope);
      console.log(`✓ Configured ${agents[agentType as any]?.displayName || agentType}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to configure ${agentType}:`, (error as Error).message);
      failureCount++;
    }
  }

  // Show summary with scope information
  console.log('');
  const scopeLabel = scope === 'global' ? 'global (home directory)' : 'local (project directory)';
  if (successCount > 0) {
    console.log(`✓ Successfully configured ${successCount} agent(s) in ${scopeLabel}`);
  }
  if (failureCount > 0) {
    console.error(`✗ Failed to configure ${failureCount} agent(s) in ${scopeLabel}`);
  }
}

/**
 * CLI mode - configure specified agents
 * @param agentTypes List of agent types to configure
 * @param cwd Current working directory (or home directory if global)
 * @param scope 'local' for project, 'global' for home directory
 */
async function setupCliMode(
  agentTypes: AgentType[],
  cwd: string,
  scope: 'local' | 'global' = 'local'
): Promise<void> {
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
      await configureAgentMcp(agentType, cwd, scope);
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
