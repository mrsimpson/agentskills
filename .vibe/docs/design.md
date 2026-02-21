<!--
DESIGN DOCUMENT TEMPLATE - FREESTYLE APPROACH

PURPOSE: Document design principles and standards in your preferred format.
NOTE: Technology stack decisions belong in the Architecture Document, not here.

DESIGN FOCUS AREAS:
✅ Design principles and patterns that guide implementation
✅ Naming conventions and coding standards
✅ Component design approaches and boundaries
✅ Data modeling and design principles
✅ Quality attribute design strategies (performance, security, etc.)
❌ NO Technology stack choices (goes in Architecture doc)
❌ NO Concrete class names or implementations
❌ NO Code snippets or method signatures

TIERED APPROACH SUGGESTION:
Start with core design principles, add complexity as project grows.
Consider organizing by: Essential → Core → Advanced → Specialized sections.

EXAMPLES:
✅ GOOD: "Repository pattern abstracts data access with clean interfaces"
✅ GOOD: "Components follow single responsibility principle with clear boundaries"
✅ GOOD: "Error handling uses custom exception hierarchy for different failure types"
❌ BAD: "PaymentController.processPayment() validates and processes transactions"
❌ BAD: "UserService extends BaseService and implements AuthService interface"

IMPORTANT: DO NOT REMOVE THIS COMMENT HOW TO USE THE TEMPLATE!
-->

# Design Document

## Architecture Reference

See [Architecture Document](./architecture.md) for high-level system context and architecture decisions such as chosen technologies and frameworks.

<!-- Here goes your freestyle design -->

## Design Principles

### Core Philosophy

1. **Fail-Fast Validation**: Detect invalid configurations and skills at load time, not during runtime
2. **Immutability After Load**: Skills become immutable once loaded (restart to refresh in MVP)
3. **Declarative Configuration**: Follow package manager patterns (npm, yarn) for skill dependencies
4. **Clear Boundaries**: Configuration loading, parsing, and registry management are independent concerns
5. **Progressive Enhancement**: Start with local sources; designed for future remote sources
6. **Client Responsibility**: Server provides raw data; client handles interpolation and execution

### Error Handling

**Philosophy**: Surface errors early, clearly, and with actionable context. No silent failures.

**Principles**:
- **Graceful Degradation**: Individual skill failures don't block loading other skills
- **Rich Context**: Include file paths, field names, and expected vs actual values
- **Actionable Messages**: Distinguish user errors (fixable) from system errors (log/monitor)
- **Structured Results**: Severity levels (error/warning/info) with clear reporting
- **Early Detection**: Configuration validation happens before any operations

### Validation Approach

**Timing**:
- Configuration: At load time before operations
- Skills: During discovery and parsing
- Arguments: At invocation by consuming agent (NOT server responsibility)

**Layers**:
1. Schema validation (types, required fields, formats)
2. Semantic validation (business rules, cross-field constraints)
3. Content validation (sizes, token counts, security checks)

**Modes**: Strict (default), Permissive (warnings allowed), Development (verbose diagnostics)

### Performance Strategy

**MVP Approach**:
- Load-on-startup only (no file watching in MVP)
- Single-pass directory traversal
- In-memory caching for instant access
- Read-once configuration

**Key Optimizations**:
- Lazy loading of supporting files (scripts, references, assets)
- Parallel file I/O where possible
- Stream-based frontmatter extraction
- Map-based O(1) lookups
- ~1KB per skill memory footprint

**Targets**: <2s cold start for 100 skills

## Configuration Design

### Rationale

**Philosophy**: Use familiar package manager patterns. Skills are dependencies, not ad-hoc file paths.

**Key Decisions**:
1. Use `package.json` with `agentskills` field (familiar to developers)
2. Skills are **declared dependencies**, not paths to scan
3. Use Pacote library for installation (battle-tested, supports git/local/tarball/npm)
4. Skills installed to `.agentskills/skills/` (like node_modules)
5. Generate lock file for reproducibility (`.agentskills/skills-lock.json`)
6. Support auto-discovery for backwards compatibility (`.claude/skills`)

### Package.json Format

