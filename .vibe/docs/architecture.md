# System Architecture Documentation (C4 Model)

_This document follows the C4 model for software architecture documentation, focusing on Context, Container, and Component levels._

## 1. System Context (C4 Level 1)

### System Overview

**Agent Skills MCP Server** is a Model Context Protocol server that exposes Claude Code Agent Skills to any MCP-compatible AI agent (Claude Desktop, Cline, Continue, etc.). The system follows the Agent Skills open standard (agentskills.io) and acts as a bridge between skill authors and AI agents, enabling cross-platform skill portability without requiring native Agent Skills support in each tool.

**Key Principle**: The MCP server does NOT execute any code. It only discovers, parses, and returns skill instructions to agents, who decide what to execute.

### Users and Personas

- **AI Agents** (Primary): MCP-compatible agents (Claude Desktop, Cline, Continue) that invoke skills to accomplish user tasks
- **Skill Authors**: Developers creating Agent Skills in SKILL.md format for organizational knowledge, workflows, and best practices
- **Skill Users (via CLI)**: Developers managing, validating, and organizing skills using the CLI tool
- **Enterprise Teams**: Organizations sharing standardized workflows and knowledge through skill repositories

### External Systems

- **File System**: Skills stored in `.claude/skills/`, `~/.claude/skills/`, custom directories. Read-only access.
- **Agent Skills Ecosystem**: Integration with the open standard (20+ tools support, reference implementations)
- **MCP Clients**: Claude Desktop, Cline, Continue, and other MCP-compatible agents
- **Git Repositories** (future): Remote skill repositories for enterprise distribution

### System Boundaries

- **Inside the system**:
  - Skill discovery from file system (multiple locations, nested directories)
  - SKILL.md parsing (YAML frontmatter + Markdown body)
  - String interpolation ($ARGUMENTS, $N, ${CLAUDE_SESSION_ID})
  - MCP protocol integration (tools, resources)
  - CLI for skill management (create, validate, list)
  - Configuration management

- **Outside the system**:
  - Skill execution (agent responsibility)
  - Command execution (!`command` syntax - returned raw, not executed)
  - Model selection and prompt engineering
  - User authentication/authorization
  - Skill marketplace/registry
  - Remote repository hosting

### Context Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         External Systems                             │
│                                                                       │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │ Claude       │   │ Cline        │   │ Continue & other       │  │
│  │ Desktop      │   │ VS Code Ext  │   │ MCP Clients            │  │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬─────────────┘  │
│         │                  │                       │                 │
│         │  MCP Protocol    │  MCP Protocol         │  MCP Protocol   │
│         └──────────────────┴───────────────────────┘                 │
│                             │                                         │
└─────────────────────────────┼─────────────────────────────────────────┘
                              │
         ┏━━━━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━━━━━━┓
         ┃    Agent Skills MCP Server               ┃
         ┃    (Tool-First Architecture)             ┃
         ┃                                          ┃
         ┃  • Discovers & parses SKILL.md files     ┃
         ┃  • invoke_skill tool (enum params)       ┃
         ┃  • Resources for supporting files        ┃
         ┃  • NO execution (security by design)     ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 2. Container Architecture (C4 Level 2)

### Package Structure

The system is organized as a **monorepo** with three npm packages using pnpm workspaces:

#### 2.1 @agentskills/core

**Purpose**: Shared types, parsers, and utilities used by both CLI and MCP server.

**Responsibilities**:

- SKILL.md parsing (YAML frontmatter + Markdown body)
- Skill validation against Agent Skills standard
- String interpolation engine ($ARGUMENTS, $N, ${CLAUDE_SESSION_ID})
- Type definitions for skill schema and configuration
- File system utilities for skill discovery
- Skill registry with hot reload support

**Dependencies**:

- `js-yaml` (YAML parsing)
- `gray-matter` (frontmatter extraction)
- `chokidar` (file watching)

**Exported APIs**:

