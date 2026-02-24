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

_Important decisions will be documented here as they are made_

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
