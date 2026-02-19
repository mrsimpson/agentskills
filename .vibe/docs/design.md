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
2. **Immutability After Load**: Skills become immutable once loaded until explicit reload
3. **Declarative Configuration**: Follow patterns from tools like agentic-knowledge and package managers
4. **Clear Boundaries**: Configuration loading, parsing, and registry management are independent concerns
5. **Progressive Enhancement**: Start with local sources; design for future remote sources

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
- Arguments: At invocation by consuming agent (not server responsibility)

**Layers**:
1. Schema validation (types, required fields, formats)
2. Semantic validation (business rules, cross-field constraints)
3. Content validation (sizes, token counts, security checks)

**Modes**: Strict (default), Permissive (warnings allowed), Development (verbose diagnostics)

### Performance Strategy

**MVP Approach**:
- Load-on-startup only (no file watching)
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

Inspired by **agentic-knowledge's `.knowledge/config.yaml`** pattern for consistency and familiarity.

**Key Decisions**:
1. Support both JSON and YAML formats
2. Prefer directory-based config (`.agentskills/`) over root files for organization
3. Enable multiple skill sources with priority-based conflict resolution
4. Design for future extensibility (remote sources, caching)
5. Provide init/download workflow similar to docsets

### File Discovery

**Search Order** (first match wins):
1. `.agentskills/config.yaml` (recommended)
2. `.agentskills/config.json`
3. `.agentskills.yaml` (root alternative)
4. `.agentskills.json` (root alternative)
5. Default configuration (if none found)

**Rationale**: Keep project root clean while allowing simpler alternatives

### Schema Overview

For detailed schema, see [Architecture Document](./architecture.md).

**Core Concepts**:
- **Version field**: Enable future schema migrations
- **Sources array**: Ordered list with priority (first wins in conflicts)
- **Source types**: Local directories (MVP), git repos (future), npm packages (future)
- **Enable/disable**: Control sources without removing configuration
- **Settings**: Global behavior controls (validation mode, token limits, security)

**Source Priority**: Sources load in order; first occurrence of skill name wins

### Init/Download Workflow (Future)

**Pattern**: Add source to config → Initialize/download → Enable in config

Similar to agentic-knowledge docsets: configure first, download separately, explicit enable step.

**Cache Management**: Store remote sources in `.agentskills/cache/`, auto-add to `.gitignore`

### Default Behavior

**Zero-Config Startup**: When no config file exists, defaults to:
- `.claude/skills` (project)
- `~/.claude/skills` (global)
- Strict validation mode
- Standard security settings

## SkillRegistry Design

### Responsibilities

The SkillRegistry is the **in-memory skill repository** providing the foundation for CLI and MCP operations.

**Core Concerns**:
1. Skill loading from configured sources
2. In-memory storage with efficient access
3. Skill retrieval by name, metadata, or filters
4. Conflict resolution across multiple sources
5. Lifecycle management (init, refresh, cleanup)

**Out of Scope**:
- File watching/hot reload (v1.1+)
- Skill execution (agent responsibility)
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
- Explicit reload required for changes
- Safe concurrent read access

**Storage Strategy**:
- Map-based for O(1) lookups
- Separate metadata cache (lightweight)
- Source index for conflict tracking
- State object for observability

### Conflict Resolution

**Rules**:
1. **First Source Wins**: Configuration order determines priority
2. **Log Conflicts**: Warn when duplicate names found
3. **Track Source**: Metadata records which source provided each skill
4. **User Control**: Reorder sources in config to change precedence

**Example**: If `project` and `global` both have "api-integration", project version loads and global version logs warning.

### Loading Flow

**Phases**:
1. Parse and validate configuration
2. Discover all SKILL.md files per source
3. Parse each file into skill object
4. Register skills (apply conflict resolution)
5. Run semantic validation
6. Build metadata cache and indexes

**Discovery Rules**:
- Recursive traversal of source directories
- Look for exactly `SKILL.md` (case-sensitive)
- Ignore hidden directories except `.claude/`
- Skip symlinks (prevent loops)
- Note supporting directories but don't parse yet

**Error Handling**:
- Individual failures don't block other skills (graceful degradation)
- Source access errors skip source, continue with others
- Parse errors skip skill, log details, continue
- System errors (OOM, FS failure) fail fast

### Data Model

**Skill Object**: Full parsed representation with frontmatter fields, content, source tracking, and parse metadata

**SkillMetadata**: Lightweight version for discovery/listing without full content

**Filters**: Query by source, compatibility, license, user-invocability, content length, name pattern

**LoadResult**: Structured outcome with success/failure counts, per-source details, errors/warnings, timing

**State**: Current registry status (count, load time, sources, errors, memory usage)

See [Architecture Document](./architecture.md) for detailed schemas.

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
- Build dynamic tool schemas from metadata
- MVP: Restart server to pick up changes
- Future: Explicit reload mechanism

**Where to Look**: `src/mcp/server.ts` for integration, tool handlers use registry

## Future Enhancements

### Hot Reload (v1.1)

**Principles**:
- Watch source directories with file system events
- Debounce to avoid reload storms
- Incremental updates (only reload changed files)
- Notify MCP clients of changes
- Atomic updates (swap registry only after successful reload)

### Remote Sources (v1.2)

**Principles**:
- Git repositories with local caching
- npm package sources
- HTTP endpoint sources
- Version management and update checking
- Cache invalidation strategies

### Advanced Filtering (v1.3)

**Principles**:
- Full-text search across content
- Tag-based categorization
- User-defined metadata schemas
- Faceted filtering
- Saved filter presets

---

*This design document focuses on principles and patterns. For implementation details and schemas, see the [Architecture Document](./architecture.md).*
