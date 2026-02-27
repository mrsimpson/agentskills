import { homedir } from 'os';
import type { AgentType } from './types.ts';
import {
  generateSkillsMcpAgent,
  configureAgentMcp,
  buildConfigGeneratorRegistry,
} from './mcp-configurator.ts';
import { agents, detectInstalledAgents } from './agents.ts';
import { multiselect, select, cancel } from '@clack/prompts';
import { loadInstalledSkillMcpDeps, configureSkillMcpDepsForAgents } from './mcp-skill-deps.ts';

/**
 * Options parsed from mcp setup command
 */
export interface McpSetupOptions {
  mode: 'tui' | 'cli';
  agents: AgentType[];
  cwd?: string;
  scope?: 'local' | 'global'; // 'local' = project, 'global' = home directory
  configMode?: McpConfigMode; // explicit override; undefined = ask in TUI / auto in CLI
}

/**
 * The two config output modes the user can choose from.
 *
 * - 'agent-config'  → uses ConfigGeneratorRegistry; produces a rich agent file
 *                     (.kiro/agents/skills-mcp.json, .github/agents/skills-mcp.agent.md, …)
 *                     that bundles MCP server registrations + usage instructions.
 *                     Only available for agents with a registered generator.
 *
 * - 'mcp-json'      → plain {mcpServers:{…}} written to the agent's standard mcp.json path.
 *                     Works for every agent; no agent-specific instructions are written.
 */
export type McpConfigMode = 'agent-config' | 'mcp-json';

/**
 * Parse mcp setup command arguments
 * Reuses the --agent flag pattern from add.ts
 * @param args Command arguments (e.g., ['setup', '--agent', 'claude-code', '--global'])
 * @returns Parsed options with mode, agents, and scope
 */
