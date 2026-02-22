# MCP Server Dependencies

A skill can declare which MCP servers it requires. This allows the CLI to validate — and optionally auto-configure — those servers for your agent.

## Declaring Dependencies

In a skill's `SKILL.md` frontmatter:

```yaml
---
name: my-skill
description: Does something that needs the filesystem MCP server
requiresMcpServers:
  - name: filesystem
    package: "@modelcontextprotocol/server-filesystem"
    description: "Needed for file read/write operations"
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "{{WORKSPACE_PATH}}"
    parameters:
      WORKSPACE_PATH:
        description: "Root directory the server can access"
        required: true
        default: "."
---
```

## Field Reference

| Field | Required | Description |
|---|---|---|
| `name` | yes | Identifier for the MCP server |
| `description` | yes | Why this server is needed |
| `command` | yes | Executable to run (e.g., `npx`, `node`) |
| `package` | no | npm package name (used for auto-install) |
| `args` | no | Arguments array; may contain `{{PARAM}}` placeholders |
| `env` | no | Environment variables to set |
| `parameters` | no | Parameter definitions for placeholder substitution |

### Parameter Specification

```yaml
parameters:
  MY_PARAM:
    description: "What this parameter configures"
    required: true
    default: "default-value"
    sensitive: false    # true for secrets/credentials
    example: "example-value"
```

## CLI Integration

**Validate** that required servers are configured:

```bash
agentskills install --agent claude
```

Reports any MCP servers declared by your skills that are not yet configured for the specified agent.

**Auto-configure** missing servers:

```bash
agentskills install --with-mcp --agent cline
```

Writes the server configuration to the agent's config file and prompts for required parameters.

## How It Works

When you run `agentskills install --agent <name>`:

1. All installed skills are scanned for `requiresMcpServers`
2. Each declared server is checked against the agent's existing MCP config
3. Missing servers are reported (or auto-added with `--with-mcp`)
4. Parameter placeholders (e.g., `{{WORKSPACE_PATH}}`) are resolved interactively or from defaults
