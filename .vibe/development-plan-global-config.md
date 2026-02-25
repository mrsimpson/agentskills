# Development Plan: Global Configuration Support

_Generated on 2026-02-25 by Vibe Feature MCP_
_Workflow: [epcc](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/epcc)_

## Goal

Add global configuration support to the agentskills MCP server. Skills should be configurable both locally (project-level) and globally (system-level), with local configuration taking precedence over global configuration. CLI commands should accept `-g/--global` flags to manage global skills.

## Explore

<!-- beads-phase-id: global-config-1.1 -->

### Phase Entrance Criteria:

- N/A (Initial phase)

### Research Areas:

- Current package.json configuration approach and PackageConfigManager implementation
- Standard system configuration directories per platform (XDG, macOS, Windows)
- How other tools (npm, git, etc.) handle global vs local configuration
- Precedence/merging strategies for multi-level configuration

### Key Questions:

- Where should global package.json be stored on different platforms?
- How should local and global skills be merged (replace, union, explicit override)?
- Should global config support both `agentskills` and `agentskillsConfig` fields?
- What CLI commands need `-g/--global` support?
- How should the MCP server discover and load both configurations?

### Tasks

_Tasks managed via `bd` CLI_

## Plan

<!-- beads-phase-id: global-config-1.2 -->

### Phase Entrance Criteria:

- [ ] Research on system configuration directories is complete
- [ ] Configuration precedence strategy is decided
- [ ] Current codebase structure is understood
- [ ] Alternatives have been evaluated and trade-offs documented
- [ ] User workflows for global vs local configuration are clear

### Deliverables:

- Implementation plan with affected components
- Configuration file locations for each platform
- API changes to PackageConfigManager or new ConfigurationManager
- CLI command changes (which commands get `-g/--global`)
- Merge/precedence logic specification
- Migration strategy (if needed)

### Tasks

_Tasks managed via `bd` CLI_

## Plan Implementation Strategy

### Overview

Add global configuration support by introducing a second package.json location at `<globalConfigDir>/package.json`. The system will load and merge configurations from both locations, with local (project) configuration taking precedence over global configuration.

### Component Changes

#### 1. **New: Global Configuration Path Resolution** (`packages/core/src/global-config-paths.ts`)

**Purpose**: Platform-specific resolution of global configuration directory

**Implementation**:

- Use `env-paths` npm library for cross-platform path resolution
- Export function `getGlobalConfigDir(): string`
- Platform-specific paths:
  - Linux: `~/.config/agentskills-mcp`
  - macOS: `~/.config/agentskills-mcp` (CLI-style)
  - Windows: `%APPDATA%\agentskills-mcp`

**API**:

```typescript
export function getGlobalConfigDir(): string;
export function getGlobalPackageJsonPath(): string;
```

#### 2. **Enhanced: PackageConfigManager** (`packages/core/src/package-config.ts`)

**Current Behavior**: Loads config from single project-relative package.json

**New Behavior**: Load and merge configs from both global and local package.json

**Changes**:

- Add optional `scope` parameter to constructor: `"local" | "global" | "merged"` (default: `"merged"`)
- Add new method: `loadGlobalConfig(): Promise<PackageConfig>`
- Add new method: `loadMergedConfig(): Promise<PackageConfig>`
- Update `source` tracking to include both global and local paths when merged
- Add merge logic: local skills override global skills, local config overrides global config

**API Changes**:

```typescript
constructor(projectRoot: string, scope?: "local" | "global" | "merged")
async loadGlobalConfig(): Promise<PackageConfig>
async loadMergedConfig(): Promise<PackageConfig>
// Modify existing methods to respect scope:
async addSkill(name: string, spec: string): Promise<void> // uses scope
async removeSkill(name: string): Promise<void> // uses scope
async saveSkills(skills: Record<string, string>): Promise<void> // uses scope
```

**Merge Logic**:

```
merged.skills = { ...global.skills, ...local.skills }
merged.config = { ...global.config, ...local.config }
merged.source = { type: "merged", global: globalPath, local: localPath }
```

#### 3. **CLI Command Updates**

All commands get optional `-g/--global` flag to target global configuration.

