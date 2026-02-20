# Agent Skills Demo

This package demonstrates the complete workflow of using `agentskills` CLI to manage skills.

## Setup

From the monorepo root:

```bash
# Build the CLI (uses esbuild)
pnpm build --filter @agentskills/cli

# Verify CLI is built
ls -l packages/cli/dist/index.js
```

## Demo Workflow

### 1. Add a Local Skill

```bash
cd packages/demo

# Add the example skill from local directory
node ../cli/dist/index.js add example-skill file:./local-skills/example-skill
```

This will:
- Add `example-skill` to `package.json` under `agentskills` field
- Install it to `.agentskills/skills/example-skill/`
- Generate a lock file at `.agentskills/skills-lock.json`

**Expected output:**
```
✓ Added example-skill to package.json
[spinner] Installing example-skill...
✓ example-skill installed successfully

✅ Successfully added example-skill
   Spec: file:./local-skills/example-skill
```

### 2. View Updated package.json

```bash
cat package.json
```

You should see:
```json
{
  "name": "agentskills-demo",
  "version": "0.1.0",
  "agentskills": {
    "example-skill": "file:./local-skills/example-skill"
  }
}
```

### 3. Verify Installation

```bash
ls -la .agentskills/skills/
cat .agentskills/skills/example-skill/SKILL.md
cat .agentskills/skills-lock.json
```

### 4. Install from package.json

If you delete `.agentskills/` and want to reinstall:

```bash
rm -rf .agentskills
node ../cli/dist/index.js install
```

**Expected output:**
```
📦 Installing skills...
✓ example-skill (file:./local-skills/example-skill)

✅ Successfully installed 1 skill
📁 1 skill installed to .agentskills/skills
```

This reads `package.json` and installs all declared skills.

## Adding Skills from Git

```bash
# Add a skill from GitHub (will fail if repo doesn't exist, but updates package.json)
node ../cli/dist/index.js add api-integration github:anthropic/api-integration#v1.0.0

# Add from Git URL
node ../cli/dist/index.js add database-query git+https://github.com/org/db-skill.git
```

## Options

```bash
# Add without installing (just update package.json)
node ../cli/dist/index.js add my-skill github:user/repo --skip-install

# Use custom working directory
node ../cli/dist/index.js add my-skill file:./skill --cwd /path/to/project

# Install from custom directory
node ../cli/dist/index.js install --cwd /path/to/project
```

## File Structure After Setup

```
packages/demo/
├── package.json               # Contains agentskills declarations
├── local-skills/
│   └── example-skill/
│       └── SKILL.md          # Source skill definition
└── .agentskills/
    ├── skills/               # Installed skills
    │   └── example-skill/
    │       └── SKILL.md
    └── skills-lock.json      # Lock file for reproducibility
```

## Cleanup

```bash
rm -rf .agentskills
# Reset package.json to original state
echo '{
  "name": "agentskills-demo",
  "version": "0.1.0",
  "description": "Demo package showing agentskills CLI usage",
  "private": true,
  "type": "module"
}' > package.json
```

## All Available Commands

```bash
# Show help
node ../cli/dist/index.js --help

# Validate a skill
node ../cli/dist/index.js validate ./local-skills/example-skill

# List commands (stub)
node ../cli/dist/index.js list

# Config commands (stub)
node ../cli/dist/index.js config show
```
