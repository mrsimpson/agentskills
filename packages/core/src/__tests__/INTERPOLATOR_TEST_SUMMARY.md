# StringInterpolator Test Suite Summary

## Overview
Comprehensive test suite for the StringInterpolator component following TDD principles. This document outlines the test coverage and expected behaviors.

## Test Statistics
- **Total Tests**: 60
- **Test Categories**: 8
- **Current Status**: All tests failing (TDD Red phase ✓)

## Test Categories

### 1. $ARGUMENTS Placeholder (7 tests)
Tests for replacing `$ARGUMENTS` with all arguments joined by spaces.

**Test Cases:**
- ✓ Replace with all arguments joined by spaces
- ✓ Handle empty arguments array
- ✓ Handle single argument
- ✓ Preserve spaces within individual arguments
- ✓ Handle special characters in arguments
- ✓ Handle multiple $ARGUMENTS placeholders
- ✓ Handle $ARGUMENTS in multi-line content

**Expected Behavior:**
```typescript
interpolate("Run: $ARGUMENTS", ["a", "b", "c"])
// Returns: "Run: a b c"
```

### 2. $ARGUMENTS[N] Placeholder (8 tests)
Tests for replacing `$ARGUMENTS[N]` with specific arguments by index.

**Test Cases:**
- ✓ Replace $ARGUMENTS[0] with first argument
- ✓ Replace $ARGUMENTS[1] with second argument
- ✓ Replace $ARGUMENTS[2] with third argument
- ✓ Handle out of bounds index (returns empty string)
- ✓ Handle multiple $ARGUMENTS[N] placeholders
- ✓ Handle same index referenced multiple times
- ✓ Handle empty array with index access
- ✓ Handle double-digit indices (e.g., $ARGUMENTS[10])

**Expected Behavior:**
```typescript
interpolate("Copy $ARGUMENTS[0] to $ARGUMENTS[1]", ["src.txt", "dst.txt"])
// Returns: "Copy src.txt to dst.txt"
```

### 3. $N Shorthand Placeholder (7 tests)
Tests for replacing `$N` with specific arguments (shorthand notation).

**Test Cases:**
- ✓ Replace $0 with first argument
- ✓ Replace $1 with second argument
- ✓ Replace $2 with third argument
- ✓ Handle out of bounds shorthand index
- ✓ Handle multiple shorthand placeholders
- ✓ Handle double-digit shorthand indices (e.g., $10)
- ✓ Not confuse $1 with $10 or $11 (proper boundary detection)

**Expected Behavior:**
```typescript
interpolate("mv $0 $1", ["source.txt", "dest.txt"])
// Returns: "mv source.txt dest.txt"
```

### 4. ${CLAUDE_SESSION_ID} Placeholder (5 tests)
Tests for replacing session identifier placeholder.

**Test Cases:**
- ✓ Replace with provided session ID
- ✓ Handle missing session ID (replace with empty string)
- ✓ Handle empty session ID
- ✓ Handle multiple ${CLAUDE_SESSION_ID} placeholders
- ✓ Handle session ID with special characters

**Expected Behavior:**
```typescript
interpolate("Session: ${CLAUDE_SESSION_ID}", [], "sess-123")
// Returns: "Session: sess-123"
```

### 5. Multiple Placeholder Types (5 tests)
Tests for mixing different placeholder types in the same content.

**Test Cases:**
- ✓ Mix $ARGUMENTS and $N placeholders
- ✓ Mix $ARGUMENTS[N] and $N placeholders
- ✓ Handle all placeholder types together
- ✓ Handle adjacent placeholders
- ✓ Handle complex real-world example

**Expected Behavior:**
```typescript
interpolate("All: $ARGUMENTS, First: $0", ["a", "b"])
// Returns: "All: a b, First: a"
```

### 6. Edge Cases (14 tests)
Tests for boundary conditions and special cases.

**Test Cases:**
- ✓ Content with no placeholders
- ✓ Not replace partial matches ($ARG, $ARGUMENT)
- ✓ Not replace $ARGUMENTS without proper boundary
- ✓ Handle escaped dollar signs ($$)
- ✓ Handle multiple escaped dollar signs
- ✓ Case sensitivity for placeholders
- ✓ Dollar sign followed by non-digit
- ✓ Numbers in argument content
- ✓ Empty strings in arguments
- ✓ Unicode characters in arguments
- ✓ Very long content (10,000+ characters)
- ✓ Many arguments (100+)
- ✓ Malformed ${...} that is not CLAUDE_SESSION_ID
- ✓ Incomplete bracket syntax

