# Development Plan: agent-skills (include-mcp branch)

_Generated on 2026-02-21 by Vibe Feature MCP_
_Workflow: [epcc](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/epcc)_

## Goal

**UPDATED**: Implement an MCP gateway capability that allows skills to declare MCP server dependencies and automatically spawn/manage those servers in Docker containers with proper isolation.

**Original**: Implement the ability for skill authors to declare MCP server dependencies in SKILL.md frontmatter, allowing users to understand what additional servers they need to configure for a skill to work properly.

**Evolution**: Research revealed that we can go beyond documentation - we can automatically deploy and orchestrate dependent MCP servers using a gateway pattern with Docker containers!

## Explore

<!-- beads-phase-id: agent-skills-2.1 -->

### Tasks

_Tasks managed via `bd` CLI_

## Plan

<!-- beads-phase-id: agent-skills-2.2 -->

### Phase Entrance Criteria:

- [ ] The skill structure and SKILL.md format have been thoroughly explored
- [ ] Current implementation of skill loading and metadata parsing is understood
- [ ] Use cases for MCP server dependencies are documented
- [ ] Technical approach options have been evaluated

### Tasks

_Tasks managed via `bd` CLI_

## Code

<!-- beads-phase-id: agent-skills-2.3 -->

### Phase Entrance Criteria:

- [ ] Implementation plan is clearly defined with specific tasks
- [ ] Design decisions for frontmatter schema are documented
- [ ] Files to be modified are identified
- [ ] Test strategy is defined

### Tasks

_Tasks managed via `bd` CLI_

## Commit

<!-- beads-phase-id: agent-skills-2.4 -->

### Phase Entrance Criteria:

- [ ] All code changes are complete and tested
- [ ] Documentation is updated (if applicable)
- [ ] Changes work as expected for all use cases
- [ ] Code is ready for review

### Tasks

- [ ] Squash WIP commits: `git reset --soft <first commit of this branch>. Then, Create a conventional commit. In the message, first summarize the intentions and key decisions from the development plan. Then, add a brief summary of the key changes and their side effects and dependencies

_Tasks managed via `bd` CLI_

## Key Decisions

### 🚀 BREAKTHROUGH DISCOVERY: MCP Gateway Pattern (2026-02-21)

**Finding**: Production-ready MCP gateway implementations exist that can automatically aggregate multiple MCP servers!

- MetaMCP (2k+ stars), mcp-proxy (640+ stars), 1MCP Agent (376+ stars)
- Proven architecture: Agent → Gateway → Multiple MCP Servers (subprocesses)
- Enables automatic dependency resolution from skills

**This Changes Everything**: Instead of just documenting dependencies, we can automatically spawn and manage required MCP servers through a gateway!

**DECISION (2026-02-21): Start with Configuration Management + CLI Integration**

**User's Preferred Approach**:

1. Skills declare MCP server dependencies in SKILL.md (metadata only)
2. CLI validates dependencies during `agentskills install`
3. If MCP servers are missing, fail with helpful error message
4. Provide `agentskills install --with-mcp` to automatically update agent's MCP config
5. Build MCP Config Manager to read/write client configs

**Implementation Scope (v1)**:

- ✅ Add `requires-mcp-servers` field to SKILL.md schema
- ✅ Parse and validate in core package
- ✅ CLI checks if required servers are configured
- ✅ CLI fails install if dependencies missing
- ✅ `--with-mcp` flag automatically updates agent config
- ✅ MCP Config Manager component (read/write mcp.json)

**Future Enhancements (v2+)**:

- Gateway/orchestration capabilities
- Docker support
- HTTP transport
- Automatic server spawning

**Benefits of This Approach**:

- ✅ Simple, focused implementation (2-3 weeks)
- ✅ Immediate value (dependency checking)
- ✅ Opt-in automation (--with-mcp flag)
- ✅ Foundation for future gateway work
- ✅ No gateway complexity yet

---

### 💡 CRITICAL INSIGHT: Use JSON Schema for Validation (2026-02-21)

**Problem**: As SKILL.md frontmatter grows more complex (nested objects, parameters, validation rules), hand-coded validation becomes:

- ❌ Hard to maintain
- ❌ Verbose and error-prone
- ❌ Inconsistent with complex nested structures
- ❌ Difficult to document

**Solution**: Use JSON Schema for validation

**Current State**:

```typescript
// Manual validation in validator.ts (186 lines, growing)
if (name === undefined || name === null) {
  errors.push({ code: "MISSING_FIELD", ... });
}
if (trimmedName.length < 1 || trimmedName.length > 64) {
  errors.push({ code: "INVALID_NAME_LENGTH", ... });
}
// ... hundreds more lines for complex nested validation
```

**Proposed Approach**:

```typescript
// Define schema once
const skillSchema = {
  type: "object",
  required: ["name", "description"],
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 64,
      pattern: "^[a-z0-9-]+$"
    },
    requiresMcpServers: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "command", "description"],
        properties: {
          name: { type: "string" },
          command: { type: "string" },
          parameters: {
            type: "object",
            patternProperties: {
              ".*": {
                type: "object",
                required: ["description", "required"],
                properties: {
                  description: { type: "string" },
                  required: { type: "boolean" },
                  default: { type: "string" },
                  sensitive: { type: "boolean" }
                }
              }
            }
          }
        }
      }
    }
  }
};