**`add` command** (`packages/cli/src/commands/add.ts`):

- Add `--global` flag option
- When `--global`: use `PackageConfigManager` with `scope: "global"`
- Update success message to indicate which config was modified

**`list` command** (`packages/cli/src/commands/list.ts`):

- Add `--global` flag option
- When `--global`: show only global skills
- Default (no flag): show merged view with indicators for source (global vs local vs both)
- Display format:
  ```
  ✓ skill-name (local)
  ✓ global-skill (global)
  ✓ both-skill (local, global)
  ```

**`install` command** (`packages/cli/src/commands/install.ts`):

- Add `--global` flag option
- When `--global`: install only global skills to global directory
- Default (no flag): install merged skills (both global and local)
- Skills installed to their respective directories based on source

#### 4. **MCP Server Updates** (`packages/mcp-server/src/index.ts` or bin)

**Current Behavior**: Loads config from project directory only

**New Behavior**: Automatically load merged config (global + local)

**Changes**:

- Use `PackageConfigManager` with default `scope: "merged"`
- Load skills from both global and local directories
- No special flags needed - always loads both when available

#### 5. **Type Updates** (`packages/core/src/types.ts`)

**Changes to `PackageConfig` type**:

```typescript
export interface PackageConfig {
  skills: Record<string, string>;
  config: { ... };
  source: {
    type: "file" | "defaults" | "merged";
    path?: string;
    globalPath?: string; // Added for merged configs
    localPath?: string;  // Added for merged configs
  };
}
```

### Testing Strategy

#### Unit Tests:

1. `global-config-paths.test.ts` - Test path resolution on different platforms (mock `process.platform`)
2. `package-config.test.ts` updates:
   - Test `loadGlobalConfig()` with global package.json
   - Test `loadMergedConfig()` with both configs present
   - Test precedence: local overrides global
   - Test scope parameter behavior
   - Test adding/removing skills to global config

#### Integration Tests:

1. CLI command tests with `--global` flag
2. End-to-end tests with both global and local configs
3. MCP server tests loading merged configs

#### Test Scenarios:

- Global config exists, local doesn't
- Local config exists, global doesn't
- Both configs exist (test merging and precedence)
- Neither config exists (use defaults)
- Same skill in both configs (local wins)
- Global config directory doesn't exist (create on write)

### Dependencies

**New npm package**:

- `env-paths@^3.0.0` - Cross-platform config directory resolution

### Migration Considerations

**Backward Compatibility**:

- ✅ Fully backward compatible - existing users see no behavior change
- ✅ Local-only configs continue working exactly as before
- ✅ No breaking API changes - only additions

**User Impact**:

- Users can optionally start using global config with `--global` flag
- No migration required for existing projects
- Global config is opt-in

### Edge Cases

1. **Permission errors**: Global config directory might not be writable
   - Solution: Clear error message, suggest checking permissions
2. **Concurrent modifications**: Multiple processes modifying same config
   - Solution: Document as limitation (same as npm/git behavior)
3. **Very large configs**: Many skills in global config
   - Solution: Performance targets remain <2s for 100 skills (same as current)

4. **Cross-platform**: User moves project between OS
   - Solution: Global config is per-machine (expected behavior)

### Implementation Order

1. **Phase 1 - Core Infrastructure**:
   - Add `env-paths` dependency
   - Create `global-config-paths.ts` with tests
   - Update types to support merged configs

2. **Phase 2 - Config Manager**:
   - Add `loadGlobalConfig()` method
   - Add `loadMergedConfig()` method
   - Update existing methods to respect scope parameter
   - Write comprehensive tests

3. **Phase 3 - CLI Commands**:
   - Update `add` command with `--global` flag
   - Update `list` command with `--global` flag and merged display
   - Update `install` command with `--global` flag
   - Update command tests

4. **Phase 4 - MCP Server**:
   - Update server to use merged config by default
   - Test end-to-end skill loading from both sources

5. **Phase 5 - Documentation**:
   - Update README with global config examples
   - Document CLI flag usage
   - Add troubleshooting guide

### Success Criteria