**Skills Declaration** (like dependencies):
```json
{
  "agentskills": {
    "api-integration": "github:anthropic/api-integration#v1.0.0",
    "database-query": "git+https://github.com/org/db-skill.git#main",
    "local-custom": "file:./skills/my-skill",
    "future-registry": "@agentskills/common@^1.0.0"
  },
  "agentskillsConfig": {
    "skillsDirectory": ".agentskills/skills",
    "autoDiscover": [".claude/skills"],
    "maxSkillSize": 5000,
    "logLevel": "info"
  }
}
```

**Source Types** (via Pacote):
- **Git repos**: `github:user/repo#tag`, `git+https://...`
- **Local paths**: `file:./path/to/skill`
- **npm registry** (future): `@scope/skill@^1.0.0`
- **Tarballs**: `https://example.com/skill.tgz`

### Installation Workflow

**Commands**:
```bash
# Install all declared skills (like npm install)
agentskills install

# Add a new skill (updates package.json + installs)
agentskills add github:anthropic/api-skill

# List installed and discovered skills
agentskills list

# Validate skills
agentskills validate [path]
```

**Directory Structure**:
```
.agentskills/
  skills/                    # Installed skills (like node_modules)
    api-integration/
      SKILL.md
      scripts/
    database-query/
      SKILL.md
  skills-lock.json          # Lock file (versions, integrity)
  cache/                    # Pacote cache
```

### Discovery Strategy

**Load Order** (prevents double-loading):
1. **Installed skills**: Read from `.agentskills/skills/` (declared in package.json)
2. **Auto-discovered**: Scan paths from `autoDiscover` config (e.g., `.claude/skills`)
3. **Priority**: Installed wins over auto-discovered if same name

**Default Behavior** (no package.json):
- Auto-discover from `.claude/skills/`, `~/.claude/skills/`
- No installed skills
- Zero-config startup works

**With package.json**:
- Install declared skills to `.agentskills/skills/`
- Also scan auto-discover paths
- Installed skills take precedence

### Lock File

**Purpose**: Reproducible skill installations (like package-lock.json)

**Schema**:
```json
{
  "version": "1.0",
  "skills": {
    "api-integration": {
      "resolved": "github:anthropic/api-integration#v1.0.0",
      "integrity": "sha512-...",
      "source": "git",
      "commitHash": "abc123..."
    },
    "database-query": {
      "resolved": "file:./skills/db-query",
      "source": "local"
    }
  }
}
```

## SkillRegistry Design

### Responsibilities

The SkillRegistry is the **in-memory skill repository** providing the foundation for CLI and MCP operations.

**Core Concerns**:
1. Skill loading from configured sources
2. In-memory storage with efficient access
3. Skill retrieval by name, metadata, or filters
4. Conflict resolution across multiple sources
5. Lifecycle management (init, cleanup)

**Out of Scope**:
- File watching/hot reload (future v1.1+, not in MVP)
- Skill execution (agent responsibility)
- String interpolation (agent responsibility)
- Resource file management (separate ResourceHandler)
- Configuration management (ConfigLoader handles)

### Key Patterns

**Access Patterns**:
- O(1) lookup by skill name (primary use case)
- Metadata-only queries for listing (avoid loading full content)
- Filter by source, compatibility, or custom criteria
- State inspection for monitoring

**Immutability**:
- Skills frozen after load (no accidental mutation)
- Return copies, not internal collections
- Explicit restart required for changes in MVP
- Safe concurrent read access

**Storage Strategy**:
- Map-based for O(1) lookups
- Separate metadata cache (lightweight)
- Source index for conflict tracking
- State object for observability

### Conflict Resolution

**Rules**:
1. **First Source Wins**: Load order determines priority (installed → auto-discovered)
2. **Log Conflicts**: Warn when duplicate names found
3. **Track Source**: Metadata records which source provided each skill
4. **User Control**: Reorder sources in config to change precedence

**Example**: If `installed` and `.claude/skills` both have "api-integration", installed version loads and .claude version logs warning.

### Loading Flow

**Phases**:
1. Parse and validate configuration from package.json
2. Discover installed skills in `.agentskills/skills/`
3. Discover auto-discovered skills in configured paths
4. Parse each SKILL.md file into skill object
5. Register skills (apply conflict resolution)
6. Run semantic validation
7. Build metadata cache and indexes