- `parseSkill(content: string): Skill`
- `validateSkill(skill: Skill): ValidationResult`
- `interpolateArguments(content: string, args: string[]): string`
- `SkillRegistry` class with `load()`, `get()`, `list()`, `watch()` methods

#### 2.2 @agentskills/cli

**Purpose**: Developer tool for managing, creating, and validating Agent Skills locally.

**Responsibilities**:

- Create new skill scaffolds (`agent-skills create`)
- Validate skill files (`agent-skills validate`)
- List discovered skills (`agent-skills list`)
- Configuration management (`agent-skills config`)
- Interactive skill development workflow

**Dependencies**:

- `@agentskills/core` (all core functionality)
- `commander` (CLI framework)
- `chalk` (terminal colors)
- `ora` (spinners)
- `inquirer` (interactive prompts)

**CLI Commands**:

```bash
agent-skills create <name>     # Create new skill scaffold
agent-skills validate [path]   # Validate skill(s)
agent-skills list              # List all skills
agent-skills config            # Manage configuration
agent-skills init              # Initialize project
```

#### 2.3 @agentskills/mcp-server

**Purpose**: MCP server exposing Agent Skills to MCP-compatible clients.

**Responsibilities**:

- Implement MCP protocol using @modelcontextprotocol/sdk
- Expose `invoke_skill` tool with enum parameter (all discovered skills)
- Process tool invocations (argument interpolation, skill retrieval)
- Expose skill files as MCP resources (scripts/, references/, assets/)
- Handle stdio/HTTP transport
- Configuration loading and validation

**Dependencies**:

- `@agentskills/core` (skill parsing and registry)
- `@modelcontextprotocol/sdk` (MCP protocol)

**MCP Interface**:

- **Tool**: `invoke_skill(skill_name: enum, arguments: string[])`
- **Resources**: `skill://<skill-name>/scripts/<file>`, `skill://<skill-name>/references/<file>`, etc.
- **Transport**: stdio (primary), HTTP (future)

### Container Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Monorepo: agent-skills                      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  @agentskills/core                                            │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐     │  │
│  │  │ Skill      │  │ String       │  │ Skill Registry     │     │  │
│  │  │ Parser     │  │ Interpolator │  │ (with hot reload)  │     │  │
│  │  └────────────┘  └──────────────┘  └────────────────────┘     │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐     │  │
│  │  │ Validator  │  │ Types        │  │ File System Utils  │     │  │
│  │  └────────────┘  └──────────────┘  └────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│           ▲                                      ▲                  │
│           │                                      │                  │
│           │ imports                              │ imports          │
│  ┌────────┴──────────────┐          ┌───────────┴────────────────┐  │
│  │  @agentskills/cli     │          │  @agentskills/mcp-server   │  │
│  │                       │          │                            │  │
│  │  ┌─────────────────┐  │          │  ┌──────────────────────┐  │  │
│  │  │ Create Command  │  │          │  │ MCP Tool Handler     │  │  │
│  │  ├─────────────────┤  │          │  ├──────────────────────┤  │  │
│  │  │ Validate Command│  │          │  │ invoke_skill(enum)   │  │  │
│  │  ├─────────────────┤  │          │  ├──────────────────────┤  │  │
│  │  │ List Command    │  │          │  │ Resource Handler     │  │  │
│  │  ├─────────────────┤  │          │  ├──────────────────────┤  │  │
│  │  │ Config Command  │  │          │  │ Transport (stdio)    │  │  │
│  │  └─────────────────┘  │          │  └──────────────────────┘  │  │
│  │                       │          │                            │  │
│  │  Output: CLI binary   │          │  Output: MCP server binary │  │
│  └───────────────────────┘          └────────────────────────────┘  │
│           │                                      │                  │
└───────────┼──────────────────────────────────────┼──────────────────┘
            │                                      │
            ▼                                      ▼
    ┌───────────────┐                    ┌────────────────┐
    │ Developer     │                    │ MCP Clients    │
    │ Terminal      │                    │ (via stdio)    │
    └───────────────┘                    └────────────────┘