// Validate in one line
const valid = ajv.validate(skillSchema, metadata);
```

**Benefits**:

- ✅ Declarative validation (schema as documentation)
- ✅ Automatic error messages
- ✅ Handles nested complexity easily
- ✅ Can export schema for external tools
- ✅ Industry standard approach
- ✅ Much more maintainable

**Library Options**:

1. **Ajv** (most popular, 13k+ stars, TypeScript support)
2. **Zod** (TypeScript-first, type inference)
3. **json-schema** (simple, older)

**Recommendation**: Use **Ajv** (Already used by MCP SDK and many production tools)

**Impact on Implementation**:

- Replace manual validation in `validator.ts` with Ajv
- Define JSON Schema for SKILL.md frontmatter
- Keep custom error code mapping for backward compatibility
- Much easier to add new fields/validation rules

**DECISION**: Adopt JSON Schema validation with Ajv for all frontmatter validation

---

### Solution Approach Analysis (Completed)

#### Approach 1: Documentation-Only (Informational)

**Concept:** Skills declare MCP server names/packages for documentation purposes only.

```yaml
requires-mcp-servers:
  - name: filesystem
    package: "@modelcontextprotocol/server-filesystem"
    purpose: "Access project files"
```

**Pros:**

- Simple, no runtime complexity
- Portable across environments
- No security concerns (no credentials)
- Users configure servers themselves

**Cons:**

- Agent can't automatically use the servers
- Manual setup required by end users
- Limited value beyond documentation

**Use case:** Inform users what to configure, but don't automate setup.

---

#### Approach 2: Full Specification Embedded

**Concept:** Embed complete MCP server config in SKILL.md

```yaml
requires-mcp-servers:
  - name: filesystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "${WORKSPACE}"]
    env:
      DEBUG: "true"
```

**Pros:**

- Self-contained, complete information
- Agent could potentially auto-configure
- Clear requirements

**Cons:**

- **Security risk:** Can't include credentials safely
- **Not portable:** Hardcoded paths/commands
- **Complex:** Skill authors must know MCP internals
- **Maintenance burden:** Server configs change

**Use case:** If skills are environment-specific and don't need credentials.

---

#### Approach 3: Package Reference + User Variables

**Concept:** Reference standard server packages, let users provide config

```yaml
requires-mcp-servers:
  - package: "@modelcontextprotocol/server-filesystem"
    description: "Access workspace files"
    config-template:
      workspace_path:
        description: "Root directory for file access"
        default: "${WORKSPACE}"
  - package: "@modelcontextprotocol/server-postgres"
    description: "Query project database"
    config-template:
      connection_string:
        description: "PostgreSQL connection URL"
        required: true
        sensitive: true
