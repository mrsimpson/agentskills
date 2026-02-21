# CLI Framework Test Suite

## Overview

This test suite follows **Test-Driven Development (TDD)** principles for the Agent Skills CLI framework. The tests define the expected behavior and API of the CLI before implementation.

## Test Philosophy

### TDD Approach

1. **Red Phase** ✅ - Write comprehensive failing tests
2. **Green Phase** - Implement minimal code to pass tests
3. **Refactor Phase** - Improve implementation while keeping tests green

### Testing Strategy

The test suite focuses on:

- **Framework Setup**: CLI initialization and configuration
- **Command Registration**: Verifying all commands are properly registered
- **Command Structure**: Arguments and options for each command
- **Help System**: Main help and command-specific help text
- **Parsing**: Command and option parsing behavior
- **Error Handling**: Graceful error handling and exit codes

## Test Structure

### Test File: `cli.test.ts`

```
CLI Framework (55 tests)
├── Program Initialization (4 tests)
│   ├── Commander instance creation
│   ├── Program name configuration
│   ├── Version from package.json
│   └── Description presence
│
├── Command Registration (5 tests)
│   ├── Create command
│   ├── Validate command
│   ├── List command
│   ├── Config command
│   └── Total command count
│
├── Create Command (4 tests)
│   ├── Description
│   ├── <name> argument (required)
│   ├── --template option
│   └── --path option
│
├── Validate Command (4 tests)
│   ├── Description
│   ├── [path] argument (optional)
│   ├── --strict flag
│   └── --fix flag
│
├── List Command (3 tests)
│   ├── Description
│   ├── --format option
│   └── --filter option
│
├── Config Command (2 tests)
│   ├── Description
│   └── <action> argument (required)
│
├── Help Output (4 tests)
│   ├── Main help display
│   ├── Version in help
│   ├── Help option
│   └── Command descriptions
│
├── Command-Specific Help (4 tests)
│   ├── Create command help
│   ├── Validate command help
│   ├── List command help
│   └── Config command help
│
├── Version Command (2 tests)
│   ├── Version output
│   └── Semantic versioning format
│
├── Error Handling (3 tests)
│   ├── Unknown commands
│   ├── Error handler configuration
│   └── Custom error handlers
│
├── Global Options (2 tests)
│   ├── --help support
│   └── --version support
│
├── Command Parsing (4 tests)
│   ├── Create with arguments
│   ├── Validate with optional path
│   ├── List command
│   └── Config with action
│
├── Option Parsing (6 tests)
│   ├── --template for create
│   ├── --path for create
│   ├── --strict for validate
│   ├── --fix for validate
│   ├── --format for list
│   └── --filter for list
│
├── Exit Codes (2 tests)
│   ├── Exit behavior configuration
│   └── Exit override for testing
│
├── Integration Tests (4 tests)
│   ├── Complete create flow
│   ├── Complete validate flow
│   ├── Complete list flow
│   └── Complete config flow
│
├── Command Aliases (1 test)
│   └── Alias support check
│
└── Output Configuration (1 test)
    └── Custom output handlers
```

## Command Specifications

### 1. Create Command

```bash
agentskills create <name> [options]
```

**Arguments:**

- `<name>` (required) - Name of the skill to create

**Options:**

- `--template <type>` - Template to use (basic, advanced, etc.)
- `--path <dir>` - Directory path for the new skill

**Tests:**

- Argument parsing
- Option parsing
- Help display

---

### 2. Validate Command

```bash
agentskills validate [path] [options]
```

**Arguments:**

- `[path]` (optional) - Path to skill(s) to validate

**Options:**

- `--strict` - Enable strict validation mode
- `--fix` - Automatically fix validation issues

**Tests:**

- Optional argument handling
- Flag parsing
- Help display

---

### 3. List Command

```bash
agentskills list [options]
```

**Options:**

- `--format <type>` - Output format (table, json, yaml)
- `--filter <query>` - Filter criteria

**Tests:**

- No arguments
- Option parsing
- Help display

---

### 4. Config Command

```bash
agentskills config <action> [options]
```

**Arguments:**

- `<action>` (required) - Configuration action (show, set, reset)

**Tests:**

- Required argument
- Action parsing
- Help display

## Running Tests

### Run All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### With Coverage

```bash
npm run test:coverage
```

### Run Specific Test Suite

```bash
npm test -- cli.test.ts
```

### Run Specific Test

```bash
npm test -- -t "should register create command"
```

## Expected Test Flow (TDD)

### Current Status: RED PHASE ✅

All 55 tests are written and currently failing as expected:

- 45 tests failing (implementation needed)
- 10 tests passing (framework capabilities)

### Next Steps: GREEN PHASE

Implement `cli.ts` to make tests pass:

1. **Basic Setup**
   - [ ] Import Commander and create program
   - [ ] Set program name to 'agentskills'
   - [ ] Load version from package.json
   - [ ] Add description

2. **Command Creation**
   - [ ] Create `createCreateCommand()` function
   - [ ] Create `createValidateCommand()` function
   - [ ] Create `createListCommand()` function
   - [ ] Create `createConfigCommand()` function

3. **Command Registration**
   - [ ] Register all commands with program
   - [ ] Add command descriptions
   - [ ] Configure arguments and options

4. **Error Handling**
   - [ ] Configure error output
   - [ ] Add exit code handling

### Refactor Phase

Once tests pass:

- Extract command builders to separate files
- Add shared option builders
- Improve error messages
- Add output formatting helpers

## Test Coverage Goals

- ✅ **Framework Setup**: 100%
- ✅ **Command Registration**: 100%
- ✅ **Help System**: 100%
- ✅ **Parsing**: 100%
- ✅ **Integration**: 100%

## Notes for Implementation

### Version Loading

```typescript
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8")
);
const VERSION = packageJson.version;
```

### Command Structure

Each command should be created by a dedicated function:

```typescript
function createCreateCommand(): Command {
  return new Command("create")
    .description("Create a new skill")
    .argument("<name>", "Name of the skill")
    .option("-t, --template <type>", "Template to use")
    .option("-p, --path <dir>", "Target directory")
    .action((name, options) => {
      // Implementation will be in separate command handler
    });
}
```

### Mock Actions

The tests inject mock actions to verify parsing without implementing actual command logic. This allows testing the framework independently from command implementations.

## Best Practices

1. **Test in Isolation**: Each test should be independent
2. **Mock External Dependencies**: Use vi.fn() for action handlers
3. **Verify Structure**: Check command registration and options
4. **Test Parsing**: Verify arguments and options are parsed correctly
5. **Integration Tests**: Test complete command flows end-to-end

## Continuous Integration

These tests should be run:

- Before every commit
- In CI/CD pipeline
- Before releasing new versions
- After dependency updates

## References

- [Commander.js Documentation](https://github.com/tj/commander.js)
- [Vitest Documentation](https://vitest.dev/)
- [TDD Best Practices](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
