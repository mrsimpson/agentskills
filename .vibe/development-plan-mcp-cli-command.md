# Development Plan: agent-skills (mcp-cli-command branch)

_Generated on 2026-02-26 by Vibe Feature MCP_
_Workflow: [epcc](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/epcc)_

## Goal

Integrate MCP server configuration functionality (previously `--with-mcp` flag) into the new skills CLI with **minimal modifications to the Vercel CLI codebase**.

The functionality allows users to:

- Install skills AND automatically configure the MCP server in their agent's config file
- Support multiple MCP clients (Claude Desktop, Cline, Cursor, OpenCode, Junie, Kiro, Zed, etc.)
- Detect agent dependencies declared in skill frontmatter
- Write agent-specific MCP configurations to version-controlled project directories

## Explore

<!-- beads-phase-id: agent-skills-6.1 -->

### Tasks

_Tasks managed via `bd` CLI_

## Plan

<!-- beads-phase-id: agent-skills-6.2 -->

### Tasks

_Tasks managed via `bd` CLI_

## Code

<!-- beads-phase-id: agent-skills-6.3 -->

### Tasks

_Tasks managed via `bd` CLI_

#### TDD Structure Overview

Implementing 3 implementation cycles with Test-Driven Development pattern:

**Cycle 1: mcp-configurator.ts module**

- agent-skills-6.3.2: RED phase - Write failing tests
- agent-skills-6.3.3: GREEN phase - Implement to pass tests (depends on 6.3.2)
- agent-skills-6.3.4: REVIEW phase - Judge semantic consistency

**Cycle 2: mcp.ts command handler**

- agent-skills-6.3.5: RED phase - Write failing tests
- agent-skills-6.3.6: GREEN phase - Implement to pass tests (depends on 6.3.5 + 6.3.3)
- agent-skills-6.3.7: REVIEW phase - Judge semantic consistency

**Cycle 3: cli.ts integration**

- agent-skills-6.3.8: RED phase - Write failing tests
- agent-skills-6.3.9: GREEN phase - Implement to pass tests (depends on 6.3.8 + 6.3.6)
- agent-skills-6.3.10: REVIEW phase - Judge semantic consistency

**Final Task**

- agent-skills-6.3.11: Squash WIP commits and create conventional commit

#### TDD Workflow

Each cycle follows:

1. **RED**: Write failing tests that document expected behavior
2. **GREEN**: Implement minimal code to pass tests
3. **REVIEW**: Verify GREEN doesn't change test semantics

View all tasks with: `bd children agent-skills-6.3`

## Commit

<!-- beads-phase-id: agent-skills-6.4 -->

### Tasks