- [ ] `env-paths` dependency added and working
- [ ] Global config paths resolve correctly on all platforms
- [ ] `PackageConfigManager` supports scope parameter
- [ ] Global config can be read and written
- [ ] Merged config properly combines global and local with correct precedence
- [ ] `agentskills add --global` adds to global config
- [ ] `agentskills list --global` shows global skills
- [ ] `agentskills list` shows merged view with source indicators
- [ ] `agentskills install --global` installs global skills
- [ ] `agentskills install` installs both global and local skills
- [ ] MCP server loads skills from both global and local configs
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No breaking changes to existing API

<!-- beads-phase-id: global-config-1.3 -->

### Phase Entrance Criteria:

- [ ] Detailed implementation plan with component breakdown is complete
- [ ] Configuration file locations are finalized for all platforms
- [ ] API design is documented (function signatures, parameters)
- [ ] Testing strategy is defined
- [ ] No open design questions remain

### Implementation Areas:

- System configuration directory resolution (platform-specific)
- PackageConfigManager enhancements or new multi-level config manager
- CLI command updates with `-g/--global` flag support
- Configuration merging logic (local precedence over global)
- MCP server integration
- Tests for all scenarios

### Tasks

_Tasks managed via `bd` CLI_

## Commit

<!-- beads-phase-id: global-config-1.4 -->

### Phase Entrance Criteria:

- [ ] All code is implemented and working
- [ ] All tests pass (unit, integration, e2e)
- [ ] Code is linted and formatted
- [ ] Documentation is updated (README, API docs)
- [ ] Feature is manually tested in real scenarios

### Tasks

- [ ] Run all tests and ensure they pass
- [ ] Update README and documentation
- [ ] Create git commit with conventional commit message
- [ ] Verify no breaking changes or document them

_Tasks managed via `bd` CLI_

## Key Decisions

## Key Decisions

### Global Configuration Support - Planning Complete

**Planning Date**: 2026-02-25
**Status**: ✅ Planning complete, ready for implementation

**Implementation Strategy Summary**:

- **5 core components** to modify: global-config-paths, PackageConfigManager, CLI commands, MCP server, types
- **17 tasks created** with dependencies tracked via beads CLI (agent-skills-6 through agent-skills-22)
- **Backward compatible** - no breaking changes, purely additive feature
- **Library**: Use `env-paths@^3.0.0` for cross-platform config directory resolution

**Component Breakdown**:

1. **Core Infrastructure** (P0): env-paths dependency, global-config-paths module, type updates
2. **Config Manager** (P0-P1): Scope parameter, global loading, merging, write operations
3. **CLI Commands** (P2): --global flag for add, list, install commands
4. **MCP Server** (P2): Merged config loading by default
5. **Tests & Docs** (P1-P3): Comprehensive test coverage and documentation

**Task Dependencies**:

- Phase 1 tasks (agent-skills-6,7,8,9,10) are foundational
- Phase 2 builds on Phase 1 (agent-skills-11,12,13,14)
- Phase 3 builds on Phase 2 (agent-skills-15,16,17,18)
- Phase 4 runs in parallel with Phase 3 (agent-skills-19,20)
- Final tasks wrap everything up (agent-skills-21,22)

**Ready for Code Phase**: All entrance criteria met, detailed implementation plan documented.

### Global Configuration Support - Exploration Findings

**Research Date**: 2026-02-25
**Status**: Research complete, ready for planning

**Research Areas Completed:**

1. **Current Implementation Analysis**:
   - `PackageConfigManager` is currently project-scoped only (takes `projectRoot` in constructor)
   - All CLI commands (`add`, `install`, `list`) default to `process.cwd()`
   - Configuration is read from `<projectRoot>/package.json`
   - MCP server also defaults to `process.cwd()` for project directory
   - No global configuration support exists currently

2. **Cross-Platform Configuration Directory Standards**:
   - **Linux**: Use XDG Base Directory spec - `$XDG_CONFIG_HOME/agentskills-mcp` (default: `~/.config/agentskills-mcp`)
   - **macOS**: Two approaches evaluated:
     - OS-native: `~/Library/Preferences/agentskills-mcp` (config) + `~/Library/Application Support/agentskills-mcp` (data)
     - CLI-style (RECOMMENDED): `~/.config/agentskills-mcp` for consistency with Linux/containers
   - **Windows**: `%APPDATA%\agentskills-mcp` for config (roaming)
   - **Library recommendation**: Use `env-paths` npm package for cross-platform resolution

