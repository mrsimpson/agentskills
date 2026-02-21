# Development Plan: agent-skills (include-mcp branch)

_Generated on 2026-02-21 by Vibe Feature MCP_
_Workflow: [epcc](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/epcc)_

## Goal

Implement the ability for skill authors to declare MCP server dependencies in SKILL.md frontmatter, allowing users to understand what additional servers they need to configure for a skill to work properly.

## Explore

<!-- beads-phase-id: agent-skills-2.1 -->

### Tasks

_Tasks managed via `bd` CLI_

## Plan

<!-- beads-phase-id: agent-skills-2.2 -->

### Phase Entrance Criteria:

- [ ] The skill structure and SKILL.md format have been thoroughly explored
- [ ] Current implementation of skill loading and metadata parsing is understood
- [ ] Use cases for MCP server dependencies are documented
- [ ] Technical approach options have been evaluated

### Tasks

_Tasks managed via `bd` CLI_

## Code

<!-- beads-phase-id: agent-skills-2.3 -->

### Phase Entrance Criteria:

- [ ] Implementation plan is clearly defined with specific tasks
- [ ] Design decisions for frontmatter schema are documented
- [ ] Files to be modified are identified
- [ ] Test strategy is defined

### Tasks

_Tasks managed via `bd` CLI_

## Commit

<!-- beads-phase-id: agent-skills-2.4 -->

### Phase Entrance Criteria:

- [ ] All code changes are complete and tested
- [ ] Documentation is updated (if applicable)
- [ ] Changes work as expected for all use cases
- [ ] Code is ready for review

### Tasks

- [ ] Squash WIP commits: `git reset --soft <first commit of this branch>. Then, Create a conventional commit. In the message, first summarize the intentions and key decisions from the development plan. Then, add a brief summary of the key changes and their side effects and dependencies

_Tasks managed via `bd` CLI_

## Key Decisions

### 1. Dependency Declaration Format (2026-02-21)

**Decision:** REVISITED - Simple string array is insufficient.

**Key Insight from User:** Just storing server names like `"filesystem"` or `"postgres"` is not enough because we need to provide the **full MCP server specification** to the agent. The agent needs to know HOW to connect to these servers, not just their names.

**MCP Server Specification Requirements:**
An MCP server configuration typically includes:

- Server name/identifier
- Command to run the server
- Arguments/parameters
- Environment variables
- Working directory
- Possibly: connection type (stdio, SSE, etc.)

**Example from Claude Desktop config:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/allowed/files"
      ]
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://localhost/mydb"
      ],
      "env": {
        "PGPASSWORD": "secret"
      }
    }
  }
}
```

**OPEN QUESTION:** What format should we use in SKILL.md to capture this information?

**To be decided in Plan phase:**

- Should we embed full server specs in SKILL.md?
- Should we reference external server configs?
- Should we only declare names and expect users to configure separately?
- How do we handle sensitive data like passwords?

### 2. Implementation Scope (2026-02-21)

**Decision:** This feature is metadata-only - no runtime validation or enforcement.

**What it does:**

- Adds ability to declare MCP server dependencies in SKILL.md
- Parses and validates the field format
- Makes dependency information available to skill consumers

**What it doesn't do:**

- Check if declared servers are actually installed/available
- Prevent skill usage if dependencies are missing
- Automatically install or configure required MCP servers

**Rationale:**

- MCP server availability is environment-specific
- Skills are served via MCP, but server installation is a client concern
- Keeps implementation simple and focused on documentation/metadata

## Notes

### Current Frontmatter Schema (from types.ts)

The `SkillMetadata` interface currently supports:

**Required fields (Agent Skills standard):**

- `name`: string
- `description`: string

**Optional standard fields:**

- `license`: string
- `compatibility`: string
- `metadata`: Record<string, unknown>
- `allowedTools`: string[] (kebab-case: `allowed-tools`)

**Claude Code extensions:**

- `disableModelInvocation`: boolean (kebab-case: `disable-model-invocation`)
- `userInvocable`: boolean (kebab-case: `user-invocable`)
- `argumentHint`: string (kebab-case: `argument-hint`)
- `context`: string
- `agent`: string
- `model`: string
- `hooks`: Record<string, string>

**Field mapping:** The parser automatically converts kebab-case YAML fields to camelCase TypeScript fields using `FIELD_MAP` in parser.ts.

### Parsing Process

1. `parseSkillContent()` uses `gray-matter` library to extract YAML frontmatter
2. Required fields (`name`, `description`) are validated
3. Field names are mapped from kebab-case to camelCase via `mapFieldNames()`
4. Returns a frozen `Skill` object with `metadata` and `body`

