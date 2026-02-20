# ConfigManager Test Suite - Quick Reference

## Test Execution Summary

**Status**: ✅ All tests written and failing as expected (Red phase of TDD)
- Total: 40 tests
- Failing: 37 (expected - implementation pending)
- Passing: 3 (error handling tests that already work)

## Test Suite Structure

### 1. Load from File (5 tests)
```typescript
// packages/core/src/__tests__/config-manager.test.ts:89-236
- should load valid YAML config
- should load valid JSON config  
- should parse sources array correctly
- should parse settings object correctly
- should handle config with only required fields
```

### 2. File Discovery (5 tests)
```typescript
// packages/core/src/__tests__/config-manager.test.ts:238-401
- should find .agentskills/config.yaml in current directory
- should find .agentskills/config.json if no YAML exists
- should find ~/.agentskills/config.yaml in home directory
- should prefer current directory over home directory
- should prefer YAML over JSON in same directory
```

### 3. Default Configuration (4 tests)
```typescript
// packages/core/src/__tests__/config-manager.test.ts:403-452
- should return default config when no config file exists
- should use defaults when loadConfig finds no file
- should include default settings
- should have sensible default values
```

### 4. Validation (9 tests)
```typescript
// packages/core/src/__tests__/config-manager.test.ts:454-673
- should reject config with missing version field
- should reject config with invalid version format
- should reject config with invalid sources (not array)
- should reject config with invalid source type
- should reject source with missing path
- should reject config with invalid settings type
- should reject config with invalid logLevel value
- should reject config with invalid maxSkillSize type
- should reject empty sources array
```

### 5. Path Resolution (4 tests)
```typescript
// packages/core/src/__tests__/config-manager.test.ts:675-782
- should expand tilde in paths
- should resolve relative paths to absolute
- should leave absolute paths unchanged
- should handle mixed path types correctly
```

### 6. Error Handling (5 tests)
```typescript
// packages/core/src/__tests__/config-manager.test.ts:784-916
- should reject invalid YAML syntax
- should reject invalid JSON syntax
- should handle file read errors (✅ passing)
- should handle unreadable files (✅ passing)
- should provide meaningful error messages (✅ passing)
```

### 7. Edge Cases (6 tests)
```typescript
// packages/core/src/__tests__/config-manager.test.ts:918-1046
- should handle empty settings object
- should handle missing settings field with defaults
- should handle sources without priority
- should handle very long paths
- should handle special characters in paths
- should handle multiple sources with same path
```

### 8. Integration Tests (2 tests)
```typescript
// packages/core/src/__tests__/config-manager.test.ts:1048-1120
- should load, validate, and resolve paths in one workflow
- should prefer explicit path over auto-discovery
```

## Key Test Patterns

### Basic Test Structure
```typescript
it("should do something", async () => {
  // Arrange - setup test environment
  const configDir = join(testDir, ".agentskills");
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(join(configDir, "config.yaml"), configContent);

  // Act - execute the function
  const config = await ConfigManager.loadConfig(path);

  // Assert - verify results
  expect(config.version).toBe("1.0");
});
```

### Error Testing Pattern
```typescript
it("should reject invalid config", async () => {
  // Arrange - create invalid config
  await fs.writeFile(path, invalidContent);

  // Act & Assert - expect error
  await expect(
    ConfigManager.loadConfig(path)
  ).rejects.toThrow(/error pattern/i);
});
```

### Path Testing Pattern
```typescript
it("should resolve paths", async () => {
  // Arrange - config with various path types
  const configContent = `
    sources:
      - path: ~/home/path    # Should expand
      - path: ./rel/path     # Should resolve
      - path: /abs/path      # Should remain
  `;
  
  // Act
  const config = await ConfigManager.loadConfig(path);

  // Assert
  expect(config.sources[0].path).not.toContain("~");
  expect(config.sources[1].path).toMatch(/^[/\\]/);
  expect(config.sources[2].path).toBe("/abs/path");
});
```

## Implementation Checklist

When implementing config-manager.ts, ensure:

### Core Functionality
- [ ] Load YAML files using js-yaml
- [ ] Load JSON files using JSON.parse()
- [ ] Auto-discover config files
- [ ] Return default config when no file found
- [ ] Handle explicit paths
- [ ] Implement file precedence (current > home, yaml > json)

### Validation
- [ ] Validate version field (required, string)
- [ ] Validate sources (required, non-empty array)
- [ ] Validate source type (must be "local_directory")
- [ ] Validate source path (required)
- [ ] Validate settings type (object if present)
- [ ] Validate logLevel enum
- [ ] Validate maxSkillSize type

### Path Resolution
- [ ] Expand ~ to home directory (os.homedir())
- [ ] Resolve relative paths to absolute (path.resolve())
- [ ] Leave absolute paths unchanged
- [ ] Handle Windows paths correctly

### Error Handling
- [ ] Catch YAML parsing errors
- [ ] Catch JSON parsing errors
- [ ] Handle file not found
- [ ] Handle permission errors
- [ ] Provide clear error messages

### Defaults
- [ ] Default version: "1.0"
- [ ] Default sources: [".claude/skills/", "~/.claude/skills/"]
- [ ] Default settings with reasonable values

## Test Commands

```bash
# Run all ConfigManager tests
npm test -- config-manager.test.ts

# Run specific test suite
npm test -- config-manager.test.ts -t "File discovery"

# Run in watch mode (for TDD)
npm run test:watch -- config-manager.test.ts

# Type check
npm run typecheck

# Lint check
npm run lint
```

## Files Modified/Created

### Created
- ✅ `packages/core/src/__tests__/config-manager.test.ts` - Test suite (1000+ lines)
- ✅ `packages/core/src/__tests__/CONFIG_MANAGER_TEST_SUMMARY.md` - Full documentation

### Modified
- ✅ `packages/core/src/types.ts` - Added Config, ConfigSettings interfaces

### To Create
- ⏳ `packages/core/src/config-manager.ts` - Implementation

### To Modify
- ⏳ `packages/core/src/index.ts` - Export ConfigManager

## Expected Implementation Signature

```typescript
// packages/core/src/config-manager.ts

import { Config } from "./types";

export class ConfigManager {
  /**
   * Load configuration from file or auto-discover
   * 
   * Discovery order:
   * 1. Explicit configPath (if provided)
   * 2. .agentskills/config.yaml (current dir)
   * 3. .agentskills/config.json (current dir)
   * 4. ~/.agentskills/config.yaml (home dir)
   * 5. ~/.agentskills/config.json (home dir)
   * 6. Default config
   */
  static async loadConfig(configPath?: string): Promise<Config>;

  /**
   * Get default configuration
   * 
   * Returns:
   * - version: "1.0"
   * - sources: [".claude/skills/", "~/.claude/skills/"]
   * - settings: default values
   */
  static getDefaultConfig(): Config;
}
```

## Success Criteria

Implementation is complete when:
- ✅ All 40 tests pass
- ✅ Type checking passes
- ✅ Linting passes
- ✅ Code coverage > 95%
- ✅ Error messages are clear and helpful
- ✅ Edge cases handled correctly

## TDD Workflow

Current: **RED** ✅ (Tests written and failing)

Next steps:
1. **GREEN** - Make tests pass with minimal code
2. **REFACTOR** - Clean up and optimize
3. **INTEGRATE** - Export from index.ts
4. **DOCUMENT** - Add JSDoc comments

---

**Note**: This is TDD in action! Tests are written first to drive the design and ensure comprehensive coverage. The implementation will be guided by these tests.
