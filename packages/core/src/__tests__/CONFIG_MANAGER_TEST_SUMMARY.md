# ConfigManager Test Suite Summary

## Overview
Comprehensive test suite for ConfigManager component following TDD (Test-Driven Development) approach. Tests written **before** implementation to drive the design and ensure complete coverage.

## Test File Location
- **Test File**: `packages/core/src/__tests__/config-manager.test.ts`
- **Implementation File**: `packages/core/src/config-manager.ts` (to be created)
- **Type Definitions**: `packages/core/src/types.ts` (Config, ConfigSettings interfaces added)

## Test Statistics
- **Total Tests**: 40
- **Test Suites**: 8
- **Lines of Code**: ~1,000+

## Test Coverage Areas

### 1. Load from File (5 tests)
Tests the ability to load and parse configuration files in different formats.

**Tests:**
- ✅ should load valid YAML config
- ✅ should load valid JSON config
- ✅ should parse sources array correctly
- ✅ should parse settings object correctly
- ✅ should handle config with only required fields

**Key Scenarios:**
- YAML format parsing with js-yaml
- JSON format parsing
- Multiple sources with priorities
- Settings with maxSkillSize and logLevel
- Minimal valid configuration

### 2. File Discovery (5 tests)
Tests automatic configuration file discovery and location precedence.

**Tests:**
- ✅ should find .agentskills/config.yaml in current directory
- ✅ should find .agentskills/config.json if no YAML exists
- ✅ should find ~/.agentskills/config.yaml in home directory
- ✅ should prefer current directory over home directory
- ✅ should prefer YAML over JSON in same directory

**Key Scenarios:**
- Current directory: `.agentskills/config.yaml`
- Home directory: `~/.agentskills/config.yaml`
- Format precedence: YAML > JSON
- Location precedence: current dir > home dir

### 3. Default Configuration (4 tests)
Tests fallback behavior when no configuration file exists.

**Tests:**
- ✅ should return default config when no config file exists
- ✅ should use defaults when loadConfig finds no file
- ✅ should include default settings
- ✅ should have sensible default values

**Default Values:**
- Version: "1.0"
- Sources: [".claude/skills/", "~/.claude/skills/"]
- Settings: maxSkillSize and logLevel with sensible defaults

### 4. Validation (9 tests)
Tests comprehensive schema validation and error handling.

**Tests:**
- ✅ should reject config with missing version field
- ✅ should reject config with invalid version format
- ✅ should reject config with invalid sources (not array)
- ✅ should reject config with invalid source type
- ✅ should reject source with missing path
- ✅ should reject config with invalid settings type
- ✅ should reject config with invalid logLevel value
- ✅ should reject config with invalid maxSkillSize type
- ✅ should reject empty sources array

**Validation Rules:**
- Version: required, must be string (e.g., "1.0")
- Sources: required, must be non-empty array
- Source type: must be "local_directory"
- Source path: required for each source
- Settings: optional, but if present must be object
- LogLevel: must be one of: error, warn, info, debug
- MaxSkillSize: must be number if present
- Sources array: cannot be empty

### 5. Path Resolution (4 tests)
Tests different path formats and their resolution.

**Tests:**
- ✅ should expand tilde in paths
- ✅ should resolve relative paths to absolute
- ✅ should leave absolute paths unchanged
- ✅ should handle mixed path types correctly

**Path Handling:**
- Tilde expansion: `~/path` → `/home/user/path`
- Relative resolution: `./path` → `/absolute/current/dir/path`
- Absolute unchanged: `/abs/path` → `/abs/path`
- Mixed handling in single config

### 6. Error Handling (5 tests)
Tests various error conditions and error message quality.

**Tests:**
- ✅ should reject invalid YAML syntax
- ✅ should reject invalid JSON syntax
- ✅ should handle file read errors
- ✅ should handle unreadable files
- ✅ should provide meaningful error messages

**Error Scenarios:**
- Malformed YAML (parsing errors)
- Malformed JSON (parsing errors)
- Non-existent files
- Permission denied (unreadable)
- Clear, descriptive error messages

### 7. Edge Cases (6 tests)
Tests boundary conditions and unusual but valid scenarios.

**Tests:**
- ✅ should handle empty settings object
- ✅ should handle missing settings field with defaults
- ✅ should handle sources without priority
- ✅ should handle very long paths
- ✅ should handle special characters in paths
- ✅ should handle multiple sources with same path

**Edge Scenarios:**
- Empty objects
- Missing optional fields
- Very long strings (1000+ chars)
- Special characters in paths (spaces, dashes, underscores)
- Duplicate configurations

### 8. Integration Tests (2 tests)
Tests complete end-to-end workflows combining multiple features.

**Tests:**
- ✅ should load, validate, and resolve paths in one workflow
- ✅ should prefer explicit path over auto-discovery

**Integration Scenarios:**
- Complete workflow: load → validate → resolve paths
- Explicit path precedence over auto-discovery

## Test Isolation & Best Practices

### Isolation Strategy
- ✅ Uses temporary directories for each test
- ✅ Cleans up after each test (beforeEach/afterEach)
- ✅ Saves and restores working directory
- ✅ Saves and restores HOME environment variable
- ✅ No shared state between tests

