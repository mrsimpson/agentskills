# CLI Reference

The `agentskills` CLI manages your skill configuration and installation.

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
| `--with-mcp`     | Auto-install missing MCP servers and update the agent's config            |

**Supported agent names:** `claude`, `cline`, `continue`, `cursor`, `junie`, `kiro`, `opencode`, `zed`

**Examples:**

```bash
agentskills install                          # Install skills only
agentskills install --agent claude           # Install + validate MCP dependencies
agentskills install --with-mcp --agent cline # Install + auto-configure MCP servers
agentskills install --with-mcp --agent opencode # Install + auto-configure for OpenCode
```

Agent configs are written to the project directory (`.claude/`, `.kiro/`, `opencode.json`, etc.) so they can be version-controlled.

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
