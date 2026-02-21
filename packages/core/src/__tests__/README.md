# SkillParser Test Suite

Comprehensive test suite for the SkillParser component following Test-Driven Development (TDD) principles.

## Overview

This test suite was written **before** the implementation, following TDD best practices. It defines the expected behavior and interface of the SkillParser component through 29 comprehensive tests.

## Test Philosophy

Following patterns from `agentic-knowledge`:

- **Minimal mocking**: Use real file system with temporary directories
- **Clear test structure**: Arrange-Act-Assert pattern
- **Test-driven interface design**: Tests define the API contract
- **Real-world scenarios**: Test fixtures represent actual use cases

## Test Structure

### 1. Valid Skill Parsing (8 tests)

Tests for successfully parsing well-formed skills:

- `should parse a basic skill with name and description`
  - Basic skill with only required fields
  - Tests core parsing functionality

- `should parse a skill with all optional fields`
  - Skill with license, compatibility, metadata, allowed-tools
  - Tests complete Agent Skills standard support

- `should parse Claude Code extensions`
  - Tests disable-model-invocation, user-invocable, argument-hint
  - Tests context, agent, model fields
  - Tests hooks object

- `should handle skill with nested metadata structures`
  - Deep nesting (level1 → level2 → level3)
  - Mixed types (objects, arrays, primitives)

- `should handle special characters in fields`
  - Unicode characters (émojis, CJK characters)
  - Special symbols (<>&, quotes)
  - HTML entities

- `should handle very long descriptions`
  - Descriptions exceeding recommended ~100 token limit
  - Multi-paragraph descriptions

- `should handle empty optional fields`
  - Empty strings, empty objects, empty arrays
  - Tests proper handling vs undefined

- `should handle skill with only frontmatter (no body)`
  - Valid skill with empty body content
  - Edge case but should be supported

### 2. Invalid/Malformed Skills (5 tests)

Tests for proper error handling:

- `should fail when frontmatter is missing`
  - File with no YAML frontmatter
  - Error code: `MISSING_FRONTMATTER`

- `should fail when YAML syntax is invalid`
  - Malformed YAML (unclosed brackets, invalid syntax)
  - Error code: `INVALID_YAML`

- `should fail when required field 'name' is missing`
  - Frontmatter without name field
  - Error code: `MISSING_REQUIRED_FIELD`, field: "name"

- `should fail when required field 'description' is missing`
  - Frontmatter without description field
  - Error code: `MISSING_REQUIRED_FIELD`, field: "description"

- `should fail when file is empty`
  - Completely empty file
  - Error code: `EMPTY_FILE`

### 3. File System Handling (5 tests)

Tests for file system operations (using `parseSkill`):

- `should successfully parse a valid skill file`
  - End-to-end file reading and parsing
  - Uses temporary directory

- `should fail when file does not exist`
  - Non-existent file path
  - Error code: `FILE_NOT_FOUND`

- `should fail gracefully on file read error`
  - Attempting to read a directory as file
  - Error code: `FILE_READ_ERROR`

- `should handle permission errors gracefully`
  - File with no read permissions (Unix only)
  - Error code: `FILE_READ_ERROR`

- `should handle invalid UTF-8 encoding gracefully`
  - File with invalid UTF-8 byte sequences
  - Should not crash, handle gracefully

### 4. Type Definitions (2 tests)

Runtime validation of TypeScript types:

- `should return properly typed Skill object`
  - Validates Skill shape (metadata + body)
  - Validates SkillMetadata fields
  - Type guards for optional fields

- `should return properly typed ParseError on failure`
  - Validates ParseError shape (code + message)
  - Validates field property for field-specific errors

### 5. Edge Cases (8 tests)

Corner cases and unusual but valid inputs:

- `should handle frontmatter with no body whitespace`
  - Frontmatter ending delimiter immediately followed by EOF
- `should handle frontmatter with extra whitespace`
  - Extra blank lines around frontmatter delimiters

- `should handle CRLF line endings`
  - Windows-style line endings (\r\n)

- `should handle mixed line endings`
  - Combination of \r\n and \n

- `should preserve markdown formatting in body`
  - Headers, bold, italic, lists, code blocks, quotes, links
  - Ensures no unintended parsing/transformation