### Test Structure
- **Arrange**: Setup test data and environment
- **Act**: Execute the function under test
- **Assert**: Verify expected outcomes

### Minimal Mocking
- Uses real file system (with temp directories)
- Uses real YAML/JSON parsing
- Tests actual path resolution
- Only mocks HOME environment when needed

## Configuration Schema

### Complete Example (YAML)
```yaml
version: "1.0"
sources:
  - type: local_directory
    path: .claude/skills
    priority: 1
  - type: local_directory
    path: ~/.claude/skills
    priority: 2
settings:
  maxSkillSize: 5000
  logLevel: info
```

### Complete Example (JSON)
```json
{
  "version": "1.0",
  "sources": [
    {
      "type": "local_directory",
      "path": ".claude/skills",
      "priority": 1
    },
    {
      "type": "local_directory",
      "path": "~/.claude/skills",
      "priority": 2
    }
  ],
  "settings": {
    "maxSkillSize": 5000,
    "logLevel": "info"
  }
}
```

## Expected Interface

### ConfigManager Class
```typescript
class ConfigManager {
  /**
   * Load configuration from file or discover automatically
   * @param configPath - Optional explicit path to config file
   * @returns Parsed and validated configuration
   * @throws Error if config invalid or file unreadable
   */
  static async loadConfig(configPath?: string): Promise<Config>

  /**
   * Get default configuration when no file exists
   * @returns Default configuration object
   */
  static getDefaultConfig(): Config
}
```

### Config Interface
```typescript
interface Config {
  version: string;
  sources: SkillSource[];
  settings: ConfigSettings;
}

interface SkillSource {
  type: "local_directory";
  path: string;
  priority?: number;
}

interface ConfigSettings {
  maxSkillSize?: number;
  logLevel?: "error" | "warn" | "info" | "debug";
}
```

## Implementation Requirements

### Must Have
1. **File Loading**
   - Load from explicit path
   - Auto-discover in current dir: `.agentskills/config.yaml` or `.agentskills/config.json`
   - Auto-discover in home dir: `~/.agentskills/config.yaml` or `~/.agentskills/config.json`
   - Precedence: current dir > home dir, YAML > JSON

2. **Parsing**
   - Parse YAML using `js-yaml` library
   - Parse JSON using `JSON.parse()`
   - Extract version, sources, settings

3. **Validation**
   - Validate version field (required, string)
   - Validate sources (required, non-empty array)
   - Validate each source (type, path required)
   - Validate settings type (object if present)
   - Validate logLevel values
   - Validate maxSkillSize type

4. **Path Resolution**
   - Expand tilde (`~`) to home directory
   - Resolve relative paths to absolute
   - Leave absolute paths unchanged
   - Use `path.resolve()`, `path.join()`, `os.homedir()`

5. **Error Handling**
   - Catch and wrap YAML parsing errors
   - Catch and wrap JSON parsing errors
   - Handle file not found
   - Handle permission errors
   - Provide descriptive error messages

6. **Defaults**
   - Default version: "1.0"
   - Default sources: [".claude/skills/", "~/.claude/skills/"]
   - Default settings: reasonable values for maxSkillSize and logLevel

### Dependencies
- `js-yaml`: ^4.1.0 (already installed)
- `fs/promises`: Node.js built-in
- `path`: Node.js built-in
- `os`: Node.js built-in

## Running Tests

### Run all ConfigManager tests
```bash
cd packages/core
npm test -- config-manager.test.ts
```

### Run in watch mode
```bash
cd packages/core
npm run test:watch -- config-manager.test.ts
```

### Run with coverage
```bash
cd packages/core
npm test -- --coverage config-manager.test.ts
```

## Current Status

- ✅ Test suite written (40 tests)
- ✅ Type definitions added to types.ts
- ✅ Tests are failing (Red phase - expected)
- ⏳ Implementation pending (config-manager.ts)
- ⏳ Green phase (make tests pass)
- ⏳ Refactor phase (optimize implementation)

## Next Steps

1. **Create config-manager.ts**
   - Implement ConfigManager class
   - Implement loadConfig() method
   - Implement getDefaultConfig() method

2. **Make Tests Pass (Green Phase)**
   - Start with simplest tests
   - Add validation logic
   - Add path resolution
   - Add error handling

3. **Refactor**
   - Optimize code structure
   - Extract helper functions
   - Add JSDoc comments
   - Ensure code quality

4. **Export from index.ts**
   - Add ConfigManager to public API
   - Export Config types

## Test-Driven Benefits

This TDD approach provides:
- ✅ **Clear specification** - Tests document expected behavior
- ✅ **Design validation** - Interface designed for usability
- ✅ **Safety net** - Catches regressions immediately
- ✅ **Documentation** - Tests serve as usage examples
- ✅ **Confidence** - 100% coverage from the start
- ✅ **Quality** - Forces thinking about edge cases upfront

## Related Files

- Test file: `packages/core/src/__tests__/config-manager.test.ts`
- Implementation: `packages/core/src/config-manager.ts` (to create)
- Types: `packages/core/src/types.ts` (updated)
- Export: `packages/core/src/index.ts` (to update)

## References

- Design doc: `.agentskills/config.yaml` format
- TDD pattern: agentic-knowledge project
- Test patterns: Existing parser.test.ts, registry.test.ts
