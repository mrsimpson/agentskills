# Add Command Tests - TDD RED Phase

## Overview

This document summarizes the TDD RED phase tests for the `agentskills add` command.

## Test Results

✅ **All 14 tests written and failing as expected** (RED phase complete)

```
Test Files  1 failed (1)
     Tests  14 failed (14)
```

## Test Suite Structure

### 1. Basic Operation (4 tests)

- ✗ should add skill to package.json and install it
- ✗ should create agentskills field if it does not exist
- ✗ should create package.json if it does not exist
- ✗ should display success message with skill name and spec

### 2. Error Handling (4 tests)

- ✗ should throw error when skill name is empty
- ✗ should throw error when spec is empty
- ✗ should handle invalid spec format during installation
- ✗ should throw error when installation fails but update package.json

### 3. Options (2 tests)

- ✗ should skip installation when skipInstall flag is true
- ✗ should use custom cwd option

### 4. Update Existing (2 tests)

- ✗ should update existing skill with new spec
- ✗ should preserve other skills when adding new skill

### 5. Output (2 tests)

- ✗ should show spinner during installation
- ✗ should show success checkmark and summary after installation

## Command Interface

```typescript
export async function addCommand(
  name: string,
  spec: string,
  options?: {
    cwd?: string;
    skipInstall?: boolean;
  }
): Promise<void>;
```

## Usage Examples

```bash
# Add and install skill
agentskills add api-integration github:anthropic/api-integration#v1.0.0

# Add local skill
agentskills add local-skill file:./skills/my-skill

# Add without installing (just update package.json)
agentskills add --skip-install my-skill git+https://...
```

## Expected Behavior

1. **Read/Create package.json**: Use PackageConfigManager to read or create package.json
2. **Add skill**: Use `configManager.addSkill(name, spec)` to add skill to agentskills field
3. **Install**: Use SkillInstaller to install the skill (unless `skipInstall` is true)
4. **Display**: Show spinner during install, success checkmark and summary after

## Test Quality Principles

- ✅ Focused tests (14 tests, not over-tested)
- ✅ Real file system (temp directories)
- ✅ Mocked SkillInstaller to avoid real downloads
- ✅ Clear arrange-act-assert structure
- ✅ Tests define user experience before implementation
- ✅ Follows existing test patterns from install.test.ts

## Files Created

1. **Test file**: `packages/cli/src/commands/__tests__/add.test.ts`
2. **Stub implementation**: `packages/cli/src/commands/add.ts`

## Next Steps

**GREEN Phase**: Implement the `addCommand` function to make all tests pass.

Key implementation requirements:

- Validate inputs (empty name/spec)
- Use PackageConfigManager.addSkill() to update package.json
- Use SkillInstaller.install() unless skipInstall is true
- Handle installation failures appropriately
- Show proper spinner and success messages
- Support custom cwd option
