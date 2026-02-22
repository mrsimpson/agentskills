# Configuring Skills

Skills are declared in the `agentskills` field of your project's `package.json`. This keeps skill dependencies alongside your code, under version control, and shareable with your team.

## Basic Format

```json
{
  "name": "my-project",
  "agentskills": {
    "<skill-name>": "<source-specifier>"
  }
}
```

Each key is the local name used to invoke the skill. Each value is a [source specifier](/reference/source-specifiers) describing where to fetch it from.

## Example

```json
{
  "name": "my-project",
  "agentskills": {
    "git-workflow":   "github:anthropics/agent-skills/skills/git-workflow",
    "code-review":    "github:anthropics/agent-skills/skills/code-review",
    "api-docs":       "file:./team-skills/api-documentation",
    "shared-linting": "git+https://github.com/myorg/skills.git#v2.1.0"
  }
}
```

## Team Sharing

Commit `package.json` to your repository. Any team member (or CI agent) runs:

```bash
agentskills install
```

...and gets exactly the same skills, at the same versions, from the same sources.

The lock file (`.agentskills/skills.lock`) pins exact resolved versions — like `package-lock.json` for skills. Commit the lock file too for fully reproducible installs.

## Skills Directory

Installed skills land in `.agentskills/skills/`. Add it to `.gitignore` (created automatically on first install):

```
.agentskills/skills/
```

Each skill is stored as:

```
.agentskills/skills/
  git-workflow/
    SKILL.md
  code-review/
    SKILL.md
```

## MCP Server Dependencies

Skills can declare which MCP servers they require. Install with dependency validation:

```bash
agentskills install --agent claude
```

Or auto-install missing MCP servers:

```bash
agentskills install --with-mcp --agent cline
```

See [MCP Server Dependencies](/reference/mcp-dependencies) for how to declare these in a skill's frontmatter.