3. **Configuration Precedence Examples from Major Tools**:
   - **npm**: CLI flags > env vars > project .npmrc > user .npmrc > global npmrc > defaults
   - **git**: repo config > user config > system config (later configs override earlier)
   - **yarn**: Project .yarnrc.yml merged with parent directory configs, env vars override all
   - **Consensus pattern**: Local/project config overrides user/global config

4. **Recommended Approach**:
   - Global config location: Use `env-paths` library for cross-platform resolution
   - Local config: Current behavior (`<projectRoot>/package.json`)
   - Precedence: **Local overrides Global** (standard CLI tool behavior)
   - Merge strategy: Merge `agentskills` (skills) as union with local overrides, merge `agentskillsConfig` with local overrides
   - CLI flag: Add `-g/--global` to `add`, `install`, `list` commands

5. **Commands Requiring `-g/--global` Support**:
   - `agentskills add <name> <spec> --global` - Add skill to global config
   - `agentskills list --global` - List global skills
   - `agentskills install --global` - Install global skills to global directory
   - Note: `validate` command doesn't need global support (validates files directly)

**Design Decisions (User Confirmed)**:

1. **MCP Server behavior**: Automatically load both global and local skills when both exist
2. **Opt-out mechanism**: No `--no-global` flag needed - simple behavior
3. **Global skills directory**: Uses same `skillsDirectory` config field from global package.json (defaults to `.agentskills/skills` relative to global config dir)
4. **Conflict resolution**: Project package.json has precedence over global package.json
   - When same skill name exists in both: local spec wins
   - When same config field exists in both: local value wins
   - Simple override semantics, no complex merging

**Scope Clarification**:

- This change is **ONLY about package.json location** (adding `<globalConfigDir>/package.json` alongside existing `<projectRoot>/package.json`)
- Global package.json contains same fields: `agentskills` (skill declarations) and `agentskillsConfig` (settings)
- Skills from global config are installed relative to global config directory
- Skills from local config are installed relative to project root (existing behavior)

## Key Decisions

### Package.json + Pacote for Skill Management (MAJOR REVISION)

**Decision Date**: 2026-02-20
**Status**: Replacing path-based config with declarative package management

**The Problem**: Initial design used `.agentskills/config.yaml` to configure **paths** to scan for skills. This was wrong - we should declare **skills as dependencies** (like package.json), not paths.

**The Solution**: Use `package.json` with `agentskills` field + npm's Pacote library

```json
{
  "agentskills": {
    "api-integration": "github:anthropic/api-integration#v1.0.0",
    "database-query": "git+https://github.com/org/db-skill.git",
    "local-skill": "file:./skills/custom"
  },
  "agentskillsConfig": {
    "autoDiscover": [".claude/skills"]
  }
}
```

**Benefits**:

- Reuse npm's battle-tested infrastructure (Pacote)
- Familiar format for developers (package.json)
- Native multi-source support (git, local, future npm registry)
- Version locking with `.agentskills/skills-lock.json`
- No reimplementing package management

**Implementation**:

- Skills installed to `.agentskills/skills/` (like node_modules)
- `agentskills install` downloads all declared skills via Pacote
- `autoDiscover` for backwards compatibility with `.claude/skills`
- Priority: installed skills > auto-discovered (prevent double-loading)

**Changes Required**:

- Delete current ConfigManager (path-based)
- New SkillInstaller using Pacote
- New ConfigManager reading package.json
- Registry loads from `.agentskills/skills/` + auto-discover paths
- Update all tests

### Adopt Agent Skills Open Standard

- Agent Skills (agentskills.io) is an open format developed by Anthropic and adopted by 20+ tools
- Provides standardized SKILL.md format with YAML frontmatter + Markdown body
- Supported by: Claude Code, Cursor, GitHub Copilot, VS Code, Gemini CLI, and many others
- Enables true cross-platform skill portability

### MCP as Distribution Mechanism

