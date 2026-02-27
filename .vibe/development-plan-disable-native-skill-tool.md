# Development Plan: agent-skills (disable-native-skill-tool branch)

_Generated on 2026-02-23 by Vibe Feature MCP_
_Workflow: [epcc](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/epcc)_

## Goal

Enhance the agent-skills MCP server generator to automatically disable the native OpenCode `skill` tool when generating the tool description JSON. This will prevent conflicts between the native skill tool and our custom `agentskills_use_skill` MCP tool.

## Explore

<!-- beads-phase-id: agent-skills-4.1 -->

### Tasks

_Tasks managed via `bd` CLI_

## Plan

<!-- beads-phase-id: agent-skills-4.2 -->

### Phase Entrance Criteria:

- [x] The codebase structure is understood (generator scripts, output format)
- [x] Current tool description generation mechanism is identified
- [x] OpenCode's permission/tool disabling mechanism is understood
- [x] The conflict between native `skill` tool and `agentskills_use_skill` is confirmed

### Implementation Strategy

**File to Modify:**

- `packages/core/src/mcp-config-adapters.ts` - specifically the `OpenCodeConfigAdapter.toClient()` method

**Change Details:**

1. In the `toClient()` method (lines 84-108), add a `permission` field to the output config
2. The permission field should be: `{ "skill": "deny" }`
3. This should be added at the root level of the config object, alongside `$schema` and `mcp`

**Implementation Steps:**

1. Modify `toClient()` to include permission field
2. Add unit tests in `__tests__/mcp-config-manager.test.ts` for the OpenCode adapter
3. Update integration tests to verify the permission field appears in generated `opencode.json`

**Expected Output Format:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "skill": "deny"
  },
  "mcp": {
    "agentskills": {
      "type": "local",
      "command": [...],
      "enabled": true,
      "environment": {}
    }
  }
}
```

**Edge Cases Considered:**

- Preserving existing permission fields if they exist in `existingConfig`
- Ensuring the skill permission is always set to "deny" even if other permissions exist
- Backward compatibility: existing configs without permissions should still work

### Tasks

_Tasks managed via `bd` CLI_

## Code

<!-- beads-phase-id: agent-skills-4.3 -->

### Phase Entrance Criteria:

- [ ] Implementation approach is clearly defined
- [ ] File modifications needed are identified
- [ ] Output format for tool description with permission denial is designed
- [ ] Edge cases and validation approach are documented

### Tasks

_Tasks managed via `bd` CLI_

## Commit

<!-- beads-phase-id: agent-skills-4.4 -->

### Phase Entrance Criteria:

- [ ] All code changes are implemented and working
- [ ] Generated tool description includes `skill: deny` permission
- [ ] Manual testing confirms the native skill tool is disabled
- [ ] No regression in existing functionality

### Tasks

- [ ] Squash WIP commits: `git reset --soft <first commit of this branch>. Then, Create a conventional commit. In the message, first summarize the intentions and key decisions from the development plan. Then, add a brief summary of the key changes and their side effects and dependencies

_Tasks managed via `bd` CLI_

## Key Decisions

**Decision 1: Where to Add Permission Configuration**

- The `permission` field must be added at the **root level** of `opencode.json`, not inside the MCP server config
- This is because OpenCode's config schema has permissions at the top level, separate from the MCP servers
- Format: `{ "permission": { "skill": "deny" }, "mcp": { ... } }`

**Decision 2: Implementation Location**

- Modify `OpenCodeConfigAdapter.toClient()` method in `packages/core/src/mcp-config-adapters.ts`
- This adapter is responsible for converting our standard config to OpenCode's format
- It already handles the `$schema` field and `mcp` section, so we'll add the `permission` section there

**Decision 3: Configuration Approach**

- Always add `{ "permission": { "skill": "deny" } }` when generating OpenCode configs
- This ensures our custom `agentskills_use_skill` MCP tool doesn't compete with the native skill tool
- Keep it simple: unconditionally add this permission (no configuration option needed)

## Notes

### Exploration Findings

**Generator Structure:**

- MCP server tool description is generated in `packages/mcp-server/src/server.ts` in the `getToolDescription()` method (lines 204-221)
- Tool is registered in the `registerHandlers()` method (lines 89-116)
- Current description format: instructions + list of skills with descriptions

**OpenCode Config Structure:**

- Config file: `opencode.json` at project root
- Format managed by `OpenCodeConfigAdapter` in `packages/core/src/mcp-config-adapters.ts`
- Current structure:
  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
      "agentskills": {
        "type": "local",
        "command": [...],
        "enabled": true,
        "environment": {}
      }
    }
  }
  ```

**OpenCode Permission System:**

- Permissions are defined at the **root level** of `opencode.json`, not within the MCP server config
- Permission schema in OpenCode includes `skill: PermissionRule` (line 656 of config.ts)
- Permission actions: "ask" | "allow" | "deny"
- Permission can be a single action OR an object with pattern matching

**Key Insight:**

- The native `skill` tool can be disabled by adding a root-level `permission` field to `opencode.json`
- This is separate from the MCP server configuration
- Example format:
  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "permission": {
      "skill": "deny"
    },
    "mcp": { ... }
  }
  ```

### Implementation Results

**Changes Made:**

1. Modified `OpenCodeConfigAdapter.toClient()` in `packages/core/src/mcp-config-adapters.ts`
   - Added `permission` field to type definition (line 86)
   - Added logic to merge existing permissions and always set `skill: "deny"` (lines 93-96)
   - Added explanatory comment about preventing conflicts

2. Added 3 new unit tests in `packages/core/src/__tests__/mcp-config-manager.test.ts`
   - Test that permission.skill: deny is added to new configs
   - Test that existing permissions are preserved
   - Test that skill permission is overridden to deny even if set to something else

**Test Results:**

- All 234 tests in core package pass ✓
- All 173 tests in CLI package pass ✓
- Manual verification confirms generated opencode.json includes permission field ✓

**Verified Output:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "skill": "deny"
  },
  "mcp": {
    "agentskills": {
      "type": "local",
      "command": ["npx", "-y", "@codemcp/skills-mcp"],
      "enabled": true,
      "environment": {}
    }
  }
}
```

**OpenCode Permission System:**

- Permissions are defined at the **root level** of `opencode.json`, not within the MCP server config
- Permission schema in OpenCode includes `skill: PermissionRule` (line 656 of config.ts)
- Permission actions: "ask" | "allow" | "deny"
- Permission can be a single action OR an object with pattern matching

**Key Insight:**

- The native `skill` tool can be disabled by adding a root-level `permission` field to `opencode.json`
- This is separate from the MCP server configuration
- Example format:
  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "permission": {
      "skill": "deny"
    },
    "mcp": { ... }
  }
  ```

---

_This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management._
