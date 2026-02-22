---
name: example-skill
description: A local example skill for demonstration purposes
license: MIT
requires-mcp-servers:
  - name: filesystem
    package: "@modelcontextprotocol/server-filesystem"
    description: "Required for reading and writing files in the workspace"
    command: npx
    args:
      ["-y", "@modelcontextprotocol/server-filesystem", "{{WORKSPACE_PATH}}"]
    parameters:
      WORKSPACE_PATH:
        description: "Root directory for file access"
        required: true
        default: "."
---

# Example Skill

This is a local example skill that demonstrates the Agent Skills format.

## Usage

This skill can be referenced locally using:

```bash
agentskills add example-skill file:./local-skills/example-skill
```

## Features

- Simple skill format
- Easy to understand
- Works with agentskills CLI