- Model Context Protocol provides standardized interface for tools, resources, and prompts
- Any MCP-compatible agent can use the server without modification
- Expands Agent Skills ecosystem beyond tools with native support
- Huge existing ecosystem: 400+ MCP servers already exist

### Tool-First Architecture for Discovery

**Key Decision**: Expose skills primarily as an MCP **tool** with enum parameter, not just resources

- **Why**: Tools with enum parameters are auto-discoverable; resources require active scanning
- **Approach**: Single `invoke_skill` tool with skill names as enum values
- **Benefit**: Agent sees all skills + descriptions in single tool introspection
- **Response**: Returns processed instructions + metadata about scripts/references/assets
- **Resources**: Still used for accessing file contents (scripts, references, assets) on-demand
- **Result**: Better UX - agents discover and invoke skills in one interaction

### No Server-Side Execution (Security by Design)

**Critical Decision**: MCP server does NOT execute any commands or scripts

- **Why**: Security, simplicity, and separation of concerns
- **Approach**: Server only parses and returns skill instructions/content
- **Agent Responsibility**: Agent decides what to execute based on skill instructions
- **Benefits**:
  - No security risks from untrusted skills
  - No need for sandboxing or allow/deny lists
  - Simpler server implementation
  - Follows agentic-knowledge pattern
- **Trade-off**: Dynamic context injection (!`command`) returns raw commands, not executed results

### Monorepo Architecture (CLI + MCP Server)

**Key Decision**: Use monorepo structure with separate packages (following agentic-knowledge pattern)

- **Packages**:
  - `cli`: Command-line tool for skill management (create, validate, list, etc.)
  - `mcp-server`: MCP server exposing skills to agents
  - `core` (optional): Shared types, parsers, utilities
- **Why**:
  - Clean separation of concerns
  - CLI can be used independently for skill development
  - MCP server focuses on MCP protocol integration
  - Shared code reduces duplication
- **Build System**: pnpm workspaces + Turbo for efficient builds

### Core Value Propositions

1. **Cross-Platform Portability**: Skills work across any MCP-compatible agent (Claude Desktop, Cline, Continue, etc.)
2. **Leverage Existing Ecosystem**: 20+ tools already support Agent Skills format
3. **Progressive Disclosure**: Smart context management (description → full skill → supporting files)
4. **Enterprise-Ready**: Version control, sharing, and standardization for organizational knowledge
5. **Developer-Friendly**: Simple markdown format, validation tools, open standard

### Scope Definition

**In Scope (MVP):**

1. **MCP Server Core**:
   - Primary: Expose `invoke_skill` tool with enum parameter for all discovered skills
   - Tool response includes: processed instructions + metadata about scripts/references/assets
   - Secondary: Expose skill files as MCP resources for on-demand content access
   - List/discover available skills via tool parameter introspection
2. **Agent Skills Standard Support**:
   - Parse SKILL.md with YAML frontmatter
   - Support required fields: name, description
   - Support optional fields: license, compatibility, metadata, allowed-tools
   - Support Claude Code extensions: disable-model-invocation, user-invocable, argument-hint, context, agent, model, hooks
3. **Invocation Control** (Claude Code feature):
   - Respect `disable-model-invocation` flag (exclude from enum if true)
   - Respect `user-invocable` flag (mark in tool metadata)
   - Filter skills based on frontmatter flags