### MCP Server Naming Conventions

Based on research and examples:

- MCP servers are typically identified by simple kebab-case names (e.g., `agentskills`, `filesystem`, `postgres`)
- NPM package names often use scoped format: `@scope/package-name` (e.g., `@codemcp/agentskills-mcp-server`)
- In Claude Desktop config, servers are referenced by simple identifiers in the `mcpServers` object
- Common MCP server examples: `filesystem`, `postgres`, `github`, `slack`, `google-drive`

**Proposed dependency format options:**

1. Simple string: `"filesystem"` - easiest for users
2. Object with optional metadata: `{ "name": "filesystem", "purpose": "file operations" }`
3. Array of strings: `["filesystem", "postgres"]` - supports multiple dependencies

### Agent Skills Standard Research Findings

**Official Specification Status:**

- ✅ Checked agentskills.io specification - **NO existing field** for MCP server dependencies
- ✅ Checked modelcontextprotocol.io - **NO skill dependency mechanism**
- ✅ Checked Anthropic Agent Skills examples - **NO dependency declarations found**

**Conclusion:** The `requires-mcp-servers` field is a **NEW extension** to the Agent Skills format, not part of the official standard. This is similar to `allowed-tools` which is marked as experimental.

**Existing Similar Fields:**

- `allowed-tools` - Space-delimited list for tool restrictions (experimental)
- `compatibility` - Free-text for environment requirements (but not structured/parseable)

**Our approach aligns with:**

- Existing codebase patterns (kebab-case → camelCase mapping)
- Array format like `allowedTools`
- Optional field pattern
- Future consideration: propose to agentskills.io as official standard extension

### Use Cases from GitHub Issue #2

1. **Skills that use file system operations** - need `filesystem` MCP server
2. **Skills that require web search** - need `brave-search`, `google-search`, or similar
3. **Skills that need database access** - need `postgres`, `mysql`, or similar
4. **Skills that depend on specialized tools** - need domain-specific MCP servers

**CRITICAL INSIGHT:** These skills don't just need to declare that they depend on an MCP server - they need to provide enough information for the agent to actually configure and use those servers.

### Solution Design Challenges (To Address in Plan Phase)

**Challenge 1: Full Server Specification Required**

- Agent needs: command, args, env vars, working directory
- Not just: server name

**Challenge 2: Portability vs. Specificity**

- Hardcoding paths/commands → not portable across systems
- Only declaring names → not actionable without manual config

**Challenge 3: Security Concerns**

- Passwords, API keys, credentials
- Should NOT be in version-controlled SKILL.md files
- Need separation of public config and secrets

**Challenge 4: Configuration Responsibility**

- Who configures the MCP servers? Skill author? End user? Client?
- How do we balance declarative vs. imperative approaches?

**Solution Options to Explore in Plan Phase:**

**Option A: Reference-based approach**

```yaml
requires-mcp-servers:
  - name: filesystem
    config-reference: "@modelcontextprotocol/server-filesystem"
    parameters:
      - "/path/to/workspace"
```

**Option B: Full specification embedded**

```yaml
requires-mcp-servers:
  - name: filesystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "${WORKSPACE}"]
```

**Option C: Hybrid - declare + template**

```yaml
requires-mcp-servers:
  - package: "@modelcontextprotocol/server-filesystem"
    description: "Provides file system access to workspace"
    template-args:
      - name: workspace_path
        description: "Path to allowed workspace"
        required: true
```

**Option D: Reference external server registry**

```yaml
requires-mcp-servers:
  - filesystem # Look up in known server registry
  - postgres # User must configure if not in registry
```

### Files Requiring Changes

**Core Package (`packages/core/src/`):**

1. **`types.ts`** - Add `requiresMcpServers?: string[]` to `SkillMetadata` interface
2. **`parser.ts`** - Add `"requires-mcp-servers": "requiresMcpServers"` to `FIELD_MAP`
3. **`validator.ts`** - Add validation for `requiresMcpServers` field (must be array of strings if present)

**Test Files:** 4. **`packages/core/src/__tests__/parser.test.ts`** - Add tests for parsing `requires-mcp-servers` field 5. **`packages/core/src/__tests__/validator.test.ts`** - Add tests for validating `requiresMcpServers` field 6. **`packages/core/src/__tests__/types.test.ts`** (if exists) - Add type tests

**Example/Demo Files:** 7. **`packages/demo/local-skills/example-skill/SKILL.md`** - Add example usage of new field

**Documentation (Optional but recommended):** 8. **`README.md`** - Update skill creation section to document new field

---

_This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management._
