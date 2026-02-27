# Development Plan: agent-skills (integration branch)

_Generated on 2026-02-27 by Vibe Feature MCP_
_Workflow: [epcc](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/epcc)_

## Goal

Bring in MCP server dependency installation from colleague's branch (`origin/claude/add-macos-dependencies-fZV06`) and integrate it with the `mcp setup` command on the `integration` branch.

A utility compiles the full set of MCP servers required by installed skills (via `requires-mcp-servers` frontmatter), diffs them against what's already configured for each agent, and writes only the **missing** ones — without touching existing server configs.

## Explore

<!-- beads-phase-id: agent-skills-7.1 -->

### Findings

**Colleague's branch** (`origin/claude/add-macos-dependencies-fZV06`) has one relevant commit on top of our `integration` branch HEAD (`2d10707`):

- `0e4660b` — `feat(cli): configure requires-mcp-servers skill deps during mcp setup`

**Changes in that commit (4 files):**

1. `types.ts` — adds `McpParameterSpec`, `McpServerDependency` interfaces + `requiresMcpServers` field to `Skill`
2. `skills.ts` — `parseSkillMd` extracts `requires-mcp-servers` frontmatter into `requiresMcpServers`
3. `mcp-skill-deps.ts` (new file) — `loadInstalledSkillMcpDeps` + `configureSkillMcpDepsForAgents`
4. `mcp.ts` — both TUI and CLI paths call the new helpers after configuring successfully

**Key design decisions in colleague's implementation:**

- Diff logic: if `config.mcpServers[dep.name]` exists → skip (only checks presence, not config — matches our requirement)
- Parameter resolution: `{{PARAM_NAME}}` placeholders, with `{{ENV:VAR}}` for env-var defaults, interactive prompt for required params without defaults
- Parameters resolved once, applied to all agents
- Uses `getAgentConfigPath` + `readAgentConfig` + `writeAgentConfig` from `mcp-configurator.ts` (already on integration)
- Uses `discoverSkills` + `getCanonicalSkillsDir` + `getMCPCanonicalSkillsDir` (all present on integration)

**What we need to do:**

- Cherry-pick commit `0e4660b` onto `integration` (it has no conflicts since integration doesn't have this file)
- Run tests to verify everything passes
- The implementation is already correct — no redesign needed

### Phase Entrance Criteria (Plan):

- [x] The colleague's branch and its diff has been fully understood
- [x] All touched files on integration branch have been read
- [x] It's clear what's in scope (cherry-pick + verify) and out of scope

## Plan

<!-- beads-phase-id: agent-skills-7.2 -->

### Approach

Cherry-pick `0e4660b` from colleague's branch onto `integration`. The commit is self-contained and conflict-free relative to our current HEAD.

**Steps:**

1. Cherry-pick `0e4660b` onto `integration`
2. Run the full test suite
3. Fix any type errors or test failures

### Phase Entrance Criteria (Code):

- [x] Plan is clear and approved
- [x] Approach is well-defined

## Code

<!-- beads-phase-id: agent-skills-7.3 -->

### Tasks

- [ ] Cherry-pick `0e4660b` onto `integration`
- [ ] Run test suite and fix any failures

### Phase Entrance Criteria (Commit):

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] The diff/install behavior matches the requirement (only checks presence, not config)

## Commit

<!-- beads-phase-id: agent-skills-7.4 -->

### Tasks

- [ ] Create a conventional commit with intent, key changes, and side effects

## Key Decisions

- **Don't redesign** — colleague's implementation already matches the spec: presence-only diff (no config comparison), parameter resolution with env-var defaults, interactive prompts for required params
- **Cherry-pick** the commit as-is rather than reimplementing

## Notes

- The `mcp-skill-deps.ts` file does NOT exist yet on `integration` — clean cherry-pick expected
- `getCanonicalSkillsDir` and `getMCPCanonicalSkillsDir` are already available in `installer.ts`
- `readAgentConfig` / `writeAgentConfig` / `getAgentConfigPath` already in `mcp-configurator.ts`

---

_This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management._