4. **Argument Handling** (Claude Code feature):
   - String substitution: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`
   - Session ID substitution: `${CLAUDE_SESSION_ID}` (if available from MCP context)
   - Process substitutions before returning skill content
5. **Dynamic Context Injection** (Claude Code feature):
   - Parse `` !`command` `` syntax in skill content
   - Return commands to agent for execution (NOT executed by server)
   - Agent decides whether to execute and inject results
   - Server just returns raw instructions with placeholders
6. **Skill Discovery**:
   - Load from standard locations: .claude/skills/, ~/.claude/skills/
   - Support custom directories via configuration
   - Nested directory discovery for monorepos
   - Priority ordering (if configured): enterprise > personal > project
   - Watch for changes (hot reload)
7. **Supporting Files**:
   - Access scripts/, references/, assets/ directories
   - Expose as additional resources
   - File reference resolution (relative paths)
8. **Integration**:
   - TypeScript/Node.js implementation using @modelcontextprotocol/sdk-typescript
   - Configuration via JSON or environment variables
   - Compatible with Claude Desktop and other MCP clients

**Out of Scope (Future Enhancements):**

- Subagent execution (`context: fork`) - MCP doesn't have subagent concept
- Hooks system - needs MCP protocol extension
- Model selection (`model` field) - client responsibility
- Remote skill repositories (GitHub, npm packages)
- Skill marketplace/registry
- Command execution by server (intentionally out of scope - agent handles this)
- Skill composition (skills calling other skills)
- Web UI for skill management
- Skill analytics/telemetry
- Multi-language support (Python SDK version)
- Skills as MCP prompts (may add later, focusing on tools/resources first)
- Integration with skills-ref validation in server runtime
- Plugin namespace support (plugin-name:skill-name)

**Technical Constraints:**

- Skills must follow Agent Skills open standard + Claude Code extensions
- Read-only access to skill files (no modifications via MCP)
- Skills validated at load time, not runtime
- Maximum skill size: 5000 tokens for main SKILL.md (recommendation from spec)
- Dynamic command injection security controlled by configuration

### Implementation Strategy

**Monorepo Template:** Using ~/projects/templates/typescript-monorepo as foundation

- Pre-configured: ESLint, Prettier, Husky (pre-commit hooks), Turbo, Vitest, TypeScript
- Includes: .husky/, .github/, tsconfig hierarchy, turbo.json, lint-staged
- Packages: Will create @agentskills/core, @agentskills/cli, @agentskills/mcp-server

**Implementation Order:**

1. Core package first (SkillParser → SkillValidator → SkillRegistry → etc)
2. MCP server depends on core SkillRegistry
3. CLI depends on core validation/discovery
4. Tests after each component (unit → integration → e2e)

**MVP Constraints:**

- No file watching - load skills on startup only
- Local directories only - git repos in future
- Integration tests priority (real MCP protocol)

**Task Management:**

- 21 implementation tasks created in agent-skills-1.4 (Code phase)
- Dependencies mapped (monorepo setup → core → mcp-server/cli → tests)
- Ready to proceed to implementation

### Planning Phase Research Summary

**Completed Research:**

1. **Claude Code Skills Management Patterns** (from Agent Skills ecosystem):
   - Progressive disclosure: metadata (100 tokens) → full skill (<5000 tokens) → resources (on-demand)
   - Standard locations: `.claude/skills/`, `~/.claude/skills/`, custom directories
   - skills-ref CLI tool: validate, read-properties, to-prompt (XML generation)
   - No package manager - git repos and manual distribution
   - Skill structure: SKILL.md + optional scripts/, references/, assets/
2. **Recommended CLI Commands** (inspired by skills-ref + enhancements):
   - `agentskills create <name>` - Create new skill from template
   - `agentskills validate [path]` - Validate skill format
   - `agentskills list [--json]` - List discovered skills
   - `agentskills info <skill-name>` - Show detailed skill info
   - `agentskills to-prompt [paths...]` - Generate XML prompt (compatibility with Claude)
   - `agentskills config init/list/set` - Configuration management
   - Phase 2: `install/update/search` for remote skills

3. **Integration Testing Strategy** (from agentic-knowledge):
   - Minimal mocking philosophy - test real MCP protocol interactions
   - E2E tests with stdio transport (real subprocess)
   - Temporary file systems for isolation
   - Single-threaded execution to avoid resource conflicts
   - Test at multiple levels: E2E (protocol), integration (server), unit (core)
   - Vitest with separate configs: base + e2e
   - Test utilities: createTestProject(), createMCPClient(), cleanup patterns

4. **Key Design Decisions**:
   - **Config file format**: Similar to agentic-knowledge, support skill sources (local/git)
   - **No file watching in MVP**: Load skills on startup only (simplifies v1.0)
   - **Core registry first**: In-memory skill index, foundational for CLI and MCP server
   - **Integration tests priority**: Test real MCP protocol, not mocked interfaces

### Architecture Phase Summary

**Completed**: Architecture phase finished with comprehensive C4 documentation (880 lines).

**Key Architectural Outcomes**:

1. **Monorepo Structure**: 3 packages (@agentskills/core, @agentskills/cli, @agentskills/mcp-server)
2. **No Execution Security Model**: Server only returns instructions, never executes code
3. **Tool-First API**: invoke_skill tool with enum parameter for auto-discovery
4. **In-Memory Registry**: Fast skill access with hot reload using chokidar
5. **Tech Stack**: TypeScript + pnpm workspaces + Turbo + MCP SDK + js-yaml

**Architecture Document Includes**:

- C4 Level 1 (Context): System overview, users, external systems, boundaries
- C4 Level 2 (Container): 3-package structure, dependencies, deployment
- C4 Level 3 (Component): Detailed components for each package with interfaces
- Architecture Decision Records (ADRs): 5 key decisions documented
- Technology Choices: Comprehensive stack with rationale
- Quality Attributes: Performance (<100ms), security (no execution), reliability
- Enhancement Roadmap: Phases 2-4 for future features

## Notes

### Target Users & Use Cases

**Primary Users:**

1. **AI Agent Developers**: Building MCP-compatible agents that need skill support
2. **Skill Authors**: Writing skills once, deploying across multiple platforms
3. **Enterprise Teams**: Sharing organizational knowledge and workflows
4. **Open Source Community**: Contributing to skill libraries

**Key Use Cases:**

1. **Skill Discovery**: Browse available skills from local/remote repositories
2. **Dynamic Loading**: Load skills on-demand based on task context
3. **Skill Execution**: Run skills with arguments, access supporting files
4. **Cross-Platform Sharing**: Use same skill in Claude Desktop, Cline, Continue, etc.
5. **Enterprise Distribution**: Central skill repositories for teams/organizations
6. **Plugin System**: Extend agents without modifying their core

### Success Criteria

- [ ] Any MCP-compatible agent can discover and use Agent Skills
- [ ] Skills can be loaded from multiple locations (.claude/skills, ~/.claude/skills, custom dirs)
- [ ] Full support for Agent Skills core spec (name, description, license, compatibility, metadata, allowed-tools)
- [ ] Support for Claude Code extensions (disable-model-invocation, user-invocable, argument-hint, context, agent, model, hooks frontmatter)
- [ ] String substitution works: $ARGUMENTS, $ARGUMENTS[N], $N, ${CLAUDE_SESSION_ID}
- [ ] Dynamic context injection: !`command` syntax executes and injects output
- [ ] Progressive disclosure: Description available immediately, full content on invocation
- [ ] Supporting files (scripts/, references/, assets/) accessible as resources
- [ ] Hot reload: File changes detected and skills reloaded
- [ ] Performance: Skills indexed on startup, <100ms discovery latency
- [ ] Security: Command execution configurable with allow/deny lists
- [ ] Compatible with standard MCP clients (Claude Desktop, Cline, Continue)
- [ ] Clear documentation with examples
- [ ] Working example skills demonstrating all features

### Agent Skills Format Key Points

- **Directory structure**: Skill is a folder with SKILL.md at root
- **Frontmatter fields**: name (required), description (required), license, compatibility, metadata, allowed-tools
- **Progressive disclosure**: Description (~100 tokens) → Full SKILL.md (<5000 tokens) → Referenced files (on demand)
- **Optional directories**: scripts/, references/, assets/ for supporting files
- **Validation**: skills-ref CLI tool for validation

### MCP Ecosystem Research

- **Official MCP servers repository**: github.com/modelcontextprotocol/servers
- 400+ third-party MCP servers already exist
- Common patterns: TypeScript SDK, Python SDK, clear tool definitions
- Reference servers: filesystem, git, memory, fetch, sequential-thinking
- Strong ecosystem momentum: companies building official integrations

### Research Findings

- Agent Skills already has broad adoption (20+ tools)
- Standard focuses on portability and progressive disclosure
- Skills can include executable scripts in any language
- Reference library exists for validation: github.com/agentskills/agentskills
- Example skills available: github.com/anthropics/skills
- MCP has massive adoption with 400+ existing servers

---

_This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management._