export function parseMcpOptions(args: string[]): McpSetupOptions {
  const agentList: AgentType[] = [];
  let scope: 'local' | 'global' = 'local';
  let configMode: McpConfigMode | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-a' || arg === '--agent') {
      i++;
      let nextArg = args[i];
      while (i < args.length && nextArg && !nextArg.startsWith('-')) {
        agentList.push(nextArg as AgentType);
        i++;
        nextArg = args[i];
      }
      i--;
    } else if (arg === '-g' || arg === '--global') {
      scope = 'global';
    } else if (arg === '--agent-config') {
      configMode = 'agent-config';
    } else if (arg === '--mcp-json') {
      configMode = 'mcp-json';
    }
  }

  const mode = agentList.length > 0 ? 'cli' : 'tui';

  return {
    mode,
    agents: agentList,
    scope,
    configMode,
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
    await setupTuiMode(configCwd, scope, options.configMode);
  } else {
    await setupCliMode(options.agents, configCwd, scope, options.configMode);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the agent type is backed by a ConfigGenerator. */
function isGeneratorBacked(agentType: string): boolean {
  return buildConfigGeneratorRegistry().supports(agentType);
}

/**
 * Configure a single agent according to the chosen config mode.
 * Returns the agentType string on success, null on failure.
 */
async function configureOneAgent(
  agentType: AgentType | string,
  configCwd: string,
  scope: 'local' | 'global',
  configMode: McpConfigMode
): Promise<string | null> {
  try {
    if (configMode === 'agent-config' && isGeneratorBacked(agentType as string)) {
      await generateSkillsMcpAgent(agentType, configCwd, scope);
    } else {
      await configureAgentMcp(agentType, configCwd, scope);
    }
    return agentType as string;
  } catch (error) {
    console.error(
      `✗ Failed to configure ${agents[agentType as AgentType]?.displayName || agentType}:`,
      (error as Error).message
    );
    return null;
  }
}

/**
 * Print a per-agent summary line after setup, including activation hint
 * when an agent config was written, or a disclaimer for unverified agents.
 */
function printAgentSummary(
  agentType: string,
  configMode: McpConfigMode,
  _scope: 'local' | 'global'
): void {
  const agent = agents[agentType as AgentType];
  const displayName = agent?.displayName || agentType;
  const isVerified = agent?.agentConfigSupport?.verified ?? false;

  if (configMode === 'agent-config' && isGeneratorBacked(agentType)) {
    const hint = agent?.agentConfigSupport?.activationHint;
    console.log(`  ✓ ${displayName} — agent config written`);
    if (hint) {
      // Distinguish CLI-command hints (no spaces, or known agent prefixes)
      // from prose hints (GitHub Copilot instructions etc.)
      const looksLikeCli =
        !hint.includes(' ') || hint.startsWith('kiro') || hint.startsWith('opencode');
      if (looksLikeCli) {
        console.log(`    → To activate:  ${hint}`);
      } else {
        console.log(`    → ${hint}`);
      }
    }

    // Show disclaimer for unverified agents
    if (!isVerified) {
      console.log(
        `    ⚠️  MCP integration not yet verified. Please ensure ${displayName} picks up the MCP server.`
      );
    }
  } else {
    console.log(`  ✓ ${displayName} — MCP server registered in mcp.json`);

    // Show disclaimer for unverified agents in mcp-json mode too
    if (!isVerified) {
      console.log(
        `    ⚠️  MCP integration not yet verified. Please check that ${displayName} has loaded the MCP server.`
      );
    }
  }
}

// ── TUI mode ──────────────────────────────────────────────────────────────────

async function setupTuiMode(
  cwd: string,
  scope: 'local' | 'global' = 'local',
  forcedConfigMode?: McpConfigMode
): Promise<void> {
  // 1. Detect installed agents
  const installedAgents = await detectInstalledAgents();

  if (installedAgents.length === 0) {
    console.log('No supported agents detected. Please install an agent first.');
    return;
  }

  // 2. Choose config scope
  const selectedScope = await select({
    message: 'Where should MCP configs be stored?',
    options: [
      { value: 'local', label: 'Local (Project directory) — shared via Git' },
      { value: 'global', label: 'Global (Home directory) — personal settings only' },
    ],
  });

  if (typeof selectedScope === 'symbol') {
    cancel('Operation cancelled');
    return;
  }

  scope = selectedScope as 'local' | 'global';
  const configCwd = scope === 'global' ? homedir() : cwd;

  // 3. Select agents — label generator-capable ones so the user knows
  const selectedAgents = await multiselect({
    message: 'Select agents to configure for MCP:',
    options: installedAgents.map((agentType) => {
      const agent = agents[agentType];
      const supportsAgentConfig = !!agent?.agentConfigSupport;
      return {
        value: agentType as any,
        label: `${agent?.displayName || agentType}${supportsAgentConfig ? ' ✦' : ''}`,
        hint: supportsAgentConfig ? 'supports agent config' : undefined,
      };
    }),
  });

  if (typeof selectedAgents === 'symbol') {
    cancel('Operation cancelled');
    return;
  }

  if (!selectedAgents || selectedAgents.length === 0) {
    console.log('No agents selected.');
    return;
  }

  // 4. If at least one selected agent supports an agent config, ask the user
  //    whether they want agent-config or plain mcp.json — unless the user
  //    already passed --agent-config or --mcp-json on the command line.
  const agentConfigCapable = (selectedAgents as AgentType[]).filter((a) =>
    isGeneratorBacked(a as string)
  );

  let configMode: McpConfigMode = 'mcp-json';

  if (forcedConfigMode) {
    // CLI flag takes precedence — skip the prompt entirely
    configMode = forcedConfigMode;
  } else if (agentConfigCapable.length > 0) {
    const capableNames = agentConfigCapable
      .map((a) => agents[a as AgentType]?.displayName || a)
      .join(', ');

    const modeChoice = await select({
      message: `How should skills-mcp be configured for ${capableNames}?`,
      options: [
        {
          value: 'agent-config' as McpConfigMode,
          label: 'Agent config — creates a named "skills-mcp" agent with usage instructions',
          hint: 'Recommended: selectable by name; bundled prompt guides the agent',
        },
        {
          value: 'mcp-json' as McpConfigMode,
          label: 'MCP server only — registers servers in mcp.json, no dedicated agent',
          hint: 'Simpler; MCP server is available in all conversations without a named agent',
        },
      ],
    });

    if (typeof modeChoice === 'symbol') {
      cancel('Operation cancelled');
      return;
    }

    configMode = modeChoice as McpConfigMode;
  }

  // 5. Configure each selected agent
  console.log('');
  const configuredAgents: AgentType[] = [];

  for (const agentType of selectedAgents) {
    const result = await configureOneAgent(agentType as AgentType, configCwd, scope, configMode);
    if (result !== null) configuredAgents.push(agentType as AgentType);
  }

  // 6. Inject skill-required MCP servers
  if (configuredAgents.length > 0) {
    const skillDeps = await loadInstalledSkillMcpDeps(cwd, scope);
    await configureSkillMcpDepsForAgents(skillDeps, configuredAgents, configCwd, scope, configMode);
  }

  // 7. Per-agent summary with activation hints
  const scopeLabel = scope === 'global' ? 'global (home directory)' : 'local (project directory)';
  const failCount = selectedAgents.length - configuredAgents.length;

  console.log('');
  if (configuredAgents.length > 0) {
    console.log(`Configured ${configuredAgents.length} agent(s) in ${scopeLabel}:`);
    for (const agentType of configuredAgents) {
      printAgentSummary(agentType as string, configMode, scope);
    }
  }
  if (failCount > 0) {
    console.error(`\n✗ Failed to configure ${failCount} agent(s) in ${scopeLabel}`);
  }
}

// ── CLI mode ──────────────────────────────────────────────────────────────────

/**
 * CLI (non-interactive) mode. Generator-backed agents get agent-config by default.
 */
async function setupCliMode(
  agentTypes: AgentType[],
  cwd: string,
  scope: 'local' | 'global' = 'local',
  forcedConfigMode?: McpConfigMode
): Promise<void> {
  if (agentTypes.includes('*' as AgentType)) {
    const installedAgents = await detectInstalledAgents();
    agentTypes = installedAgents;
  }

  const configuredAgents: AgentType[] = [];

  for (const agentType of agentTypes) {
    // Honour the forced mode if set; otherwise default to agent-config for
    // generator-backed agents and mcp-json for all others.
    const configMode: McpConfigMode =
      forcedConfigMode ?? (isGeneratorBacked(agentType) ? 'agent-config' : 'mcp-json');
    const result = await configureOneAgent(agentType, cwd, scope, configMode);
    if (result !== null) configuredAgents.push(agentType);
  }

  // Inject skill-required MCP servers, routing each agent to its effective mode
  if (configuredAgents.length > 0) {
    const skillDeps = await loadInstalledSkillMcpDeps(cwd, scope);

    if (forcedConfigMode) {
      // Single forced mode — split only on generator capability
      const generatorBacked = configuredAgents.filter((a) => isGeneratorBacked(a));
      const rawMcp = configuredAgents.filter((a) => !isGeneratorBacked(a));
      if (generatorBacked.length > 0) {
        await configureSkillMcpDepsForAgents(
          skillDeps,
          generatorBacked,
          cwd,
          scope,
          forcedConfigMode
        );
      }
      if (rawMcp.length > 0) {
        await configureSkillMcpDepsForAgents(skillDeps, rawMcp, cwd, scope, 'mcp-json');
      }
    } else {
      // Auto mode — use natural mode per agent
      const generatorBacked = configuredAgents.filter((a) => isGeneratorBacked(a));
      const rawMcp = configuredAgents.filter((a) => !isGeneratorBacked(a));
      if (generatorBacked.length > 0) {
        await configureSkillMcpDepsForAgents(
          skillDeps,
          generatorBacked,
          cwd,
          scope,
          'agent-config'
        );
      }
      if (rawMcp.length > 0) {
        await configureSkillMcpDepsForAgents(skillDeps, rawMcp, cwd, scope, 'mcp-json');
      }
    }
  }

  // Summary
  const failCount = agentTypes.length - configuredAgents.length;
  if (configuredAgents.length > 0) {
    console.log(`\nConfigured ${configuredAgents.length} agent(s):`);
    for (const agentType of configuredAgents) {
      const configMode: McpConfigMode =
        forcedConfigMode ?? (isGeneratorBacked(agentType) ? 'agent-config' : 'mcp-json');
      printAgentSummary(agentType as string, configMode, scope);
    }
  }
  if (failCount > 0) {
    console.error(`\n✗ Failed to configure ${failCount} agent(s)`);
  }
}
