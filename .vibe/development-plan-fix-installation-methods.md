# Development Plan: agent-skills (fix-installation-methods branch)

_Generated on 2026-02-21 by Vibe Feature MCP_
_Workflow: [bugfix](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/bugfix)_

## Goal

Fix the CLI bug where `npx @codemcp/skills@latest add jugendsprache github://mrsimpson/skill-jugendsprache.git` fails with "pacote.extract is not a function" error after successfully adding to package.json.

## Reproduce

<!-- beads-phase-id: agent-skills-3.1 -->

### Tasks

_Tasks managed via `bd` CLI_

## Analyze

<!-- beads-phase-id: agent-skills-3.2 -->

### Phase Entrance Criteria:

- [ ] The bug has been successfully reproduced
- [ ] Relevant code and error context have been identified
- [ ] The exact conditions causing the failure are documented

### Tasks

_Tasks managed via `bd` CLI_

## Fix

<!-- beads-phase-id: agent-skills-3.3 -->

### Phase Entrance Criteria:

- [ ] Root cause of the bug has been identified
- [ ] Impact and scope of the fix are understood
- [ ] Solution approach has been determined

### Tasks

_Tasks managed via `bd` CLI_

## Verify

<!-- beads-phase-id: agent-skills-3.4 -->

### Phase Entrance Criteria:

- [ ] Code changes have been implemented
- [ ] The fix addresses the root cause
- [ ] No new issues have been introduced

### Tasks

_Tasks managed via `bd` CLI_

## Finalize

<!-- beads-phase-id: agent-skills-3.5 -->

### Tasks

- [ ] Squash WIP commits: `git reset --soft <first commit of this branch>. Then, Create a conventional commit. In the message, first summarize the intentions and key decisions from the development plan. Then, add a brief summary of the key changes and their side effects and dependencies

_Tasks managed via `bd` CLI_

## Key Decisions

### Analysis Results (2026-02-21)

**Affected Files**:

1. `packages/core/src/installer.ts` - Main file using `import * as pacote from "pacote"`
2. `packages/core/src/__tests__/skill-installer.test.ts` - Test file with pacote mocks

**Type Definitions**:

- Using `@types/pacote@11.1.8`
- Type definitions export functions as **named exports**: `export function extract(...)`
- This causes a **mismatch** between runtime (default export) and types (named exports)

**Solution Approach**:

- Change from `import * as pacote from "pacote"` to `import pacote from "pacote"`
- This uses the default export which contains all methods: `extract`, `manifest`, etc.
- Type definitions should still work because TypeScript will use the default export types
- Update test mocks to match the new import style

## Notes

### Bug Reproduction (2026-02-21)

**Confirmed Issue**: The error `pacote.extract is not a function` occurs because of incorrect import syntax for pacote v21.3.1.

**Root Cause**:

- Current code uses: `import * as pacote from "pacote"`
- This gives access to: `DirFetcher`, `FileFetcher`, `GitFetcher`, `RegistryFetcher`, `RemoteFetcher`, `default`
- But `extract` and `manifest` methods are NOT available as named exports

**Working Import Style**:

- Use: `import pacote from "pacote"` (default import)
- This provides access to: `extract`, `manifest`, `packument`, `resolve`, `tarball`, and fetcher classes

**Impact**:

- Affects `packages/core/src/installer.ts` which uses `pacote.extract()` and `pacote.manifest()`
- Affects test files that mock pacote

**Test Evidence**: Created `packages/core/test-pacote-import.mjs` demonstrating the issue

### Verification Results (2026-02-21)

**Tests Passed**:

- ✓ TypeScript build completes without errors
- ✓ All 284 tests pass in core package (including 32 skill-installer tests)
- ✓ pacote.extract and pacote.manifest are now accessible
- ✓ No "pacote.extract is not a function" error occurs

**Changes Made**:

1. `packages/core/src/installer.ts`: Changed to `import pacote from "pacote"`
2. `packages/core/src/__tests__/skill-installer.test.ts`: Updated mock to `{ default: { extract: vi.fn(), manifest: vi.fn() } }`

**Side Effects**: None - this is a pure import fix with no functional changes

### Additional Improvements Made (2026-02-22)

**CLI Help Fix**:

- Added `.showHelpAfterError()` to `add` command
- Now `add --help` works correctly and shows full help text
- Error messages now include hint: "(add --help for additional information)"

**Better Error Messages for Invalid Specs**:

- Detect common mistakes like `github://` (should be `github:`) and `git://` (should be `git+https://`)
- Provide corrected suggestion: "Did you mean: github:user/repo"
- Direct users to `--help` for full list of supported formats (DRY principle)
- Early validation rejects `github://` and `git://` before they reach pacote

**Example Error Output**:

```
✗ jugendsprache failed: Invalid spec format: "github://mrsimpson/skill-jugendsprache.git"
Did you mean: github:mrsimpson/skill-jugendsprache

Run 'agentskills add --help' to see supported spec formats
```

**Git Repos Without package.json (Critical Fix)**:

- **Problem**: Pacote requires package.json in all repos, but skill repos may only have SKILL.md
- **Solution**: Implement git clone fallback when pacote fails with "Could not read package.json"
- **Version Handling**: Use git commit hash as version (e.g., `7917369`)
- **Integrity**: Store full commit hash in lock file (e.g., `git:7917369e7f867d70310d25ea200e9aa803a969bb`)
- **Cleanup**: Remove `.git` directory after clone to save space
- **Applies to**:
  - `github:user/repo` specs
  - `git+https://` and `git+ssh://` specs
  - Direct `https://github.com/...` URLs
  - Any git URL from github.com, gitlab.com, or bitbucket.org

**Example Lock File Entry**:

```json
{
  "jugendsprache": {
    "spec": "github:mrsimpson/skill-jugendsprache",
    "resolvedVersion": "7917369",
    "integrity": "git:7917369e7f867d70310d25ea200e9aa803a969bb"
  }
}
```

✗ jugendsprache failed: Invalid spec format: "github://mrsimpson/skill-jugendsprache.git"
Did you mean: github:mrsimpson/skill-jugendsprache

Run 'agentskills add --help' to see supported spec formats

```

---

_This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management._
```