- [ ] Squash WIP commits: `git reset --soft <first commit of this branch>. Then, Create a conventional commit. In the message, first summarize the intentions and key decisions from the development plan. Then, add a brief summary of the key changes and their side effects and dependencies

_Tasks managed via `bd` CLI_

## Key Decisions

1. **New Command Structure:** Create dedicated `skills mcp` command with subcommand `setup`
   - `skills mcp setup` → TUI-based guided setup for agent selection and MCP configuration
   - `skills mcp setup --agent claude --agent kiro` → CLI mode to configure specific agents
2. **Integration Point:** Create new `mcp.ts` command handler (parallel to add.ts, remove.ts) in packages/cli/src
3. **Use Core Package Adapters:** Leverage existing `McpConfigAdapterRegistry` from `@agent-skills/core` instead of reimplementing config logic
4. **MCP Configurator Module:** New `mcp-configurator.ts` to handle:
   - Writing MCP server config to agent config files
   - Reading existing agent configs
   - Agent config path resolution
5. **Agent Detection:** Use existing `detectInstalledAgents()` to show only agents actually installed
6. **Backward Compatibility:** New command doesn't modify existing CLI behavior - purely additive

## Notes

### Current Architecture

**CLI (packages/cli/src):**

- `cli.ts`: Main entry point with commands (add, remove, list, find, check, update, etc.)
- `add.ts`: Handles skill installation with provider support (2000+ lines, complex)
- `installer.ts`: Core installation logic with `InstallMode` type supporting 'mcp-server' mode
- Already has `getMCPCanonicalSkillsDir()` for `.agentskills/skills` path
- Already supports MCP server mode installation (installs to canonical location only)

**Core Package (packages/core/src):**

- `mcp-config-adapters.ts`: Registry pattern for client-specific MCP configurations
  - `StandardMcpConfigAdapter`: For Claude Desktop, Cline, Cursor, Junie, Kiro, Zed
  - `OpenCodeConfigAdapter`: Special format for OpenCode (uses `mcp` field instead of `mcpServers`)
  - Adapter registry to get/register adapters by client type
- `package-config.ts`: PackageConfigManager for reading/writing package.json
- `types.ts`: TypeScript definitions for McpConfig, McpServerConfig, McpClientType

**Agent Detection:**

- `agents.ts` in CLI: Maps agent types to config locations
- Different config file locations per agent (`.claude/`, `.cline/`, `opencode.json`, etc.)

### Key Insights

1. **MCP Config Writing Logic Already Exists:** Core package has adapters, CLI just needs to use them
2. **MCP Server Mode Already Implemented:** `installer.ts` has 'mcp-server' InstallMode, just needs config writing
3. **Minimal CLI Modifications Possible:** Create standalone `mcp.ts` command, don't modify Vercel code paths
4. **Agent Config Locations Vary:** Each agent has different config file location - need to write to correct place
   - Claude: `.claude/` or `~/.claude/`
   - Cline: `.cline/` or `~/.cline/`
   - Cursor: `.cursor/mcp.json`
   - OpenCode: `opencode.json` (project root)
   - Kiro: `.kiro/`
   - Zed: `~/.config/zed/settings.json`
5. **Skill Frontmatter Declares Dependencies:** Skills can declare MCP dependencies in SKILL.md frontmatter (future use)
6. **CLI Not Adapted to Read Core Package Yet:** The MCP config adapters exist in core but CLI doesn't use them

### Implementation Strategy for `skills mcp setup`

**Command Structure:**

```bash
skills mcp setup              # TUI mode - interactive agent selection
skills mcp setup --agent claude --agent kiro  # CLI mode - specify agents
```

**TUI Mode** (`skills mcp setup`):

1. Auto-detect installed agents using `detectInstalledAgents()`
2. Show multi-select prompt (using @clack/prompts like installer)
3. Let user pick which agents to configure
4. For each selected agent, call `configureAgentMcp(agentType, cwd)`
5. Show confirmation of what was configured

**CLI Mode** (`skills mcp setup --agent claude --agent kiro`):

1. Reuse existing `parseAddOptions()` logic for `--agent` flag parsing
   - Same pattern: `--agent agent1 agent2 ...` (space-separated or repeated)
   - Can use `--agent '*'` to select all agents
2. Validate agents are supported
3. For each agent, call `configureAgentMcp(agentType, cwd)`
4. Show summary of changes

**Note:** `parseAddOptions()` is designed for general option parsing and already handles:

- `-a` / `--agent` flags with multiple space-separated or repeated values
- `--all` flag which implies all agents
- Proper arg parsing with lookahead to avoid consuming flag values

**Implementation Files:**

1. **mcp-configurator.ts** (new module)
   - `configureAgentMcp(agentType, cwd)` - Main entry point
   - `getAgentConfigPath(agentType, cwd)` - Resolve config file path per agent
   - `readAgentConfig(configPath)` - Read existing config (or return empty)
   - `writeAgentConfig(configPath, config)` - Write config to file with proper JSON formatting
   - Uses `McpConfigAdapterRegistry` from core to handle agent-specific formats

2. **mcp.ts** (new command handler)
   - `parseMcpOptions(args)` - Parse --agent flags and mode detection
   - `runMcpSetup(options)` - Main handler with TUI/CLI branching logic
   - TUI uses multi-select prompt with detected agents
   - CLI validates and configures specified agents

3. **cli.ts** (minimal changes)
   - Add 'mcp' case in main switch statement
   - Add 'setup' case within 'mcp' handler
   - Show help for mcp command with examples
   - Import and call `runMcpSetup()`

### MCP Server Configuration Written:

For each agent, write this to their config file:

```json
{
  "mcpServers": {
    "agentskills": {
      "command": "npx",
      "args": ["-y", "@codemcp/skills-mcp"]
    }
  }
}
```

(Actual format depends on agent type via adapter - e.g., OpenCode uses `mcp` key)

---

_This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management._