```

### Build System

- **Package Manager**: pnpm with workspaces
- **Build Tool**: Turbo for incremental builds and caching
- **Build Order**: core → cli + mcp-server (parallel)
- **Scripts**:
  - `pnpm build`: Build all packages
  - `pnpm test`: Run tests across all packages
  - `pnpm dev`: Watch mode for development

## 3. Component Architecture (C4 Level 3)

### 3.1 @agentskills/core Components

#### SkillParser Component

```typescript
// Responsibility: Parse SKILL.md files into structured objects
interface SkillParser {
  parse(content: string): ParseResult<Skill>;
  extractFrontmatter(content: string): FrontmatterResult;
  parseMarkdown(content: string): string;
}
```

**Key Functions**:

- Extract YAML frontmatter using `gray-matter`
- Validate required fields (name, description)
- Parse optional fields (license, compatibility, metadata, allowed-tools)
- Parse Claude Code extensions (disable-model-invocation, user-invocable, etc.)
- Handle malformed files gracefully

#### SkillValidator Component

```typescript
// Responsibility: Validate skills against Agent Skills standard
interface SkillValidator {
  validate(skill: Skill): ValidationResult;
  validateFrontmatter(frontmatter: Record<string, any>): ValidationError[];
  validateContent(content: string): ValidationError[];
}
```

**Validation Rules**:

- Required fields present and correct type
- Description length (~100 tokens recommendation)
- Content length (<5000 tokens recommendation)
- Valid compatibility strings
- Valid license identifiers
- Metadata structure

#### SkillRegistry Component

```typescript
// Responsibility: In-memory registry with hot reload
class SkillRegistry {
  private skills: Map<string, Skill>;
  private watchers: FSWatcher[];

  async load(directories: string[]): Promise<void>;
  get(name: string): Skill | undefined;
  list(filter?: SkillFilter): Skill[];
  watch(directories: string[], onChange: () => void): void;
  refresh(): Promise<void>;
}
```

**Features**:

- Multi-directory discovery with priority ordering
- Nested directory traversal
- File watching with `chokidar`
- Automatic reload on changes
- Conflict resolution (same skill name in multiple locations)

#### FileSystemUtils Component

```typescript
// Responsibility: File system operations for skill discovery
interface FileSystemUtils {
  findSkills(directory: string): Promise<string[]>;
  readSkillFile(path: string): Promise<string>;
  getSupportingFiles(skillPath: string): Promise<SupportingFiles>;
  resolveSkillPath(name: string, directories: string[]): string | undefined;
}
```

### 3.2 @agentskills/cli Components

#### CommandExecutor Component

- Orchestrates command execution
- Loads configuration
- Initializes SkillRegistry
- Handles errors and user feedback

#### CreateCommand Component

```typescript
// agent-skills create <name>
interface CreateCommand {
  execute(name: string, options: CreateOptions): Promise<void>;
  promptForMetadata(): Promise<SkillMetadata>;
  scaffoldSkillDirectory(path: string, metadata: SkillMetadata): Promise<void>;
}
```

**Features**:

- Interactive prompts for skill metadata
- Scaffold directory structure (SKILL.md, scripts/, references/, assets/)
- Template selection (basic, advanced, custom)
- Open in editor after creation

#### ValidateCommand Component

```typescript
// agent-skills validate [path]
interface ValidateCommand {
  execute(path?: string): Promise<ValidationReport>;
  validateSingle(skillPath: string): Promise<ValidationResult>;
  validateAll(directory: string): Promise<ValidationResult[]>;
  displayReport(results: ValidationResult[]): void;
}
```

**Output**:

- Color-coded validation results
- Detailed error messages with line numbers
- Summary statistics (passed/failed/warnings)
- Exit code based on results

#### ListCommand Component

```typescript
// agent-skills list
interface ListCommand {
  execute(options: ListOptions): Promise<void>;
  displayTable(skills: Skill[]): void;
  displayJson(skills: Skill[]): void;
  filterSkills(skills: Skill[], filters: SkillFilter): Skill[];
}
```

**Display Formats**:

- Table view (name, description, location)
- JSON output for scripting
- Tree view for nested directories
- Filter by compatibility, metadata, etc.

#### ConfigCommand Component

```typescript
// agent-skills config
interface ConfigCommand {
  execute(action: string): Promise<void>;
  init(): Promise<void>;
  set(key: string, value: any): Promise<void>;
  get(key: string): Promise<any>;
  list(): Promise<void>;
}
```

**Configuration**:

- Stored in `.agentskills/config.json`
- Skill directories
- Custom templates
- Validation rules
- Editor preferences

### 3.3 @agentskills/mcp-server Components

#### MCPServerCore Component

```typescript
// Main server initialization and lifecycle
class MCPServerCore {
  private server: Server;
  private registry: SkillRegistry;

