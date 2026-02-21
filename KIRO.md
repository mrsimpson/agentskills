# Kiro Agent Support

This document explains how to use Agent Skills MCP with **Kiro** (formerly Amazon Q Developer CLI).

## What is Kiro?

**Kiro** is an AI-powered CLI tool that provides interactive terminal-based AI assistance with custom agent creation and MCP integration. It's the closed-source continuation of Amazon Q Developer CLI.

- **Website**: https://kiro.dev/cli/
- **Documentation**: https://docs.kiro.dev/cli/
- **Former Open Source**: https://github.com/aws/amazon-q-developer-cli

## Kiro's Unique MCP Configuration

Unlike other MCP clients (Claude Desktop, Cline, etc.) which use a single centralized configuration file, **Kiro supports multiple configuration approaches**:

### 1. User-Level Configuration (Recommended)

The simplest approach, similar to other MCP clients:

**Location**: `~/.kiro/settings/mcp.json`

```json
{
  "mcpServers": {
    "agentskills": {
      "command": "agentskills-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

This configuration is **shared across all Kiro agents** that have `includeMcpJson: true`.

### 2. Workspace-Level Configuration

For project-specific MCP servers:

**Location**: `<project-root>/.kiro/settings/mcp.json`

Same format as user-level configuration, but scoped to the project directory.

### 3. Agent-Specific Configuration (Advanced)

Kiro allows each custom agent to have its own MCP server configuration:

**Location**: `~/.kiro/agents/{agent-name}.json`

```json
{
  "name": "myagent",
  "description": "My custom agent",
  "mcpServers": {
    "agentskills": {
      "command": "agentskills-mcp",
      "args": [],
      "env": {}
    }
  },
  "includeMcpJson": true, // Also include user/workspace mcp.json files
  "tools": [
    "*", // Enable all tools
    "@agentskills" // Specifically enable agentskills MCP tools
  ],
  "allowedTools": [
    "fs_read",
    "fs_write",
    "@agentskills/use_skill" // Explicitly allow specific MCP tools
  ]
}
```

**Key fields:**

- `mcpServers`: MCP servers available to this specific agent
- `includeMcpJson`: When `true`, also loads MCP servers from user/workspace `mcp.json` files
- `tools`: Which tool categories to enable (use `"@agentskills"` to enable all tools from the agentskills server)
- `allowedTools`: Fine-grained control over which specific tools can be used

## Installation & Setup

### 1. Install Agent Skills MCP globally

```bash
npm install -g @codemcp/agentskills
```

### 2. Configure your project

Add skills to `package.json`:

```json
{
  "agentskills": {
    "git-workflow": "github:anthropics/agent-skills/skills/git-workflow",
    "code-review": "github:anthropics/agent-skills/skills/code-review"
  }
}
```

### 3. Install skills

```bash
agentskills install
```

### 4. Configure Kiro (Choose One Approach)

#### Option A: User-Level (Simple, Recommended)

Create or edit `~/.kiro/settings/mcp.json`:

```bash
mkdir -p ~/.kiro/settings
cat > ~/.kiro/settings/mcp.json << 'EOF'
{
  "mcpServers": {
    "agentskills": {
      "command": "agentskills-mcp"
    }
  }
}
EOF
```

Then ensure your agents include this config by having `"includeMcpJson": true` in their agent configuration files.

#### Option B: Agent-Specific (Advanced)

Edit your agent's configuration file (e.g., `~/.kiro/agents/default.json`):

```json
{
  "name": "default",
  "description": "My default agent",
  "mcpServers": {
    "agentskills": {
      "command": "agentskills-mcp"
    }
  },
  "tools": ["*", "@agentskills"],
  "allowedTools": ["fs_read", "fs_write", "@agentskills/use_skill"]
}
```

### 5. Restart Kiro

```bash
kiro-cli chat
```

## Using Agent Skills with Kiro

Once configured, you can use skills in your Kiro chat sessions:

```bash
$ kiro-cli chat
> Use the git-workflow skill to help me commit these changes

> List all available agent skills
```

Kiro will automatically:

1. Discover available skills via MCP resources
2. Use the `use_skill` tool to execute skill instructions
3. Follow skill guidance in its responses

## Automatic Installation

The `agentskills install` command can automatically configure the MCP server for Kiro:

```bash
agentskills install --with-mcp --agent kiro
```

This will:

1. Install skills from your `package.json`
2. Configure the MCP server in `~/.kiro/settings/mcp.json`
3. Validate the configuration

## Troubleshooting

### MCP server not loading

Check which MCP servers are loaded:

```bash
$ kiro-cli chat
> /mcp
```

This will show all currently loaded MCP servers.

### Agent can't see skills

1. Verify the agent configuration includes the MCP server:
   - For user-level config: Check that `"includeMcpJson": true` in your agent's config
   - For agent-specific config: Verify the `mcpServers` field includes `agentskills`

2. Check tools configuration:

   ```json
   "tools": ["*", "@agentskills"]  // Enable agentskills tools
   ```

3. Check allowed tools (if using tool restrictions):
   ```json
   "allowedTools": ["@agentskills/use_skill"]
   ```

### Skills not found

Ensure skills are installed in the correct location:

```bash
# From your project directory
ls -la .agentskills/skills/

# Verify skills.lock exists
cat .agentskills/skills.lock
```

## Advanced: Per-Project MCP Configuration

For different skill sets per project, use workspace-level configuration:

```bash
# In project A
mkdir -p .kiro/settings
cat > .kiro/settings/mcp.json << 'EOF'
{
  "mcpServers": {
    "agentskills": {
      "command": "agentskills-mcp"
    }
  }
}
EOF
```

This allows different projects to have different skill configurations while using the same Kiro agents.

## Comparison with Other MCP Clients

| Feature                | Kiro                                                                                                           | Other Clients (Claude, Cline, etc.)                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Configuration Location | Multiple options:<br>- `~/.kiro/settings/mcp.json`<br>- `.kiro/settings/mcp.json`<br>- `~/.kiro/agents/*.json` | Single location per client:<br>- Claude: `~/Library/.../claude_desktop_config.json`<br>- Cline: `~/.cline/mcp_settings.json` |
| Configuration Scope    | Per-agent, per-workspace, or global                                                                            | Global only                                                                                                                  |
| Tool Permissions       | Fine-grained control via `tools` and `allowedTools`                                                            | All tools enabled by default                                                                                                 |
| Use Case               | Custom agents with specific capabilities                                                                       | General-purpose AI assistance                                                                                                |

## Resources

- **Kiro CLI Documentation**: https://docs.kiro.dev/cli/
- **Kiro MCP Guide**: https://docs.kiro.dev/cli/mcp/
- **Agent Configuration**: https://docs.kiro.dev/cli/custom-agents/
- **Agent Skills Standard**: https://agentskills.io
- **Model Context Protocol**: https://modelcontextprotocol.io

## Support

- **Kiro Issues**: https://github.com/kirodotdev/Kiro/issues
- **Agent Skills MCP Issues**: https://github.com/mrsimpson/agentskills/issues
- **Kiro Discord**: https://discord.gg/kirodotdev