```

**Pros:**

- Separates public (skill) from private (user config)
- Provides guidance without hardcoding
- Agent can prompt user for required values
- More secure (marks sensitive fields)

**Cons:**

- Still requires user setup
- Agent needs to understand config templates
- More complex schema

**Use case:** Balance between automation and security.

---

#### Approach 4: Well-Known Server Registry

**Concept:** Reference servers by well-known names, look up specs elsewhere

```yaml
requires-mcp-servers:
  - filesystem # Known server
  - postgres # Known server
  - custom-internal-tool # User must configure
```

**Pros:**

- Simplest for skill authors
- Standard servers auto-configured
- Unknown servers flagged for manual setup

**Cons:**

- Requires maintaining server registry
- Limited to known servers
- Custom servers still need manual config

**Use case:** If MCP ecosystem has standard server packages.

---

#### Approach 5: Hybrid - Levels of Specification

**Concept:** Support multiple levels from simple to detailed

```yaml
requires-mcp-servers:
  # Level 1: Just name (for well-known servers)
  - filesystem

  # Level 2: Package reference
  - package: "@modelcontextprotocol/server-postgres"

  # Level 3: Full specification
  - name: custom-tool
    command: "./bin/custom-server"
    args: ["--port", "3000"]
```

**Pros:**

- Flexible - skill author chooses detail level
- Progressive disclosure
- Backward compatible (can start simple)

**Cons:**

- Most complex to implement
- Multiple code paths to handle
- May confuse users

**Use case:** Maximum flexibility, gradual adoption.

---

### MCP Client Configuration Research Findings

**Standard Configuration Format (All MCP Clients):**

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@scope/package-name", "arg1", "arg2"],
      "env": { "API_KEY": "value" },
      "cwd": "/absolute/path"
    }
  }
}
```

**Key Insights:**

1. **Fields**: `command` (required), `args` (optional), `env` (optional), `cwd` (optional)
2. **No Built-in Registry**: MCP protocol has no standard server registry; clients use external registries or manual config
3. **Static Configuration**: Most clients require restart to apply config changes
4. **Security**: Credentials via `env` vars, OAuth for remote servers, manual approval for sensitive ops
5. **Transport Types**: STDIO (local) vs SSE/HTTP (remote)
6. **NPM Pattern**: Common to use `npx -y @scope/package` for auto-installing servers

**Critical Constraint:** Clients need the full server spec (command, args, env, cwd) added to their config file **before launch**. Skills can't dynamically add servers at runtime in most clients.

---

### RECOMMENDED SOLUTION: Approach 3 + Documentation

**Decision Rationale:**

Given the constraints:

1. ✅ Skills need to declare MCP server dependencies
2. ✅ Agents need full server specs to configure clients
3. ❌ Can't include credentials in version-controlled SKILL.md
4. ❌ Can't dynamically add servers at runtime (client limitation)
5. ✅ Need to support both well-known and custom servers

**The solution must provide configuration templates that agents can present to users.**

#### Proposed Schema Design