  async start(): Promise<void>;
  async stop(): Promise<void>;
  registerHandlers(): void;
}
```

**Responsibilities**:

- Initialize MCP SDK Server instance
- Load configuration
- Initialize SkillRegistry
- Register tool and resource handlers
- Handle stdio transport

#### ToolHandler Component

```typescript
// Handle invoke_skill tool calls
interface ToolHandler {
  getToolDefinition(): ToolDefinition;
  handleInvoke(request: InvokeRequest): Promise<InvokeResponse>;
  buildEnumValues(): EnumValue[];
}
```

**Tool Definition**:

```json
{
  "name": "invoke_skill",
  "description": "Invoke an Agent Skill by name with optional arguments",
  "inputSchema": {
    "type": "object",
    "properties": {
      "skill_name": {
        "type": "string",
        "enum": ["skill1", "skill2", ...],
        "description": "Name of the skill to invoke"
      },
      "arguments": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Arguments to pass to the skill"
      }
    },
    "required": ["skill_name"]
  }
}
```

**Tool Response**:

```json
{
  "content": "Processed skill instructions with interpolated arguments",
  "metadata": {
    "skill_name": "my-skill",
    "scripts": ["scripts/setup.sh", "scripts/test.sh"],
    "references": ["references/api-docs.md"],
    "assets": ["assets/diagram.png"],
    "requires_execution": true
  }
}
```

**Key Logic**:

- Build enum dynamically from SkillRegistry
- Filter out skills with `disable-model-invocation: true`
- Mark skills with `user-invocable: true` in descriptions
- Perform string interpolation on skill content
- Return metadata about supporting files
- Flag dynamic commands (`` !`command` ``) for agent execution

#### ResourceHandler Component

```typescript
// Handle resource URIs for supporting files
interface ResourceHandler {
  listResources(): Promise<Resource[]>;
  getResource(uri: string): Promise<ResourceContent>;
  parseResourceUri(uri: string): ResourceReference;
}
```

**Resource URI Format**:

- `skill://<skill-name>/SKILL.md` (main skill file)
- `skill://<skill-name>/scripts/<filename>`
- `skill://<skill-name>/references/<filename>`
- `skill://<skill-name>/assets/<filename>`

**Resource Response**:

```json
{
  "uri": "skill://my-skill/scripts/setup.sh",
  "mimeType": "text/x-shellscript",
  "content": "#!/bin/bash\n..."
}
```

#### ConfigLoader Component

```typescript
// Load and validate server configuration
interface ConfigLoader {
  load(): Promise<ServerConfig>;
  validate(config: ServerConfig): ValidationResult;
  getDefaults(): ServerConfig;
}
```

**Configuration Schema**:

```json
{
  "skillDirectories": [".claude/skills", "~/.claude/skills"],
  "watchForChanges": true,
  "maxSkillSize": 5000,
  "logLevel": "info"
}
```

## 4. Architecture Decisions (ADRs)

### ADR-001: Tool-First Architecture with use_skill Tool

## Status

Accepted

## Context

MCP supports both tools and resources. We need a simple discovery and invocation pattern for exposing Agent Skills to MCP-compatible clients. The challenge is providing an intuitive interface that allows agents to discover and use skills efficiently without requiring complex schema updates or active scanning.

