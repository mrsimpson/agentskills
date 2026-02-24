# Development Plan: agent-skills (fix-name-folder-inconsistency branch)

_Generated on 2026-02-24 by Vibe Feature MCP_
_Workflow: [bugfix](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/bugfix)_

## Goal

Fix the skill installation issue where providing a custom name that differs from the actual skill name causes server startup failure. When running `agentskills add ppt github:anthropics/skills/skills/pptx`, the server fails with: "Directory name 'ppt' does not match skill name 'pptx'". Need to adapt path and folder handling during skill extraction.

## Reproduce

<!-- beads-phase-id: agent-skills-5.1 -->

### Tasks

_Tasks managed via `bd` CLI_

## Analyze

<!-- beads-phase-id: agent-skills-5.2 -->

### Phase Entrance Criteria:

- [ ] The bug has been successfully reproduced
- [ ] The exact error conditions and workflow are documented
- [ ] The relevant code paths have been identified

### Tasks

_Tasks managed via `bd` CLI_

## Fix

<!-- beads-phase-id: agent-skills-5.3 -->

### Phase Entrance Criteria:

- [ ] Root cause has been identified
- [ ] Impact and side effects have been analyzed
- [ ] Solution approach has been determined

### Tasks

_Tasks managed via `bd` CLI_

## Verify

<!-- beads-phase-id: agent-skills-5.4 -->

### Phase Entrance Criteria:

- [ ] The fix has been implemented
- [ ] Code changes have been completed
- [ ] Solution addresses the root cause

### Tasks

_Tasks managed via `bd` CLI_

## Finalize

<!-- beads-phase-id: agent-skills-5.5 -->

### Phase Entrance Criteria:

- [ ] The fix has been verified to work
- [ ] Tests pass successfully
- [ ] No regressions have been introduced

### Tasks

- [ ] Squash WIP commits: `git reset --soft <first commit of this branch>. Then, Create a conventional commit. In the message, first summarize the intentions and key decisions from the development plan. Then, add a brief summary of the key changes and their side effects and dependencies

_Tasks managed via `bd` CLI_

## Key Decisions

### Solution Analysis

**Option 1: Remove the validation check in registry.ts**

- Pros: Quick fix, allows custom folder names
- Cons: Breaks the design principle that folder name should match skill name; could cause confusion; lookups in registry use skill name not folder name

**Option 2: Always use the actual skill name from SKILL.md as folder name (ignore custom name)**

- Pros: Maintains consistency, simple implementation
- Cons: User-provided name would be ignored; might break existing installations if users rely on custom names

**Option 3: Use actual skill name as folder but store mapping for custom aliases**

- Pros: Best user experience, maintains consistency
- Cons: More complex, requires changing config format

**Option 4: Use actual skill name from SKILL.md but allow it as an override when installing**

- Pros: Best balance of simplicity and consistency
- Cons: Requires two-pass installation (install to temp, read SKILL.md, move to final location)

**Recommended Solution: Option 2** - Always use the actual skill name from SKILL.md as the folder name

- The `name` parameter in `agentskills add` becomes just a key for package.json
- The actual folder name is determined by parsing SKILL.md during installation
- This ensures consistency and prevents the validation error
- Registry lookups will work correctly since they use the skill name from SKILL.md

### Implementation Plan

1. Modify `installer.ts:install()` to:
   - Extract to a temp directory first
   - Parse SKILL.md to get the actual skill name
   - Use the actual skill name (from SKILL.md) as the final folder name
   - The `name` parameter still used as the key in package.json/config
2. Update `installer.ts:extractManifest()` to be callable before final installation
3. Keep the validation in `registry.ts` unchanged (it's correct behavior)

### Implementation Details

- Modified `installer.ts` to extract skills to a temporary directory first
- After extraction, SKILL.md is parsed to get the actual skill name
- The skill is then moved from the temp location to a directory named after the actual skill name
- Added fallback logic for rename operation (copy + remove) in case of cross-device errors
- Updated test `skill-installer.test.ts` to reflect new behavior where directory name matches skill name from SKILL.md
- All 234 tests pass successfully

## Notes

### Bug Reproduction

**Command:** `agentskills add ppt github:anthropics/skills/skills/pptx`

**Expected:** Skill should install with custom name "ppt" and server should start successfully

**Actual:** Server fails to start with error:

```
Directory name 'ppt' does not match skill name 'pptx' in /path/.agentskills/skills/ppt/SKILL.md
```

### Code Analysis

**Root Cause:**

1. `installer.ts:install()` accepts a `name` parameter that becomes the directory name (line 88)
2. `registry.ts:loadSkills()` validates that directory name matches the skill name from SKILL.md (lines 123-128)
3. When custom name differs from actual skill name, validation fails

**Relevant Files:**

- `/packages/core/src/installer.ts` - Handles skill installation, uses `name` param as folder name
- `/packages/core/src/registry.ts` - Loads skills and validates directory name matches skill metadata
- `/packages/cli/src/commands/add.ts` - CLI command that calls installer

---

_This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management._