```yaml
---
name: example-skill
description: A skill that analyzes project files and database
requires-mcp-servers:
  # Simple reference for well-known servers
  - name: filesystem
    package: "@modelcontextprotocol/server-filesystem"
    description: "Provides access to project files for analysis"
    config-template:
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-filesystem"
        - "${WORKSPACE_PATH}"
      parameters:
        WORKSPACE_PATH:
          description: "Root directory for file access"
          default: "${CWD}"
          required: true

  # More complex server with credentials
  - name: postgres
    package: "@modelcontextprotocol/server-postgres"
    description: "Connects to project database for schema analysis"
    config-template:
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-postgres"
        - "${DATABASE_URL}"
      env:
        PGPASSWORD: "${DB_PASSWORD}"
      parameters:
        DATABASE_URL:
          description: "PostgreSQL connection string"
          example: "postgresql://localhost:5432/mydb"
          required: true
        DB_PASSWORD:
          description: "Database password"
          required: true
          sensitive: true

  # Custom/uncommon server
  - name: custom-api
    description: "Internal API tool for company-specific operations"
    config-template:
      command: node
      args:
        - "/path/to/custom-server.js"
      env:
        API_KEY: "${CUSTOM_API_KEY}"
      cwd: "${PROJECT_ROOT}"
      parameters:
        CUSTOM_API_KEY:
          description: "API key for internal tool"
          required: true
          sensitive: true
        PROJECT_ROOT:
          description: "Project root directory"
          default: "${CWD}"
---
```

#### TypeScript Interface

```typescript
interface McpServerDependency {
  name: string; // Server identifier
  package?: string; // NPM package name (optional)
  description: string; // Why this server is needed
  configTemplate: {
    command: string; // Executable command
    args?: string[]; // Arguments (may contain ${VAR} placeholders)
    env?: Record<string, string>; // Environment vars (may contain ${VAR} placeholders)
    cwd?: string; // Working directory (may contain ${VAR})
    parameters?: Record<string, ParameterSpec>; // Define all ${VAR} placeholders
  };
}

interface ParameterSpec {
  description: string; // What this parameter is for
  required: boolean; // Is this parameter required?
  sensitive?: boolean; // Is this a secret/credential?
  default?: string; // Default value (can use ${VAR} for system vars)
  example?: string; // Example value to guide users
}
```

#### How Agents Use This Information

**Workflow:**

1. **Skill Discovery**: Agent reads SKILL.md and sees `requires-mcp-servers`
2. **Dependency Check**: Agent checks if servers are configured in client
3. **Missing Servers**: For unconfigured servers, agent:
   - Shows user the server description and purpose
   - Presents the config template with parameter descriptions
   - Prompts user for required values (marking sensitive fields)
   - Generates complete mcpServers config entry
   - Instructs user to add to client config and restart
4. **Documentation**: Agent can reference server capabilities when using skill

**Example Agent Prompt:**

```
This skill requires the "filesystem" MCP server which is not currently configured.

Server: filesystem
Purpose: Provides access to project files for analysis
Package: @modelcontextprotocol/server-filesystem

To configure this server, add the following to your Claude Desktop config:

{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/projects/myproject"]
    }
  }
}

Required Parameters:
- WORKSPACE_PATH: Root directory for file access
  Default: /Users/you/projects/myproject

Please provide WORKSPACE_PATH or press Enter to use default:
```

#### Benefits of This Approach

✅ **Complete Information**: Full MCP server spec for agent to use
✅ **Secure**: Sensitive values not in SKILL.md, prompted from user
✅ **Flexible**: Supports well-known and custom servers equally
✅ **Portable**: Templates use variables, not hardcoded paths
✅ **Discoverable**: Agent can guide user through setup
✅ **Documented**: Clear purpose and parameter descriptions
✅ **Extensible**: Can add optional fields later (version requirements, alternatives)

#### Drawbacks

❌ **Verbose**: More complex YAML than simple string array
❌ **Not Automatic**: Still requires user to update client config and restart
❌ **Duplication**: Template duplicates what's already in server package metadata

#### Alternative: Two-Tier System

For v1, we could start simpler and evolve:

**Option 1a: Start with documentation-only**

```yaml
requires-mcp-servers:
  - filesystem: "@modelcontextprotocol/server-filesystem"
  - postgres: "@modelcontextprotocol/server-postgres"
```

Agent tells user "This skill needs filesystem and postgres MCP servers. Please configure them."

**Then evolve to full templates in v2 based on user feedback.**

---

## BREAKTHROUGH: Docker MCP Gateway Approach 🚀