## Decision

We will expose skills as a single `use_skill` tool that returns raw skill instructions without server-side interpolation.

## Consequences

- - Simple tool interface that's easy to understand and use
- - Clear separation of concerns: server discovers/parses, client interpolates/executes
- - Agents can see available skills via tool introspection
- - No security concerns from server-side execution
- - Client controls interpolation logic for their specific context
- - Requires client to understand $ARGUMENTS and $N placeholders
- - No dynamic enum for skill discovery (tool introspection shows all skills in description)

### ADR-002: No Server-Side Execution or Interpolation

## Status

Accepted

## Context

Skills contain placeholders ($ARGUMENTS, $N) and executable commands (`` !`command` `` syntax). The server must decide whether to process these elements or pass them through to clients. This decision has significant implications for security, complexity, and separation of concerns.

## Decision

We will not execute commands or interpolate strings in the MCP server. The server returns raw skill content, and clients are responsible for both interpolation and execution.

## Consequences

- - Maximum security with no risk from untrusted skills
- - Simpler implementation without sandboxing or interpolation logic
- - Clear separation of concerns between server and client
- - Client has full control over execution context
- - Client must implement interpolation logic
- - Client must handle dynamic commands responsibly

### ADR-003: Monorepo with Separate Packages

## Status

Accepted

## Context

We need both a CLI tool for developers and an MCP server for agents. Both require skill parsing and validation logic. The question is how to organize the codebase to maximize code reuse while maintaining clear boundaries and independent deployability.

## Decision

We will use a pnpm workspaces monorepo with three packages: @codemcp/agentskills-core (shared), @codemcp/agentskills-cli, and @codemcp/agentskills-mcp-server.

## Consequences

- - Clean separation of concerns between packages
- - CLI usable independently of the MCP server
- - Shared code reduces duplication
- - Independent versioning possible for each package
- - More complex build setup
- - Need to manage inter-package dependencies

### ADR-004: Package.json Configuration with Pacote

## Status

Accepted

## Context

We need to support multiple skill sources including git repositories, local paths, and future npm registry sources. Users need a familiar, declarative way to manage skill dependencies with version control and reproducibility.

## Decision

We will use `package.json` with an `agentskills` field for declarative skill dependencies and use the Pacote library for installation.

## Consequences

- - Familiar pattern for developers (similar to npm dependencies)
- - Battle-tested installation logic (Pacote powers npm)
- - Supports git, local, tarball, and future npm registry sources
- - Lock file provides reproducibility
- - Auto-discovery maintains backwards compatibility
- - Requires package.json in project (or global config)
- - Additional dependency on Pacote

### ADR-005: Load-on-Startup (No Hot Reload in MVP)

## Status

Accepted

## Context

Hot reload adds complexity through file watching, change detection, and state management. The MVP needs to balance developer experience with implementation complexity and time to market.

## Decision

We will load all skills on server startup with no file watching or hot reload in the MVP. Users must restart the server to pick up changes.

## Consequences

- - Simpler implementation
- - No file watcher overhead
- - Predictable behavior
- - Faster path to MVP
- - Can add hot reload in v1.1+ without breaking changes
- - Requires server restart for changes
- - Poorer developer experience during skill development

### ADR-006: TypeScript with @modelcontextprotocol/sdk

## Status

Accepted

## Context

We need to implement the MCP protocol. Official SDKs are available in TypeScript and Python. The choice of language affects type safety, ecosystem compatibility, distribution, and development velocity.

## Decision

We will use TypeScript with @modelcontextprotocol/sdk for type safety and ecosystem compatibility.

## Consequences

- - Type safety for skill schemas and MCP protocol
- - Official SDK handles protocol details
- - JavaScript ecosystem compatibility
- - Easy to distribute as npm packages
- - Runtime overhead compared to compiled languages
- - Node.js dependency

## 5. Technology Choices

### Core Stack

