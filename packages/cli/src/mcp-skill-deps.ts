/**
 * Handles MCP server dependencies declared in skill frontmatter via `requires-mcp-servers`.
 *
 * Called from `mcp setup` after configuring the agentskills server so that
 * every agent the user selects also receives the individual MCP servers that
 * the installed skills require.
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { AgentType, McpServerDependency } from './types.ts';
import type { SkillsMcpServerConfig } from '@codemcp/agentskills-core';
import { agents } from './agents.ts';
import {
  getAgentConfigPath,
  readAgentConfig,
  writeAgentConfig,
  generateSkillsMcpAgent,
  buildConfigGeneratorRegistry,
} from './mcp-configurator.ts';
import { discoverSkills } from './skills.ts';
import { getCanonicalSkillsDir, getMCPCanonicalSkillsDir } from './installer.ts';

// ── skill discovery ───────────────────────────────────────────────────────────

/**
 * Load all installed skills for the given scope and return the unique set of
 * MCP server dependencies declared across them.
 */
export async function loadInstalledSkillMcpDeps(
  cwd: string,
  scope: 'local' | 'global'
): Promise<McpServerDependency[]> {
  const isGlobal = scope === 'global';

  // Skills can live in the canonical .agents/skills dir or the MCP-server dir
  const searchDirs = [
    getCanonicalSkillsDir(isGlobal, cwd),
    getMCPCanonicalSkillsDir(isGlobal, cwd),
  ];

  const seen = new Map<string, McpServerDependency>();

  for (const dir of searchDirs) {
    try {
      const skills = await discoverSkills(dir, undefined, { fullDepth: true });
      for (const skill of skills) {
        for (const dep of skill.requiresMcpServers ?? []) {
          if (!seen.has(dep.name)) {
            seen.set(dep.name, dep);
          }
        }
      }
    } catch {
      // Directory may not exist — skip silently
    }
  }

  return [...seen.values()];
}

// ── parameter resolution ──────────────────────────────────────────────────────

/** Replace `{{PARAM_NAME}}` placeholders with resolved values. */
function substituteParam(value: string, params: Record<string, string>): string {
  return value.replace(
    /\{\{([A-Za-z0-9_-]+)\}\}/g,
    (_, key: string) => params[key] ?? `{{${key}}}`
  );
}

function applyParams(
  dep: McpServerDependency,
  params: Record<string, string>
): { command: string; args?: string[]; env?: Record<string, string>; cwd?: string } {
  const result: { command: string; args?: string[]; env?: Record<string, string>; cwd?: string } = {
    command: dep.command,
  };
  if (dep.args?.length) result.args = dep.args.map((a) => substituteParam(a, params));
  if (dep.env && Object.keys(dep.env).length) {
    result.env = Object.fromEntries(
      Object.entries(dep.env).map(([k, v]) => [k, substituteParam(v, params)])
    );
  }
  if (dep.cwd) result.cwd = dep.cwd;
  return result;
}

async function resolveParameters(dep: McpServerDependency): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!dep.parameters) return result;

  for (const [paramName, spec] of Object.entries(dep.parameters)) {
    // Resolve env-var defaults: {{ENV:VAR_NAME}}
    let resolved = spec.default;
    if (resolved?.startsWith('{{ENV:')) {
      const m = resolved.match(/\{\{ENV:([A-Za-z0-9_]+)\}\}/);
      if (m) resolved = process.env[m[1]!] ?? undefined;
    }

    if (resolved !== undefined) {
      result[paramName] = resolved;
      continue;
    }

    if (!spec.required) continue; // optional with no default — leave placeholder

    // Required parameter without a default — prompt the user
    const answer = await p.text({
      message: `${pc.cyan(dep.name)} needs ${pc.bold(paramName)}: ${spec.description}`,
    });

    if (p.isCancel(answer)) {
      p.cancel('MCP server configuration cancelled');
      process.exit(0);
    }

    result[paramName] = answer as string;
  }

  return result;
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * For each supplied agent, write any skill-required MCP servers that are not
 * yet present in that agent's config.
 *
 * Agents backed by a ConfigGenerator (Kiro, GitHub Copilot, OpenCode) produce
 * a single agent file that contains ALL servers. For those agents the deps are
 * merged into the agent config and the file is regenerated — no separate
 * mcp.json is written.
 *
 * Agents that use a raw mcp.json (Claude, Cursor, Cline, …) receive the
 * missing servers directly via readAgentConfig / writeAgentConfig.
 *
 * In both cases the diff rule is: only check presence of the server key —
 * never modify an existing server's configuration.
 *
 * @param deps        MCP server dependencies collected from installed skills.
 * @param agentTypes  Agents that were just configured by `mcp setup`.
 * @param configCwd   Base directory for agent config files.
 * @param scope       'local' or 'global'.
 */
