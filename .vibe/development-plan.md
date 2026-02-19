# Development Plan: agent-skills (main branch)

*Generated on 2026-02-19 by Vibe Feature MCP*
*Workflow: [greenfield](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/greenfield)*

## Goal
Build an MCP server that exposes Claude Code skills (following the Agent Skills open standard) to any MCP-compatible agent, enabling cross-platform skill sharing and dynamic skill loading.

## Ideation
<!-- beads-phase-id: agent-skills-1.1 -->
### Tasks

*Tasks managed via `bd` CLI*

## Architecture
<!-- beads-phase-id: agent-skills-1.2 -->

### Phase Entrance Criteria:
- [ ] The project vision and scope are clearly defined
- [ ] Key use cases and user personas are identified
- [ ] Success criteria and metrics are established
- [ ] Core value propositions are documented
- [ ] Potential alternatives have been explored

### Tasks

*Tasks managed via `bd` CLI*

## Plan
<!-- beads-phase-id: agent-skills-1.3 -->

### Phase Entrance Criteria:
- [ ] System architecture is defined with C4 diagrams
- [ ] Component responsibilities and boundaries are clear
- [ ] Technology choices are documented with rationale
- [ ] Integration points and APIs are specified
- [ ] Non-functional requirements are addressed

### Tasks

*Tasks managed via `bd` CLI*

## Code
<!-- beads-phase-id: agent-skills-1.4 -->

### Phase Entrance Criteria:
- [ ] Implementation plan is detailed with clear milestones
- [ ] Tasks are broken down into manageable units
- [ ] Dependencies and order of implementation are identified
- [ ] Testing strategy is defined
- [ ] Development environment is prepared

### Tasks

*Tasks managed via `bd` CLI*

## Finalize
<!-- beads-phase-id: agent-skills-1.5 -->
### Tasks
- [ ] Squash WIP commits: `git reset --soft <first commit of this branch>. Then, Create a conventional commit. In the message, first summarize the intentions and key decisions from the development plan. Then, add a brief summary of the key changes and their side effects and dependencies

*Tasks managed via `bd` CLI*

## Key Decisions

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
*This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management.*