| Technology                    | Purpose          | Rationale                                     |
| ----------------------------- | ---------------- | --------------------------------------------- |
| **TypeScript 5.x**            | Primary language | Type safety, excellent tooling, npm ecosystem |
| **pnpm 9.x**                  | Package manager  | Fast, efficient, workspace support            |
| **Turbo 2.x**                 | Build system     | Incremental builds, remote caching            |
| **@modelcontextprotocol/sdk** | MCP protocol     | Official SDK, handles protocol complexity     |
| **Node.js 20.x LTS**          | Runtime          | Stable, widespread, good async I/O            |

### Core Dependencies

| Package         | Purpose                | Why This Choice                      |
| --------------- | ---------------------- | ------------------------------------ |
| **js-yaml**     | YAML parsing           | De facto standard, reliable          |
| **gray-matter** | Frontmatter extraction | Specialized for markdown frontmatter |
| **chokidar**    | File watching          | Cross-platform, battle-tested        |
| **zod**         | Schema validation      | Type-safe validation, great DX       |

### CLI Dependencies

| Package        | Purpose             | Why This Choice                  |
| -------------- | ------------------- | -------------------------------- |
| **commander**  | CLI framework       | Simple, popular, good ergonomics |
| **chalk**      | Terminal colors     | Standard for colored output      |
| **ora**        | Spinners            | Good UX for long operations      |
| **inquirer**   | Interactive prompts | Rich prompt types                |
| **cli-table3** | Table formatting    | Clean ASCII tables               |

### Development Tools

| Tool         | Purpose              | Rationale                    |
| ------------ | -------------------- | ---------------------------- |
| **Vitest**   | Testing              | Fast, Vite-powered, great DX |
| **ESLint**   | Linting              | Industry standard            |
| **Prettier** | Formatting           | Consistent code style        |
| **tsx**      | TypeScript execution | Fast dev iteration           |
| **tsup**     | Bundling             | Simple, fast, zero-config    |

### Rejected Alternatives

- ❌ **Jest**: Slower than Vitest, more configuration
- ❌ **Webpack**: Overkill for library bundling
- ❌ **npm/yarn**: pnpm is faster and more efficient
- ❌ **Lerna**: Turbo is more modern and faster

## 6. Quality Attributes

### Performance

**Requirements**:

- Skill discovery: < 1 second for 100 skills
- Tool invocation: < 100ms for string interpolation
- Resource access: < 50ms for file read
- Hot reload: < 500ms to detect and reload changes

**Strategies**:

- In-memory skill registry (avoid disk I/O)
- Lazy loading of supporting files
- Efficient file watching (debounced events)
- Caching of parsed skill objects

**Monitoring**:

- Log timing for all operations
- Track registry size and reload frequency
- Monitor file watcher event rates

### Security

**Threat Model**:

- **Malicious Skills**: Untrusted SKILL.md files with harmful commands
- **Path Traversal**: Skills accessing files outside skill directory
- **Command Injection**: Dynamic commands with unsafe interpolation
- **Resource Exhaustion**: Large files or infinite loops

**Mitigations**:

1. **No Execution**: Server never executes commands (agent responsibility)
2. **Path Validation**: Restrict file access to skill directories
3. **Size Limits**: Enforce max file sizes (5000 tokens for SKILL.md)
4. **Input Sanitization**: Validate all frontmatter fields
5. **Read-Only**: No file modifications via MCP
6. **Configuration**: Allow administrators to disable dynamic commands

**Security Boundaries**:

```
┌─────────────────────────────────────┐
│  Agent (Trusted)                    │
│  • Decides what to execute          │
│  • Has user context and permissions │
└──────────────┬──────────────────────┘
               │ MCP Protocol
┌──────────────▼──────────────────────┐
│  MCP Server (Semi-Trusted)          │
│  • Read-only file access            │
│  • No command execution             │
│  • Validates skill format           │
└──────────────┬──────────────────────┘
               │ File System (Read)
┌──────────────▼──────────────────────┐
│  Skills (Untrusted)                 │
│  • May contain malicious content    │
│  • Treated as data, not code        │
└─────────────────────────────────────┘
```