- `should handle frontmatter delimiter in body`
  - Body content containing `---` (triple dash)
  - Should not confuse parser

- `should handle numeric field values`
  - YAML numbers (integers, floats)
  - Should preserve numeric types

- `should handle boolean field values`
  - YAML booleans (true/false)
  - Should preserve boolean types

### 6. Immutability (1 test)

Tests design principle:

- `should return immutable Skill object`
  - Returned objects should be immutable
  - Follows "Immutability After Load" principle

## Test Fixtures

Located in `__tests__/fixtures/skills/`:

| Fixture                     | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `basic-skill.md`            | Minimal valid skill (name + description)     |
| `full-skill.md`             | All optional fields + Claude Code extensions |
| `claude-code-extensions.md` | All Claude-specific fields                   |
| `missing-frontmatter.md`    | No YAML frontmatter (error case)             |
| `invalid-yaml.md`           | Malformed YAML syntax (error case)           |
| `missing-name.md`           | No name field (error case)                   |
| `missing-description.md`    | No description field (error case)            |
| `empty.md`                  | Empty file (error case)                      |
| `only-frontmatter.md`       | Valid frontmatter, no body                   |
| `special-characters.md`     | Unicode, émojis, special symbols             |
| `long-description.md`       | Multi-paragraph description                  |
| `nested-metadata.md`        | Deep metadata nesting                        |
| `empty-optional-fields.md`  | Empty strings, arrays, objects               |

## Expected Interface

Based on the tests, the parser should export:

### Types

```typescript
interface SkillMetadata {
  // Required
  name: string;
  description: string;

  // Optional standard fields
  license?: string;
  compatibility?: string;
  metadata?: Record<string, any>;
  allowedTools?: string[];

  // Claude Code extensions
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  argumentHint?: string;
  context?: string;
  agent?: string;
  model?: string;
  hooks?: Record<string, string>;
}

interface Skill {
  metadata: SkillMetadata;
  body: string;
}

type ParseErrorCode =
  | "EMPTY_FILE"
  | "MISSING_FRONTMATTER"
  | "INVALID_YAML"
  | "MISSING_REQUIRED_FIELD"
  | "FILE_NOT_FOUND"
  | "FILE_READ_ERROR";

interface ParseError {
  code: ParseErrorCode;
  message: string;
  field?: string;
}

type ParseResult =
  | { success: true; skill: Skill }
  | { success: false; error: ParseError };
```

### Functions

```typescript
function parseSkillContent(content: string): ParseResult;
function parseSkill(filePath: string): Promise<ParseResult>;
```

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Implementation Guidelines

When implementing the parser to make these tests pass:

1. **Use js-yaml** for YAML frontmatter parsing (as specified in design doc)
2. **Extract frontmatter**: Find content between `---` delimiters
3. **Validate required fields**: name and description must be present
4. **Map field names**: Convert kebab-case YAML fields to camelCase TypeScript
   - `disable-model-invocation` → `disableModelInvocation`
   - `user-invocable` → `userInvocable`
   - `argument-hint` → `argumentHint`
   - `allowed-tools` → `allowedTools`
5. **Handle errors gracefully**: Return descriptive error messages
6. **Preserve types**: Keep YAML types (numbers, booleans, objects, arrays)
7. **No transformation**: Return body content as-is (no markdown processing)

## Design Principles Tested

- **Fail-Fast Validation**: Invalid skills fail immediately with clear errors
- **Immutability After Load**: Parsed skills are immutable
- **Graceful Degradation**: Individual parsing errors don't crash
- **Rich Context**: Errors include file paths, field names, error codes
- **Type Safety**: Strong typing with discriminated unions for results

## Related Documentation

- Design Document: `.vibe/docs/design.md`
- Architecture Document: `.vibe/docs/architecture.md`
- Agent Skills Standard: https://agentskills.io
- Claude Code Extensions: https://docs.anthropic.com/claude-code

## Next Steps

After implementing the parser to pass these tests:

1. **SkillValidator**: Add validation beyond parsing (token counts, security)
2. **SkillRegistry**: Multi-skill management with discovery
3. **Integration tests**: End-to-end workflows with real skill directories
4. **Performance tests**: Benchmark parsing speed for large skill sets
