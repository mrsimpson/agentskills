# Validate Command - TDD Test Implementation Summary

## Overview
Comprehensive test suite for the `agentskills validate` command following TDD best practices.

## Test File Location
`packages/cli/src/commands/__tests__/validate.test.ts`

## Implementation File (Stub)
`packages/cli/src/commands/validate.ts`

## Test Statistics
- **Total Tests**: 48 test cases
- **Test Groups**: 11 describe blocks
- **Current Status**: ✅ Tests written (RED phase)
  - 42 failing (expected - implementation pending)
  - 6 passing (exit code tests that match stub behavior)

## Test Coverage

### 1. Single Skill Validation (15 tests)
- ✅ Valid skill → success message, exit 0
- ✅ Valid skill with direct SKILL.md path
- ✅ Invalid skill (parse error) → error message, exit 1
- ✅ Invalid skill (validation error) → error details, exit 1
- ✅ Skill with warnings (no --strict) → warnings shown, exit 0
- ✅ Skill with warnings (--strict) → treat as error, exit 1

### 2. Directory Validation - All Skills (18 tests)
- ✅ All valid → success summary, exit 0
- ✅ Some invalid → show errors, summary, exit 1
- ✅ Mix of valid/invalid/warnings → detailed report
- ✅ No skills found → appropriate message, exit 0
- ✅ Non-skill files in directory → handle gracefully

### 3. Error Handling (6 tests)
- ✅ Path doesn't exist → error message, exit 1
- ✅ Not a skill directory (no SKILL.md) → error message, exit 1
- ✅ Permission errors → error message, exit 1
- ✅ No path provided → validate default locations

### 4. Output Formatting (7 tests)
- ✅ Success: "✓ Skill 'name' is valid"
- ✅ Error: "✗ Skill 'name' failed validation:\n  - error details"
- ✅ Warning: "⚠ Warning: issue description"
- ✅ Summary: "Validated X skills: Y valid, Z invalid"
- ✅ Proper pluralization handling

### 5. --fix Flag (3 tests)
- ✅ Shows "Auto-fix not implemented yet" message
- ✅ Still validates and reports issues
- ✅ Works with --strict flag

### 6. Edge Cases (3 tests)
- ✅ Very long content handling
- ✅ Special characters in skill name
- ✅ Nested directory structures

## Test Infrastructure

### Helper Functions
```typescript
- createSkillFile(dir, content) - Create SKILL.md file
- createValidSkill(dir, name) - Create valid skill fixture
- createParseErrorSkill(dir) - Create skill with parse error
- createValidationErrorSkill(dir) - Create skill with validation error
- createWarningSkill(dir) - Create skill with warnings
```

### Mocking Strategy
- Real file system operations (temp directories)
- Mocked console.log, console.error, process.exit
- No mocking of core parser/validator (integration testing)

### Test Fixtures
Uses real file system with generated test skills:
- Valid skills with required fields only
- Valid skills with all optional fields
- Skills with YAML parse errors
- Skills with validation errors
- Skills with warnings (short descriptions)

## Expected Command Interface

```typescript
export async function validateCommand(
  path: string | undefined,
  options: { strict?: boolean; fix?: boolean }
): Promise<void>
```

## Next Steps (Implementation Phase)

1. **Implement single skill validation**
   - Parse skill using SkillParser
   - Validate using SkillValidator
   - Format and display results

2. **Implement directory traversal**
   - Find all SKILL.md files recursively
   - Validate each skill
   - Aggregate results

3. **Implement output formatting**
   - Use chalk for colored output
   - Format success/error/warning messages
   - Display summary statistics

4. **Implement error handling**
   - Path validation
   - Permission checks
   - Graceful error reporting

5. **Implement --strict mode**
   - Convert warnings to errors
   - Adjust exit codes accordingly

6. **Implement --fix stub**
   - Display "not implemented" message
   - Plan future auto-fix functionality

## Dependencies

- `@agentskills/core` - parseSkill, validateSkill
- `chalk` - Colored terminal output
- `fs/promises` - File system operations
- Node.js path utilities

## Test Execution

```bash
# Run all validate tests
npm test -- validate.test.ts

# Run in watch mode
npm test:watch -- validate.test.ts

# Run specific test group
npm test -- validate.test.ts -t "Single Skill Validation"
```

## Design Decisions

1. **Real File System Testing**: Uses actual temp directories instead of heavy mocking for more realistic integration tests

2. **Comprehensive Error Coverage**: Tests all error paths including permissions, missing files, and invalid content

3. **User Experience Focus**: Tests validate output format, colors, and helpful error messages

4. **TDD Approach**: Tests written first to define behavior, implementation follows tests

5. **Edge Case Coverage**: Includes tests for special characters, long content, nested directories

## Expected User Experience

### Success Case
```
✓ Skill 'test-skill' is valid

Validated 1 skill: 1 valid, 0 invalid
```

### Error Case
```
✗ Skill 'invalid-skill' failed validation:
  - Invalid YAML in frontmatter
  - Line 3: Missing closing quote

Validated 1 skill: 0 valid, 1 invalid
```

### Warning Case (no --strict)
```
✓ Skill 'warning-skill' is valid
  ⚠ Warning: Description is very short (recommended 50+ characters)

Validated 1 skill: 1 valid, 0 invalid
```

### Warning Case (--strict)
```
✗ Skill 'warning-skill' failed validation:
  ⚠ Warning: Description is very short (recommended 50+ characters)

Validated 1 skill: 0 valid, 1 invalid
```

## Benefits of This Test Suite

1. **Clear Specification**: Tests document expected behavior
2. **Regression Prevention**: Comprehensive coverage prevents bugs
3. **Development Confidence**: Can refactor with safety
4. **Documentation**: Tests serve as usage examples
5. **Quality Assurance**: Ensures consistent UX

---

**Status**: ✅ RED phase complete - Ready for implementation (GREEN phase)
