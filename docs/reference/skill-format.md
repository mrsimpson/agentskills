# SKILL.md Format

A skill is a directory containing a `SKILL.md` file. The file uses YAML frontmatter for metadata and Markdown for the instruction body.

```
my-skill/
  SKILL.md          # Required
  scripts/          # Optional supporting files
  references/       # Optional reference documents
  assets/           # Optional static assets
```

## Structure

````markdown
---
name: my-skill
description: A one-line summary of what this skill does
# ... additional fields
---

# My Skill

Instruction body in Markdown. This is what the agent receives
when it calls `use_skill`.
````

## Frontmatter Fields

### Required

| Field | Type | Description |
|---|---|---|
| `name` | string | Unique identifier (lowercase, hyphens allowed) |
| `description` | string | Short summary shown in tool descriptions |

### Standard Optional Fields

| Field | Type | Description |
|---|---|---|
| `license` | string | SPDX license identifier, e.g. `MIT` |
| `compatibility` | string | Agent compatibility string |
| `metadata` | object | Arbitrary key-value metadata |
| `allowedTools` | string[] | Tools this skill is permitted to use |

### Claude Code Extensions

| Field | Type | Description |
|---|---|---|
| `disableModelInvocation` | boolean | If `true`, skill is excluded from `use_skill` enum |
| `userInvocable` | boolean | If `true`, skill is designed for direct user invocation |
| `argumentHint` | string | Hint shown to users about expected arguments |
| `context` | string | Execution context hint |
| `agent` | string | Target agent identifier |
| `model` | string | Preferred model for this skill |
| `hooks` | object | Lifecycle hook definitions |
| `requiresMcpServers` | array | MCP server dependencies (see [MCP Server Dependencies](/reference/mcp-dependencies)) |

## Argument Placeholders

The server returns skill content with placeholders intact. The agent is responsible for substitution:

| Placeholder | Meaning |
|---|---|
| `$ARGUMENTS` | All arguments as a space-separated string |
| `$1`, `$2`, … | Individual arguments by position (1-indexed) |
| `${SESSION_ID}` | Session identifier (agent provides) |
| `` !`command` `` | Dynamic command to execute (flagged, not executed by server) |

## Example

```markdown
---
name: summarize-pr
description: Summarize a pull request for a code review
argumentHint: "<pr-url>"
---

# Summarize Pull Request

Fetch and summarize the pull request at $1.

Focus on:
- What changed and why
- Potential risks
- Suggested review focus areas
```

## Validation Rules

Run `agentskills validate <path>` to check a skill file. Errors block installation; warnings are advisory.

**Errors** (must fix):
- Missing `name` or `description`
- Invalid name format or length
- Malformed YAML frontmatter

**Warnings** (recommended):
- Short description (aim for clarity)
- Very long body content (aim for < 5000 tokens)