### Reliability

**Fault Tolerance**:

- Graceful degradation if skill directories missing
- Continue operation if individual skills fail to parse
- Handle file system errors (permissions, disk full)
- Recover from file watcher failures

**Error Handling**:

- All file I/O wrapped in try-catch
- Detailed error messages with context
- Log errors without crashing server
- Return meaningful errors to agents

**Availability**:

- Server runs continuously (stdio transport)
- No external dependencies (database, network)
- Automatic recovery from transient errors
- Health check endpoint (future: HTTP transport)

### Maintainability

**Code Quality**:

- TypeScript strict mode
- ESLint rules enforced
- 80%+ test coverage target
- API documentation with TSDoc

**Testing Strategy**:

- Unit tests: Core parsing and validation logic
- Integration tests: Registry and file operations
- End-to-end tests: MCP protocol interactions
- Example skills for manual testing

**Versioning**:

- Semantic versioning (semver)
- Changelog maintained
- Breaking changes documented
- Migration guides for major versions

### Observability

**Logging Levels**:

- **ERROR**: Parse failures, file system errors
- **WARN**: Missing optional fields, deprecated features
- **INFO**: Skill loading, tool invocations
- **DEBUG**: Detailed parsing, registry operations

**Metrics** (Future):

- Skill count by directory
- Invocation frequency per skill
- Parse success/failure rates
- Hot reload event counts

**Debugging**:

- Verbose mode for troubleshooting
- Dump parsed skills to JSON
- Validate mode to test parsing
- Dry-run mode for CLI commands

## 7. Enhancement Recommendations

### Phase 2: Advanced Features

1. **Remote Skill Repositories**
   - Fetch skills from GitHub, npm, or Git URLs
   - Version management and updates
   - Local caching
   - Priority: High | Complexity: Medium

2. **Skill Composition**
   - Skills reference other skills
   - Dependency resolution
   - Circular dependency detection
   - Priority: Medium | Complexity: High

3. **HTTP Transport**
   - Alternative to stdio for cloud deployments
   - SSE for hot reload notifications
   - REST API for skill management
   - Priority: Medium | Complexity: Low

4. **Web UI**
   - Browse and search skills
   - Visual skill editor
   - Real-time validation feedback
   - Priority: Low | Complexity: High

### Phase 3: Enterprise Features

1. **Access Control**
   - Permission system for sensitive skills
   - API key authentication
   - Audit logging
   - Priority: High | Complexity: High

2. **Skill Marketplace**
   - Public/private registries
   - Versioning and releases
   - Ratings and reviews
   - Priority: Medium | Complexity: Very High

3. **Analytics & Telemetry**
   - Usage statistics
   - Performance metrics
   - Error tracking
   - Priority: Medium | Complexity: Medium

4. **Multi-Language Support**
   - Python SDK version
   - Go SDK version
   - Language-agnostic protocol
   - Priority: Low | Complexity: Medium

### Phase 4: Advanced Integration

1. **Skills as MCP Prompts**
   - Expose skills via prompts API
   - Template system for prompt generation
   - Argument injection
   - Priority: Low | Complexity: Low

2. **Plugin Namespaces**
   - Support `plugin-name:skill-name` format
   - Multi-tenant isolation
   - Namespace-based access control
   - Priority: Medium | Complexity: Medium

3. **Subagent Execution**
   - Support `context: fork` for parallel execution
   - Requires MCP protocol extension
   - Agent coordination
   - Priority: Low | Complexity: Very High

4. **Hooks System**
   - Pre/post invocation hooks
   - Lifecycle events
   - Custom transformations
   - Priority: Low | Complexity: Medium

### Migration Path

1. **v1.0**: Core features (current plan)
2. **v1.1**: Remote repositories + HTTP transport
3. **v2.0**: Skill composition + access control
4. **v3.0**: Marketplace + advanced integration

---

_This architecture documentation follows the C4 model and will evolve as implementation progresses. Last updated: 2026-02-19_
