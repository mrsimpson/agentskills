# Agent Skills MCP

[![npm version](https://badge.fury.io/js/%40codemcp%2Fagentskills.svg)](https://www.npmjs.com/package/@codemcp/agentskills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server that exposes [Claude Code Agent Skills](https://github.com/anthropics/agent-skills) to any MCP-compatible agent.

## What are Agent Skills?

Agent Skills are reusable, parameterized instructions that can be shared across AI agents. They follow an open standard format with YAML frontmatter and Markdown body, making them easy to discover, share, and use.

## Features

- 🔌 **MCP Protocol Support** - Use skills in Claude Desktop, Cline, Continue, and other MCP-compatible clients
- 📦 **Package Manager Integration** - Declare skills in `package.json` like npm dependencies
- 🚀 **Multiple Sources** - Install from GitHub, local paths, or tarball URLs
- ✅ **Validation** - Built-in parsing and validation for Agent Skills format
- 🔍 **Discovery** - Skills automatically exposed via MCP resources and tools
- 🧩 **Modular** - Three separate packages: core, CLI, and MCP server

## Quick Start

### Installation

```bash
npm install -g @codemcp/agentskills
```

Or with pnpm:

```bash
pnpm add -g @codemcp/agentskills
```

### Configure Skills

Add skills to your `package.json`:

```json
{
  "agentskills": {
    "git-workflow": "github:anthropics/agent-skills/skills/git-workflow",
    "local-skill": "file:./my-skills/custom-skill",
    "shared-skill": "git+https://github.com/org/skills.git#v1.0.0"
  }
}
```

### Install Skills

```bash
agentskills install
```

This downloads skills to `.agentskills/skills/` directory.

### Use with MCP

Configure your MCP client (e.g., Claude Desktop) to use the MCP server:

```json
{
  "mcpServers": {
    "agentskills": {
      "command": "agentskills-mcp",
      "cwd": "/path/to/your/project"
    }
  }
}
```

Now your agent can discover and use skills via:

- `use_skill` tool - Execute skill instructions
- `skill://` resources - Browse available skills

## Packages

This is a monorepo containing three packages:

- **[@codemcp/agentskills-core](./packages/core)** - Core parsing, validation, and installation logic
- **[@codemcp/agentskills-cli](./packages/cli)** - Command-line interface for skill management
- **[@codemcp/agentskills-mcp-server](./packages/mcp-server)** - MCP protocol server implementation

## CLI Commands

### Install all skills

```bash
agentskills install
```

### Add a new skill

```bash
agentskills add my-skill github:user/repo/path/to/skill
```

### List configured skills

```bash
agentskills list
```

### Validate a skill

```bash
agentskills validate path/to/SKILL.md
```

## Creating Skills

A skill is a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: example-skill
description: Does something useful
arguments:
  - name: target
    description: What to do it to
    required: true
---

# Example Skill

This is the skill body with instructions for the agent.

Use the argument like this: $ARGUMENTS or $1 (first argument).
```

## Architecture

- **Package.json-based config** - Skills declared in `agentskills` field
- **Pacote for installation** - Uses npm's Pacote library for downloading
- **Fail-fast registry** - Validation errors thrown immediately
- **Single directory structure** - All skills in `.agentskills/skills/<skill-name>/`

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests (325 tests)
pnpm test

# Run linting and formatting
pnpm run lint:all
pnpm run format:check:all
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT, Created by Oliver Jägle

## Links

- [Agent Skills Standard](https://github.com/anthropics/agent-skills)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [npm Package](https://www.npmjs.com/package/@codemcp/agentskills)
