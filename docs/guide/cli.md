# CLI Reference

The `agentskills` CLI manages your skill configuration, installation, and agent connections.

## `agentskills mcp setup`

Configure your AI agent to use the Skills MCP server. This is the easiest way to connect agents like Claude Desktop, Cline, Cursor, Kiro, OpenCode, and 36+ others.

```bash
agentskills mcp setup [options]
```

**Interactive Mode (Recommended):**

```bash
agentskills mcp setup
```

This launches a wizard that guides you through scope selection, agent selection, and configuration.

**Command Line Mode:**

```bash
# Single agent
agentskills mcp setup --agent claude-code

# Multiple agents
agentskills mcp setup --agent claude-code cline cursor

# All agents
agentskills mcp setup --agent '*'

# Force specific configuration mode
agentskills mcp setup --agent kiro-cli --agent-config
agentskills mcp setup --agent cline --mcp-json

# Use global scope (home directory)
agentskills mcp setup --agent claude-code --global
```

**Options:**

| Option             | Description                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| `--agent <agents>` | Agents to configure (space-separated list or `*` for all)                       |
| `--agent-config`   | Force rich agent-config mode (supported agents: GitHub Copilot, Kiro, OpenCode) |
| `--mcp-json`       | Force plain MCP JSON mode (universal, all agents)                               |
| `--global`         | Write to home directory (default: project directory)                            |
| `--help`           | Show help text                                                                  |

**See Also:** [MCP Setup Guide](/guide/mcp-setup) for detailed walkthrough and examples.

## `agentskills add`

Add a skill to `package.json` and validate it before writing.

```bash
agentskills add <name> <spec>
```

**Examples:**

```bash
agentskills add git-workflow github:anthropics/agent-skills/skills/git-workflow
agentskills add local-skill file:./my-skills/custom-skill
```

The skill is fetched, validated (format and metadata checked), and only added to `package.json` if valid. Run `agentskills install` afterwards to install all configured skills.

## `agentskills install`

Download and install all skills declared in `package.json`.

```bash
agentskills install [options]
```

| Option           | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| `--agent <name>` | Validate that required MCP servers are configured for the specified agent |
| `--with-mcp`     | Auto-configure missing MCP servers using `agentskills mcp setup`          |

**Supported agent names:** `claude`, `cline`, `continue`, `cursor`, `junie`, `kiro`, `opencode`, `zed` (and 33+ others)

**Examples:**

```bash
agentskills install                          # Install skills only
agentskills install --agent claude           # Install + validate MCP dependencies
agentskills install --with-mcp --agent cline # Install + auto-configure MCP servers
agentskills install --with-mcp --agent opencode # Install + auto-configure for OpenCode
```

Agent configs are written to the project directory (`.claude/`, `.kiro/`, `opencode.json`, etc.) or your home directory (`~/.claude/`, `~/.kiro/`, etc.) so they can be version-controlled.

**Note:** The `--with-mcp` option uses `agentskills mcp setup` internally. See [MCP Setup Guide](/guide/mcp-setup) for more control over MCP configuration.

## `agentskills list`

List all configured and installed skills.

```bash
agentskills list
```

## `agentskills validate`

Validate a `SKILL.md` file against the Agent Skills standard.

```bash
agentskills validate <path>
```

**Example:**

```bash
agentskills validate ./my-skills/custom-skill/SKILL.md
```

Reports errors (blocking) and warnings (non-blocking) with field-level detail.
