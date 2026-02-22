# Getting Started

## Prerequisites

- Node.js 18 or later
- An MCP-compatible agent (Claude Desktop, Cline, Cursor, etc.)

## 1. Install

```bash
npm install -g @codemcp/agentskills
# or
pnpm add -g @codemcp/agentskills
```

This installs two executables:
- `agentskills` — the CLI for managing skills
- `agentskills-mcp` — the MCP server your agent connects to

## 2. Add Skills to Your Project

Navigate to your project directory, then add skills by name and source:

```bash
agentskills add git-workflow github:anthropics/agent-skills/skills/git-workflow
agentskills add code-review github:anthropics/agent-skills/skills/code-review
```

The `add` command validates the skill before writing anything to `package.json`. See [Source Specifiers](/reference/source-specifiers) for all supported formats.

## 3. Install Skills

```bash
agentskills install
```

Skills are downloaded to `.agentskills/skills/` — a directory you can `.gitignore` just like `node_modules`. A lock file (`.agentskills/skills.lock`) records exact resolved versions for reproducibility.

## 4. Connect Your Agent

Add the MCP server to your agent's configuration. The exact location depends on your agent — see [Connecting Agents](/guide/mcp-clients) for per-agent instructions.

**General format:**

```json
{
  "mcpServers": {
    "agentskills": {
      "command": "agentskills-mcp"
    }
  }
}
```

## 5. Use Skills

Once connected, your agent has access to:

- A `use_skill` tool — the agent calls it by skill name to receive instructions
- `skill://` resources — for browsing skill metadata

The agent's tool call looks like:

```
use_skill(skill_name: "git-workflow")
```

The server returns the raw skill instructions. The agent interprets and applies them.

## What's Next

- [Configuring Skills](/guide/configuration) — team config, multiple sources
- [CLI Reference](/guide/cli) — all available commands
- [SKILL.md Format](/reference/skill-format) — create your own skills
