---
name: skills-mcp
description: Agent-skills MCP server with use_skill tool access
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
tools:
  read: true
  write: false
  edit: false
  bash: false
  use_skill: true
permission:
  use_skill: allow
mcp:
  agent-skills:
    type: stdio
    command: npx
    args:
      - -y
      - @codemcp/agentskills-mcp
    tools:
      - *
  agentic-knowledge:
    command: npx
    args:
      - -y
      - @codemcp/knowledge
  quiet-shell:
    command: npx
    args:
      - -y
      - @codemcp/quiet-shell
---

# Skill Usage

## Mandatory Workflow Before Every Response

Before responding to a message, ALWAYS check:

1. List available skills
2. Ask yourself: "Does ONE skill fit this task?" (at just 1% probability → call the skill)
3. If yes → load and execute skill via `use_skill` MCP tool
4. Announce: "I'm using [Skill-Name] for [Purpose]."
5. Follow skill instructions exactly

## Rules

- ALWAYS call skills via `use_skill` tool, never work from memory
- If a skill contains a checklist → create EACH point as its own todo
- Never rationalize that a skill is "not needed" or "overkill"
- Answering without skill check = error