**Discovery Rules**:
- Recursive traversal of source directories
- Look for exactly `SKILL.md` (case-sensitive)
- Ignore hidden directories except `.claude/` and `.agentskills/`
- Skip symlinks (prevent loops)
- Note supporting directories but don't parse yet

**Error Handling**:
- Individual failures don't block other skills (graceful degradation)
- Source access errors skip source, continue with others
- Parse errors skip skill, log details, continue
- System errors (OOM, FS failure) fail fast

### Data Model

**Skill Object**: Full parsed representation with frontmatter fields, raw content (no interpolation), source tracking, and parse metadata

**SkillMetadata**: Lightweight version for discovery/listing without full content

**Filters**: Query by source, compatibility, license, user-invocability, content length, name pattern

**LoadResult**: Structured outcome with success/failure counts, per-source details, errors/warnings, timing

**State**: Current registry status (count, load time, sources, errors, memory usage)

See [Architecture Document](./architecture.md) for detailed schemas.

## String Interpolation Design

### Server Responsibilities

**IMPORTANT**: The MCP server does NOT perform string interpolation. This is the client's responsibility.

**Server Behavior**:
- Return raw skill content with placeholders intact ($ARGUMENTS, $1, $2, etc.)
- Include metadata about detected placeholders
- Flag skills containing dynamic commands (`` !`command` ``)
- Document placeholder syntax in tool descriptions

**Client Responsibilities**:
- Parse placeholder syntax ($ARGUMENTS, $N)
- Substitute arguments provided by user
- Handle session variables (${CLAUDE_SESSION_ID})
- Execute dynamic commands if appropriate
- Sanitize interpolated values

### Placeholder Syntax

**Standard Placeholders** (client implements):
- `$ARGUMENTS` → all arguments as space-separated string
- `$N` (e.g., `$1`, `$2`) → individual argument by index (1-indexed)
- `$ARGUMENTS[N]` → alternative syntax for individual argument
- `${CLAUDE_SESSION_ID}` → session identifier (client provides)

**Dynamic Commands** (flagged by server):
- `` !`command` `` → flag for dynamic execution (server returns raw, client decides if/how to execute)

### Security Considerations

**Why Client-Side**:
- Server never executes untrusted content
- Client has full context for safe interpolation
- Client can sanitize/validate arguments before substitution
- Clear security boundary

**Client Best Practices**:
- Validate argument types and formats
- Escape special characters for target context (shell, SQL, etc.)
- Limit dynamic command execution to trusted skills
- Log interpolation actions for audit

## Integration Patterns

### CLI Usage

**Pattern**: Short-lived registry per command execution
- Initialize fresh registry for each command
- Full reload acceptable (commands are quick)
- No state management needed
- Simple validation and display workflows

**Where to Look**: `src/cli/` for command implementations

### MCP Server Usage

**Pattern**: Long-lived registry for server lifetime
- Initialize once at startup
- Log initialization results for monitoring
- Use for all tool handler requests
- Return raw content without interpolation
- MVP: Restart server to pick up changes
- Future (v1.1+): Explicit reload mechanism or file watching

**Where to Look**: `src/mcp/server.ts` for integration, tool handlers use registry

## Future Enhancements

### Hot Reload (v1.1)

**Principles**:
- Watch source directories with file system events
- Debounce to avoid reload storms
- Incremental updates (only reload changed files)
- Notify MCP clients of changes
- Atomic updates (swap registry only after successful reload)

**Not in MVP**: Requires file watching infrastructure, reload coordination, and client notification protocol.

### Remote Sources (v1.2)

**Principles**:
- Already supported via Pacote (git, npm, tarball)
- Version management and update checking
- Cache invalidation strategies
- Integrity verification with lock file

**Mostly Implemented**: Core installation works, need update commands and cache management.

### Advanced Filtering (v1.3)

**Principles**:
- Full-text search across content
- Tag-based categorization
- User-defined metadata schemas
- Faceted filtering
- Saved filter presets

---

*This design document focuses on principles and patterns. For implementation details and schemas, see the [Architecture Document](./architecture.md).*
