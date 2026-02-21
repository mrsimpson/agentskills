# Agent Skills MCP

[![npm version](https://badge.fury.io/js/%40codemcp%2Fagentskills.svg)](https://www.npmjs.com/package/@codemcp/agentskills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Transform Agent Skills into MCP tools with team-shareable configuration

An MCP server that makes [Agent Skills](https://agentskills.io) available to any MCP-compatible agent through a declarative, package.json-based configuration.

## Why This Exists

**Agent Skills are powerful context engineering tools:**
- Break down long system prompts into reusable, parameterized components
- Follow an [open standard](https://agentskills.io) for portability across agents
- More powerful than prompts alone when bundled with tools and workflows

**But current implementations have pain points:**
- ❌ **Filesystem-based discovery**: Each agent uses different directories (`.claude/skills`, etc.)
- ❌ **No configuration control**: All skills always loaded, no filtering or organization
- ❌ **Unclear security model**: Dynamic tool calling and scripts are significant threats without proper sandboxing
- ❌ **No team sharing**: Hard to share skill configurations across teams

**The MCP Gateway Solution:**

MCP has already solved these problems for tools. By providing an MCP server as a "gateway" for Agent Skills:
- ✅ Address all pain points **client-independently** through a standardized interface
- ✅ Declarative configuration via `package.json` that teams can version and share
- ✅ Clear security model: server doesn't execute code, agents remain in control
- ✅ Skills + MCP tooling = powerful combination understood by all agents

## What It Does

This project provides:
1. **CLI** for installing and managing Agent Skills from multiple sources (GitHub, local, tarball URLs)
2. **MCP Server** that exposes installed skills as MCP tools to any compatible agent
3. **Core library** for parsing, validating, and working with Agent Skills

## Quick Start

### 1. Install

```bash
npm install -g @codemcp/agentskills
```

Or with pnpm:

```bash
pnpm add -g @codemcp/agentskills
```

### 2. Configure Skills

Add skills to your project's `package.json`:

```json
{
  "agentskills": {
    "git-workflow": "github:anthropics/agent-skills/skills/git-workflow",
    "local-skill": "file:./my-skills/custom-skill",
    "shared-skill": "git+https://github.com/org/skills.git#v1.0.0"
  }
}
```

### 3. Install Skills

```bash
agentskills install
```

This downloads skills to `.agentskills/skills/` directory.

### 4. Configure MCP Client

Point your MCP client (Claude Desktop, Cline, Continue, etc.) to the server:

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

### 5. Use Skills

Your agent can now:
- Call the `use_skill` tool to execute skill instructions
- Browse available skills via `skill://` resources

## How It Works

```
package.json (config) → agentskills install → .agentskills/skills/
                                                        ↓
Agent ← MCP Protocol ← agentskills-mcp (server) ← skill registry
```

1. **Configuration**: Declare skills in `package.json` like npm dependencies
2. **Installation**: CLI downloads skills from GitHub, local paths, or URLs using npm's Pacote
3. **Server**: MCP server reads installed skills and exposes them as tools
4. **Execution**: Agent calls `use_skill` tool, receiving skill instructions in context

## Features

- 🔌 **MCP Protocol Support** - Works with Claude Desktop, Cline, Continue, and other MCP clients
- 📦 **Package Manager Integration** - Declare skills in `package.json`, version control your configuration
- 🚀 **Multiple Sources** - Install from GitHub repos, local paths, or tarball URLs
- ✅ **Validation** - Built-in parsing and validation for Agent Skills format
- 🔍 **Discovery** - Skills automatically exposed via MCP resources and tools
- 🔒 **Security** - Server only serves skill content; agents control execution
- 🧩 **Modular** - Three separate packages for different use cases

## Configuration

Skills are declared in the `agentskills` field of `package.json`:

```json
{
  "agentskills": {
    "skill-name": "source-specifier"
  }
}
```

### Source Specifiers

| Source Type | Example | Description |
|------------|---------|-------------|
| GitHub shorthand | `github:user/repo/path/to/skill` | Direct GitHub path |
| Git URL | `git+https://github.com/org/repo.git#v1.0.0` | Full git URL with version tag |
| Local path | `file:./skills/custom-skill` | Relative or absolute local path |
| Tarball URL | `https://example.com/skill.tgz` | Remote tarball |

### Example Team Configuration

```json
{
  "name": "my-project",
  "agentskills": {
    "git-workflow": "github:anthropics/agent-skills/skills/git-workflow",
    "code-review": "github:anthropics/agent-skills/skills/code-review",
    "custom-api-docs": "file:./team-skills/api-documentation",
    "shared-workflow": "git+https://github.com/myorg/skills.git#v2.1.0"
  }
}
```

Commit this to your repo, and your entire team uses the same skills configuration.

## CLI Commands

### Install all configured skills
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

### Validate a skill file
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

Use arguments like this: $ARGUMENTS or $1 (first argument).
```

See the [Agent Skills standard](https://agentskills.io) for full specification.

## Use Cases

**When to use Agent Skills MCP:**

- **Context Engineering** - Break down complex system prompts into modular, reusable pieces
- **Team Collaboration** - Share skill configurations across your team via version control
- **Multi-Agent Workflows** - Use the same skills across different MCP-compatible agents
- **Security Control** - Centralized skill management without giving agents filesystem access
- **Skill Libraries** - Build and share libraries of domain-specific skills (DevOps, testing, documentation, etc.)

## Project Structure

This is a monorepo containing three packages:

- **[@codemcp/agentskills-core](./packages/core)** - Core parsing, validation, and installation logic
- **[@codemcp/agentskills-cli](./packages/cli)** - Command-line interface for skill management  
- **[@codemcp/agentskills-mcp-server](./packages/mcp-server)** - MCP protocol server implementation

All packages are independently published to npm and can be used separately.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests (302 tests)
pnpm test

# Run linting and formatting
pnpm run lint:all
pnpm run format:check:all
```

## Contributing

Contributions are welcome! Found a bug or have a feature request? [Open an issue](https://github.com/mrsimpson/agentskills/issues).

Pull requests for bug fixes, new features, or documentation improvements are appreciated.

## License

MIT © Luke Baker, Oliver Jägle

## Links

- [Agent Skills Standard](https://agentskills.io) - Official specification
- [Model Context Protocol](https://modelcontextprotocol.io) - Learn about MCP
- [npm Package](https://www.npmjs.com/package/@codemcp/agentskills) - Published packages
- [Anthropic Agent Skills](https://github.com/anthropics/agent-skills) - Original skill collection