### Research Findings: Gateway Pattern is PROVEN and VIABLE

**Key Discovery**: Multiple production MCP gateway implementations exist that aggregate multiple MCP servers into one endpoint!

**Existing Solutions**:

1. **MetaMCP** (2k+ stars) - Full-featured gateway with UI, auth, middleware
2. **mcp-proxy** (640+ stars) - Go-based lightweight gateway
3. **1MCP Agent** (376+ stars) - Unified MCP server implementation

### How Gateway Pattern Works

```
Agent (MCP Client)
  ↓ HTTP/SSE
Gateway (MCP Server + Internal MCP Clients)
  ↓ STDIO subprocesses
  ├─→ filesystem server
  ├─→ postgres server
  └─→ github server
```

**Key Architecture Points**:

- Gateway implements MCP Server protocol (exposes tools/resources to agent)
- Gateway runs multiple MCP servers as **subprocesses inside same container**
- Gateway creates internal MCP Clients to communicate with subprocesses via STDIO
- Gateway aggregates tools and handles namespacing (e.g., `filesystem:read_file`)
- Agent connects to gateway once via HTTP/SSE instead of multiple STDIO connections

### Critical Constraint: STDIO Transport

**Cannot cross Docker container boundaries** - MCP servers using STDIO (most common) require parent-child process relationship. This means:

- ❌ Can't run each MCP server in separate Docker container
- ✅ Must run all servers as subprocesses inside gateway container
- ✅ Gateway provides isolation boundary via Docker

**UPDATED FINDING: Actually, You CAN Containerize Separately!**

The research was partially wrong. Here's the full truth:

**Why the initial research said "can't":**

- STDIO transport requires parent-child process with inherited file descriptors
- Docker containers are isolated process namespaces
- Standard `docker run` doesn't create this relationship

**But there ARE three viable approaches:**

#### Approach 1: HTTP/SSE Transport (PROPER SOLUTION) ✅

**Most MCP servers support BOTH transports!**

Instead of STDIO, run servers with HTTP transport:

```yaml
# docker-compose.yml
services:
  filesystem-server:
    image: mcp-filesystem
    command: ["node", "server.js", "--transport=http", "--port=3001"]

  postgres-server:
    image: mcp-postgres
    command: ["node", "server.js", "--transport=http", "--port=3002"]

  gateway:
    image: agentskills-gateway
    environment:
      FILESYSTEM_URL: http://filesystem-server:3001
      POSTGRES_URL: http://postgres-server:3002
```

**Gateway connects to containers via HTTP, not STDIO.**

**Pros**:

- ✅ Proper Docker architecture (one container per service)
- ✅ True isolation per server
- ✅ Scalable horizontally
- ✅ Standard HTTP security/auth
- ✅ Production-ready

**Cons**:

- ⚠️ Requires servers to support HTTP transport (most do!)
- ⚠️ Slightly higher latency than STDIO (10-50ms)

#### Approach 2: Docker Exec (WORKAROUND) ⚠️

Start containers as daemons, use `docker exec -i` to run server:

```bash
# Pre-start container
docker run -d --name filesystem-server node:20 tail -f /dev/null

# Gateway executes server with interactive stdin
docker exec -i filesystem-server npx @modelcontextprotocol/server-filesystem /workspace
```

**Pros**:

- ✅ Works with STDIO transport
- ✅ Separate containers

**Cons**:

- ❌ Hacky, complex lifecycle management
- ❌ Not standard Docker practice

#### Approach 3: All Servers in Gateway Container (CURRENT PATTERN) ✅

What MetaMCP/mcp-proxy actually do:

```dockerfile
# Single container with all servers
FROM node:20
RUN npm install -g @modelcontextprotocol/server-filesystem
RUN npm install -g @modelcontextprotocol/server-postgres
CMD ["node", "gateway.js"]  # Gateway spawns servers as subprocesses
```

**Pros**:

- ✅ Simple, proven pattern
- ✅ Works with STDIO transport
- ✅ Efficient (no HTTP overhead)

**Cons**:

- ❌ All servers in one container (less isolation)
- ❌ Resource contention

---

### RECOMMENDED: Hybrid Architecture

**Use HTTP transport for containerized servers:**

```
Agent (MCP Client - STDIO/HTTP)
  ↓
AgentSkills Gateway Container (HTTP/SSE server)
  ↓ HTTP requests
  ├─→ Filesystem Server Container (HTTP)
  ├─→ Postgres Server Container (HTTP)
  └─→ GitHub Server Container (HTTP)
```

**Skill Declaration** (supports both):

```yaml
requires-mcp-servers:
  - name: filesystem
    package: "@modelcontextprotocol/server-filesystem"
    transport: http # NEW: Specify transport preference
    docker:
      image: "mcp-filesystem:latest"
      port: 3001
    stdio: # Fallback for non-Docker
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "${WORKSPACE}"]
```

**Benefits**:

- ✅ Proper container isolation (separate containers per server)
- ✅ Scalable and production-ready
- ✅ Supports both Docker and non-Docker deployments
- ✅ Uses appropriate transport for context

### Proposed Architecture for AgentSkills

**User Flow**:

1. User declares skills in `package.json`
2. Skills declare MCP server dependencies in SKILL.md
3. AgentSkills MCP server reads all skills, collects dependencies
4. Gateway spawns required MCP servers as subprocesses
5. Agent connects to gateway once, gets all tools

**Example Skill Declaration**:

```yaml
---
name: code-reviewer
description: Reviews code changes in repository
requires-mcp-servers:
  - name: filesystem
    package: "@modelcontextprotocol/server-filesystem"
    args: ["${WORKSPACE}"]
  - name: github
    package: "@modelcontextprotocol/server-github"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
---
```

**Gateway Behavior**:

```javascript
// Gateway reads all installed skills
const skills = loadSkills();

// Collect unique MCP server dependencies
const mcpDeps = collectDependencies(skills);
// → [filesystem, github, postgres, ...]

// Start each as subprocess with STDIO
mcpDeps.forEach((dep) => {
  spawnServer(dep.command, dep.args, dep.env);
  createInternalClient(dep.name, subprocess.stdin, subprocess.stdout);
});

// Agent connects to gateway
// Gateway aggregates tools: filesystem:read, github:create_issue, ...
```

### Benefits of Gateway Approach

✅ **Single Connection**: Agent connects once, gets all tools
✅ **Automatic Dependency Resolution**: Skills declare, gateway handles
✅ **Tool Namespacing**: No collision (filesystem:read vs github:read)
✅ **Unified Auth**: One auth point for agent
✅ **Docker Deployment**: Consistent environment
✅ **No Manual Config**: User doesn't configure each server separately
✅ **Security**: Credentials managed in one place

### Implementation Options

**Option A: Enhance AgentSkills MCP Server** (Recommended)

- Current `agentskills-mcp` server already exposes skills as tools
- Add gateway capability: parse skill dependencies, spawn servers
- Aggregate tools from subprocesses with tools from skills
- Single server handling both skills and dependencies

**Option B: Separate Gateway Service**

- Deploy MetaMCP/mcp-proxy alongside agentskills-mcp
- Configure gateway to read skill dependencies
- Agent connects to gateway instead of agentskills-mcp

**Option C: Fork Existing Gateway**

- Fork MetaMCP or 1MCP
- Add skill-aware configuration
- Replace manual config with automatic dependency resolution

### Challenges & Considerations

**Resource Usage**: Each subprocess = 50-100MB memory

- 10 servers = 500MB-1GB
- Solution: Pre-build Docker images with common servers

**Cold Start Time**: npx downloads packages on first run

- Solution: Cache in Docker image, or use pre-installed packages

**Security**: All servers in one container share resources

- Solution: Docker provides isolation from host