**Expected Behaviors:**
```typescript
// Escaped dollar signs
interpolate("Price: $$100", [])
// Returns: "Price: $100"

// Case sensitivity
interpolate("$ARGUMENTS and $arguments", ["test"])
// Returns: "test and $arguments"

// Partial matches not replaced
interpolate("$ARG and $ARGUMENT", ["test"])
// Returns: "$ARG and $ARGUMENT"
```

### 7. Error Handling (6 tests)
Tests for graceful handling of edge cases and special inputs.

**Test Cases:**
- ✓ Empty content string
- ✓ Content with only placeholders
- ✓ Arguments array with only empty strings
- ✓ Whitespace-only arguments
- ✓ Newlines in arguments
- ✓ Tabs in arguments

**Expected Behavior:**
```typescript
interpolate("", ["arg"])
// Returns: ""

interpolate("Text: $0", ["line1\nline2"])
// Returns: "Text: line1\nline2"
```

### 8. Performance and Boundary Conditions (3 tests)
Tests for efficiency and handling of edge cases.

**Test Cases:**
- ✓ Zero-length arguments array efficiently
- ✓ Content with many placeholders efficiently
- ✓ Preserve exact spacing between placeholders

### 9. Real-World Usage Scenarios (5 tests)
Tests simulating actual use cases.

**Test Cases:**
- ✓ Bash command interpolation
- ✓ Markdown template interpolation
- ✓ JSON template interpolation
- ✓ File path operations
- ✓ URL interpolation

**Example:**
```typescript
interpolate("git commit -m $0 && git push $1 $2", 
  ["feat: add feature", "origin", "main"])
// Returns: "git commit -m feat: add feature && git push origin main"
```

## Placeholder Patterns Reference

| Pattern | Description | Example |
|---------|-------------|---------|
| `$ARGUMENTS` | All arguments joined with spaces | `$ARGUMENTS` → `"a b c"` |
| `$ARGUMENTS[N]` | Specific argument by index (0-based) | `$ARGUMENTS[0]` → `"a"` |
| `$N` | Shorthand for argument N | `$0` → `"a"` |
| `${CLAUDE_SESSION_ID}` | Session identifier | `${CLAUDE_SESSION_ID}` → `"sess-123"` |
| `$$` | Escaped dollar sign | `$$100` → `"$100"` |

## Implementation Interface

```typescript
export class StringInterpolator {
  static interpolate(
    content: string,
    args: string[],
    sessionId?: string
  ): string;
}
```

## Key Behaviors Defined

1. **Out of Bounds Access**: Returns empty string when index exceeds array length
2. **Missing Session ID**: Replaces with empty string when `sessionId` is undefined
3. **Escaping**: `$$` converts to single `$`
4. **Case Sensitivity**: Only `$ARGUMENTS` (uppercase) is recognized
5. **Boundary Detection**: Must have proper word boundaries (no alphanumeric before/after)
6. **Multi-digit Indices**: Support for indices like `$10`, `$99`, `$ARGUMENTS[10]`
7. **Whitespace Preservation**: Exact spacing is maintained around placeholders

## Next Steps (TDD Green Phase)

To implement the StringInterpolator and pass all tests:

1. Implement `$$` escape sequence handling first
2. Implement `${CLAUDE_SESSION_ID}` replacement
3. Implement `$ARGUMENTS[N]` with index parsing
4. Implement `$N` shorthand with proper boundary detection
5. Implement `$ARGUMENTS` replacement
6. Ensure proper order of replacement to avoid conflicts
7. Add optimization for performance tests

## Files Created

- **Test Suite**: `packages/core/src/__tests__/interpolator.test.ts`
- **Stub Implementation**: `packages/core/src/interpolator.ts`
- **This Summary**: `packages/core/src/__tests__/INTERPOLATOR_TEST_SUMMARY.md`

## Test Execution

```bash
# Run interpolator tests
cd packages/core
npm test -- interpolator.test.ts --run

# Run with watch mode
npm test -- interpolator.test.ts
```

## Current Status

✅ **TDD Red Phase Complete**
- All 60 tests written and failing with "Not implemented yet"
- Tests compile without errors
- Test suite is ready for implementation

⏳ **Next: TDD Green Phase**
- Implement StringInterpolator.interpolate() method
- Make all tests pass

⏳ **Then: TDD Refactor Phase**
- Optimize performance
- Improve code clarity
- Add inline documentation
