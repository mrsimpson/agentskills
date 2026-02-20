# Agent Skills Demo

This package demonstrates the complete workflow of using `agentskills` CLI to manage skills.

## Setup

From the monorepo root:

```bash
# Build the CLI
pnpm build --filter @agentskills/cli

# Link the CLI for local usage (optional)
cd packages/cli
npm link
```

## Demo Workflow

### 1. Add a Local Skill

```bash
cd packages/demo

# Add the example skill from local directory
agentskills add example-skill file:./local-skills/example-skill
```

This will:
- Add `example-skill` to `package.json` under `agentskills` field
- Install it to `.agentskills/skills/example-skill/`
- Generate a lock file at `.agentskills/skills-lock.json`

### 2. View Updated package.json

```bash
cat package.json
```

You should see:
```json
{
  "agentskills": {
    "example-skill": "file:./local-skills/example-skill"
  }
}
```

### 3. Verify Installation

```bash
ls -la .agentskills/skills/
cat .agentskills/skills/example-skill/SKILL.md
```

### 4. Install from package.json

If you delete `.agentskills/` and want to reinstall:

```bash
rm -rf .agentskills
agentskills install
```

This reads `package.json` and installs all declared skills.

## Adding Skills from Git

```bash
# Add a skill from GitHub
agentskills add api-integration github:anthropic/api-integration#v1.0.0

# Add from Git URL
agentskills add database-query git+https://github.com/org/db-skill.git
```

## Options

```bash
# Add without installing (just update package.json)
agentskills add my-skill github:user/repo --skip-install

# Use custom working directory
agentskills add my-skill file:./skill --cwd /path/to/project
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
rm package.json
```