**Debugging**: Extra layer adds complexity

- Solution: Gateway logging, health checks

### Decision Point: Which Approach?

**Question for user**: Should we:

1. **Build gateway into agentskills-mcp** (integrated solution)
2. **Use existing gateway** (MetaMCP/mcp-proxy) with skill awareness
3. **Simple metadata-only** (no gateway, just documentation)

This dramatically changes the scope and value of the feature!

### RECOMMENDED SOLUTION: Approach 3 + Documentation

**Decision Rationale:**

**Decision:** REVISITED - Simple string array is insufficient.

**Key Insight from User:** Just storing server names like `"filesystem"` or `"postgres"` is not enough because we need to provide the **full MCP server specification** to the agent. The agent needs to know HOW to connect to these servers, not just their names.

**MCP Server Specification Requirements:**
An MCP server configuration typically includes:

- Server name/identifier
- Command to run the server
- Arguments/parameters
- Environment variables
- Working directory
- Possibly: connection type (stdio, SSE, etc.)

**Example from Claude Desktop config:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/allowed/files"
      ]
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://localhost/mydb"
      ],
      "env": {
        "PGPASSWORD": "secret"
      }
    }
  }
}
```

**OPEN QUESTION:** What format should we use in SKILL.md to capture this information?

**To be decided in Plan phase:**

- Should we embed full server specs in SKILL.md?
- Should we reference external server configs?
- Should we only declare names and expect users to configure separately?
- How do we handle sensitive data like passwords?

### 2. Implementation Scope (2026-02-21)

**Decision:** This feature is metadata-only - no runtime validation or enforcement.

**What it does:**

- Adds ability to declare MCP server dependencies in SKILL.md
- Parses and validates the field format
- Makes dependency information available to skill consumers

**What it doesn't do:**

- Check if declared servers are actually installed/available
- Prevent skill usage if dependencies are missing
- Automatically install or configure required MCP servers

**Rationale:**

- MCP server availability is environment-specific
- Skills are served via MCP, but server installation is a client concern
- Keeps implementation simple and focused on documentation/metadata

## Notes

### Current Frontmatter Schema (from types.ts)

The `SkillMetadata` interface currently supports:

**Required fields (Agent Skills standard):**

- `name`: string
- `description`: string

**Optional standard fields:**

- `license`: string
- `compatibility`: string
- `metadata`: Record<string, unknown>
- `allowedTools`: string[] (kebab-case: `allowed-tools`)

**Claude Code extensions:**

- `disableModelInvocation`: boolean (kebab-case: `disable-model-invocation`)
- `userInvocable`: boolean (kebab-case: `user-invocable`)
- `argumentHint`: string (kebab-case: `argument-hint`)
- `context`: string
- `agent`: string
- `model`: string
- `hooks`: Record<string, string>

**Field mapping:** The parser automatically converts kebab-case YAML fields to camelCase TypeScript fields using `FIELD_MAP` in parser.ts.

### Parsing Process

1. `parseSkillContent()` uses `gray-matter` library to extract YAML frontmatter
2. Required fields (`name`, `description`) are validated
3. Field names are mapped from kebab-case to camelCase via `mapFieldNames()`
4. Returns a frozen `Skill` object with `metadata` and `body`

### MCP Server Naming Conventions

Based on research and examples:

- MCP servers are typically identified by simple kebab-case names (e.g., `agentskills`, `filesystem`, `postgres`)
- NPM package names often use scoped format: `@scope/package-name` (e.g., `@codemcp/agentskills-mcp-server`)
- In Claude Desktop config, servers are referenced by simple identifiers in the `mcpServers` object
- Common MCP server examples: `filesystem`, `postgres`, `github`, `slack`, `google-drive`

**Proposed dependency format options:**

1. Simple string: `"filesystem"` - easiest for users
2. Object with optional metadata: `{ "name": "filesystem", "purpose": "file operations" }`
3. Array of strings: `["filesystem", "postgres"]` - supports multiple dependencies

### Agent Skills Standard Research Findings

**Official Specification Status:**

- ✅ Checked agentskills.io specification - **NO existing field** for MCP server dependencies
- ✅ Checked modelcontextprotocol.io - **NO skill dependency mechanism**
- ✅ Checked Anthropic Agent Skills examples - **NO dependency declarations found**

**Conclusion:** The `requires-mcp-servers` field is a **NEW extension** to the Agent Skills format, not part of the official standard. This is similar to `allowed-tools` which is marked as experimental.

**Existing Similar Fields:**

- `allowed-tools` - Space-delimited list for tool restrictions (experimental)
- `compatibility` - Free-text for environment requirements (but not structured/parseable)

**Our approach aligns with:**

- Existing codebase patterns (kebab-case → camelCase mapping)
- Array format like `allowedTools`
- Optional field pattern
- Future consideration: propose to agentskills.io as official standard extension

### Use Cases from GitHub Issue #2

1. **Skills that use file system operations** - need `filesystem` MCP server
2. **Skills that require web search** - need `brave-search`, `google-search`, or similar
3. **Skills that need database access** - need `postgres`, `mysql`, or similar
4. **Skills that depend on specialized tools** - need domain-specific MCP servers

**CRITICAL INSIGHT:** These skills don't just need to declare that they depend on an MCP server - they need to provide enough information for the agent to actually configure and use those servers.

### Solution Design Challenges (To Address in Plan Phase)

**Challenge 1: Full Server Specification Required**

- Agent needs: command, args, env vars, working directory
- Not just: server name

**Challenge 2: Portability vs. Specificity**

- Hardcoding paths/commands → not portable across systems
- Only declaring names → not actionable without manual config

**Challenge 3: Security Concerns**

- Passwords, API keys, credentials
- Should NOT be in version-controlled SKILL.md files
- Need separation of public config and secrets

**Challenge 4: Configuration Responsibility**

- Who configures the MCP servers? Skill author? End user? Client?
- How do we balance declarative vs. imperative approaches?

**Solution Options to Explore in Plan Phase:**

**Option A: Reference-based approach**

```yaml
requires-mcp-servers:
  - name: filesystem
    config-reference: "@modelcontextprotocol/server-filesystem"
    parameters:
      - "/path/to/workspace"