export async function configureSkillMcpDepsForAgents(
  deps: McpServerDependency[],
  agentTypes: AgentType[],
  configCwd: string,
  scope: 'local' | 'global'
): Promise<void> {
  if (deps.length === 0 || agentTypes.length === 0) return;

  // Resolve parameters once (shared across all agents)
  const resolvedConfigs = new Map<
    string,
    { command: string; args?: string[]; env?: Record<string, string>; cwd?: string }
  >();

  for (const dep of deps) {
    const params = await resolveParameters(dep);
    resolvedConfigs.set(dep.name, applyParams(dep, params));
  }

  // Determine which agents are handled by a ConfigGenerator vs raw mcp.json
  const registry = buildConfigGeneratorRegistry();

  let anyConfigured = false;

  for (const agentType of agentTypes) {
    const isGeneratorBacked = registry.supports(agentType as string);

    if (isGeneratorBacked) {
      // ── Generator-backed agents (Kiro, GitHub Copilot, OpenCode) ──────────
      // The agent file already exists (written by generateSkillsMcpAgent).
      // We need to know which servers are already in it to diff correctly,
      // then regenerate with the full merged set.
      //
      // For simplicity we re-run generateSkillsMcpAgent with the extra servers
      // — the generator always writes the canonical set so idempotent runs are
      // safe. The existing agentskills entry is never duplicated because it is
      // hardcoded in generateSkillsMcpAgent's baseConfig.
      const missingServers: Record<string, SkillsMcpServerConfig> = {};
      for (const dep of deps) {
        const resolved = resolvedConfigs.get(dep.name)!;
        missingServers[dep.name] = {
          command: resolved.command,
          args: resolved.args,
          env: resolved.env,
          ...(resolved.cwd ? { cwd: resolved.cwd } : {}),
        };
      }

      try {
        await generateSkillsMcpAgent(agentType, configCwd, scope, missingServers);
        for (const dep of deps) {
          p.log.success(
            `${pc.green('✓')} Added ${pc.cyan(dep.name)} to ${pc.dim(agents[agentType as AgentType]?.displayName || agentType)}`
          );
        }
        anyConfigured = true;
      } catch {
        p.log.warn(
          pc.yellow(
            `Could not update agent config for ${agents[agentType as AgentType]?.displayName || agentType} — add skill MCP servers manually`
          )
        );
      }
    } else {
      // ── Raw mcp.json agents (Claude, Cursor, Cline, …) ───────────────────
      for (const dep of deps) {
        try {
          const configPath = getAgentConfigPath(agentType, configCwd, scope);
          const config = await readAgentConfig(configPath);
          if (!config.mcpServers) config.mcpServers = {};

          if (config.mcpServers[dep.name]) continue; // already configured — don't touch

          config.mcpServers[dep.name] = resolvedConfigs.get(dep.name)! as {
            command: string;
            args?: string[];
            env?: Record<string, string>;
          };
          await writeAgentConfig(configPath, config);

          p.log.success(
            `${pc.green('✓')} Added ${pc.cyan(dep.name)} to ${pc.dim(agents[agentType as AgentType]?.displayName || agentType)}`
          );
          anyConfigured = true;
        } catch {
          p.log.warn(
            pc.yellow(
              `Could not update MCP config for ${agents[agentType as AgentType]?.displayName || agentType} — add ${pc.cyan(dep.name)} manually`
            )
          );
        }
      }
    }
  }

  if (anyConfigured) {
    console.log();
  }
}
