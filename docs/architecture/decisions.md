# Design Decisions

Key architectural decisions, their rationale, and consequences.

## ADR-001: Single `use_skill` Tool with Enum

**Decision:** Expose all skills through one tool (`use_skill`) with a dynamic `skill_name` enum, rather than one tool per skill.

**Rationale:** A single tool is simpler for agents to discover and invoke. The enum provides type-safe skill selection and lets agents see available skills through standard tool introspection without additional API calls.

**Consequences:**
- The tool definition changes whenever skills are added/removed (requires server restart)
- Agents can enumerate skills without a separate discovery call
- Tool introspection shows all available skills with descriptions

---

## ADR-002: No Server-Side Execution or Interpolation

**Decision:** The server returns raw skill content with placeholders (`$ARGUMENTS`, `$1`, etc.) intact. Agents handle interpolation and execution.

**Rationale:** Server-side execution of arbitrary skill content is a security risk. Agents already have the user's context, permissions, and trust relationship — they are the right place to decide what to run.

**Consequences:**
- Clear security boundary: server is read-only
- No sandboxing or execution environment needed in the server
- Agents must implement placeholder substitution (most already do)
- Dynamic commands (`` !`command` ``) are passed through as text

---

## ADR-003: Monorepo with Three Packages

**Decision:** Organize as a pnpm workspace monorepo: `core`, `cli`, `mcp-server`.

**Rationale:** CLI and server both need skill parsing and installation logic. Extracting it to `core` avoids duplication and allows either consumer to be used independently.

**Consequences:**
- `core` can be used as a library without the CLI or server
- Each package can be versioned and published independently
- Build setup is more complex (mitigated by Turbo)

---

## ADR-004: `package.json` Configuration with Pacote

**Decision:** Use the `agentskills` field in `package.json` for skill declarations, and Pacote for installation.

**Rationale:** Developers already understand npm-style dependency declarations. Pacote is battle-tested (it powers npm) and supports git repos, local paths, tarballs, and the npm registry out of the box.

**Consequences:**
- Familiar pattern — skill configs look and behave like npm dependencies
- Lock file provides reproducibility across machines and CI
- Multiple source types supported without custom fetching logic
- Requires Node.js runtime (not a significant constraint given the target audience)

---

## ADR-005: Load-on-Startup (No Hot Reload)

**Decision:** Skills are loaded once when the MCP server starts. There is no file watcher or hot reload.

**Rationale:** Hot reload adds complexity (file watchers, debouncing, state swaps, client notifications). For the current use case — installing skills via CLI, then using them in an agent session — a restart is acceptable.

**Consequences:**
- Server must be restarted after `agentskills install`
- Simpler implementation with no file watcher overhead
- Hot reload can be added in a future version without breaking changes

---

## ADR-006: TypeScript + Official MCP SDK

**Decision:** Use TypeScript and `@modelcontextprotocol/sdk` for all packages.

**Rationale:** TypeScript provides compile-time safety for the skill schema and MCP protocol types. The official SDK handles protocol negotiation, transport, and schema validation.

**Consequences:**
- Type safety across all boundaries (parsing, validation, MCP protocol)
- Official SDK handles protocol evolution
- npm distribution is straightforward
- Node.js runtime required

---

## Fail-Fast Validation

**Principle:** Detect invalid configurations and skills at load time, not during an agent session.

The `add` command validates before writing to `package.json`. The `install` command fails fast on misconfiguration. Individual skill parse failures during registry loading are logged but do not block loading other skills — a single bad skill file shouldn't break the entire server.

## Client Responsibility

**Principle:** The server provides data; clients (agents) handle execution.

This is consistently applied: the server does not execute commands, interpolate arguments, or make network calls on behalf of skills. Everything a skill "does" is decided by the agent, in the agent's execution context, with the agent's permissions.