```

**Option B: Full specification embedded**

```yaml
requires-mcp-servers:
  - name: filesystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "${WORKSPACE}"]
```

**Option C: Hybrid - declare + template**

```yaml
requires-mcp-servers:
  - package: "@modelcontextprotocol/server-filesystem"
    description: "Provides file system access to workspace"
    template-args:
      - name: workspace_path
        description: "Path to allowed workspace"
        required: true
```

**Option D: Reference external server registry**

```yaml
requires-mcp-servers:
  - filesystem # Look up in known server registry
  - postgres # User must configure if not in registry
```

### Files Requiring Changes

**Core Package (`packages/core/src/`):**

1. **`types.ts`** - Add `requiresMcpServers?: string[]` to `SkillMetadata` interface
2. **`parser.ts`** - Add `"requires-mcp-servers": "requiresMcpServers"` to `FIELD_MAP`
3. **`validator.ts`** - Add validation for `requiresMcpServers` field (must be array of strings if present)

**Test Files:** 4. **`packages/core/src/__tests__/parser.test.ts`** - Add tests for parsing `requires-mcp-servers` field 5. **`packages/core/src/__tests__/validator.test.ts`** - Add tests for validating `requiresMcpServers` field 6. **`packages/core/src/__tests__/types.test.ts`** (if exists) - Add type tests

**Example/Demo Files:** 7. **`packages/demo/local-skills/example-skill/SKILL.md`** - Add example usage of new field

**Documentation (Optional but recommended):** 8. **`README.md`** - Update skill creation section to document new field

---

_This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management._
