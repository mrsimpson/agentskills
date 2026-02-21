# StringInterpolator Implementation Guide

## Overview

This guide provides implementation hints and considerations for making all 60 tests pass.

## Implementation Strategy

### Phase 1: Regex Pattern Design

The key to successful implementation is applying replacements in the correct order to avoid conflicts.

**Recommended Order:**

1. Escape sequences (`$$` → `$`) - Handle first to avoid interfering with other patterns
2. `${CLAUDE_SESSION_ID}` - Handle before other `$` patterns
3. `$ARGUMENTS[N]` - Handle before `$N` to avoid partial matching issues
4. `$N` (shorthand) - Handle before `$ARGUMENTS` for greedy matching control
5. `$ARGUMENTS` - Handle last as it's the most general pattern

### Phase 2: Regex Patterns

```typescript
// Pattern suggestions (need word boundaries and proper escaping):

// 1. Escaped dollar signs
const escapedDollar = /\$\$/g;
// Replace: "$$" -> "$"

// 2. Session ID
const sessionIdPattern = /\$\{CLAUDE_SESSION_ID\}/g;
// Replace with: sessionId || ""

// 3. Indexed arguments $ARGUMENTS[N]
const indexedPattern = /\$ARGUMENTS\[(\d+)\]/g;
// Capture group 1: the index number
// Replace with: args[Number(captureGroup)] || ""

// 4. Shorthand $N
const shorthandPattern = /\$(\d+)/g;
// Capture group 1: the digit(s)
// Replace with: args[Number(captureGroup)] || ""
// Note: Must handle boundary detection properly to avoid matching $10 when $1 is intended

// 5. Full $ARGUMENTS
const argumentsPattern = /\$ARGUMENTS/g;
// Replace with: args.join(" ")
```

### Phase 3: Boundary Detection Considerations

**Critical: Avoiding Conflicts**

- `$ARGUMENTS[10]` should NOT match `$ARGUMENTS` first and leave `[10]`
- `$10` should NOT match as `$1` leaving `0`
- `MY$ARGUMENTS` should NOT match (requires word boundary before)
- `$ARGUMENTS_TEST` should NOT match (requires word boundary after)

**Solution Approach:**
Either:

1. Apply replacements in specific order (recommended)
2. Use negative lookbehind/lookahead for boundaries
3. Use word boundary anchors `\b` where appropriate

### Phase 4: Implementation Template

```typescript
export class StringInterpolator {
  static interpolate(
    content: string,
    args: string[],
    sessionId?: string
  ): string {
    let result = content;

    // Step 1: Handle escaped dollar signs
    // Temporarily replace $$ with a placeholder to protect them
    const ESCAPED_PLACEHOLDER = "\x00ESCAPED_DOLLAR\x00";
    result = result.replace(/\$\$/g, ESCAPED_PLACEHOLDER);

    // Step 2: Replace ${CLAUDE_SESSION_ID}
    result = result.replace(/\$\{CLAUDE_SESSION_ID\}/g, sessionId || "");

    // Step 3: Replace $ARGUMENTS[N]
    result = result.replace(/\$ARGUMENTS\[(\d+)\]/g, (match, index) => {
      const idx = Number(index);
      return args[idx] !== undefined ? args[idx] : "";
    });

    // Step 4: Replace $N (shorthand)
    // Important: Use word boundaries or negative lookahead
    result = result.replace(/\$(\d+)/g, (match, index) => {
      const idx = Number(index);
      return args[idx] !== undefined ? args[idx] : "";
    });

    // Step 5: Replace $ARGUMENTS (full array)
    result = result.replace(/\$ARGUMENTS/g, args.join(" "));

    // Step 6: Restore escaped dollar signs
    result = result.replace(new RegExp(ESCAPED_PLACEHOLDER, "g"), "$");

    return result;
  }
}
```

### Phase 5: Edge Cases to Verify

1. **Empty Arguments**
   - `$ARGUMENTS` with `[]` → `""`
   - `$0` with `[]` → `""`

2. **Out of Bounds**
   - `$5` with `["a", "b"]` → `""`
   - `$ARGUMENTS[5]` with `["a", "b"]` → `""`

3. **Escaping**
   - `$$100` → `$100`
   - `$$$0` with `["test"]` → `$test`

4. **Boundaries**
   - `MY$ARGUMENTS` → `MY$ARGUMENTS` (no replacement)
   - `$ARGUMENTS_TEST` → `$ARGUMENTS_TEST` (no replacement)

5. **Multi-digit Indices**
   - `$10` with 15 args → args[10]
   - `$1` followed by `$10` → Both replaced correctly

6. **Case Sensitivity**
   - `$arguments` → No replacement (case sensitive)
   - `$Arguments` → No replacement (case sensitive)

## Testing Strategy

### Run Tests Incrementally

```bash
# Run all tests
npm test -- interpolator.test.ts --run

# Run specific test suite
npm test -- interpolator.test.ts -t "$ARGUMENTS placeholder"

# Watch mode for TDD
npm test -- interpolator.test.ts
```

### Expected Test Progression

1. **Start**: 0 passing / 60 failing
2. **After escaping**: ~6 passing
3. **After session ID**: ~11 passing
4. **After $ARGUMENTS[N]**: ~27 passing
5. **After $N**: ~45 passing
6. **After $ARGUMENTS**: ~55 passing
7. **After edge case fixes**: 60 passing ✓

## Common Pitfalls

### Pitfall 1: Replacement Order

❌ **Wrong**: Replace `$ARGUMENTS` before `$ARGUMENTS[N]`

```typescript
// This breaks: "$ARGUMENTS[0]" becomes "arg1 arg2[0]"
```

✅ **Right**: Replace `$ARGUMENTS[N]` before `$ARGUMENTS`

### Pitfall 2: Greedy Matching

❌ **Wrong**: `$1` regex matches the "1" in "$10"

```typescript
// "$10" incorrectly becomes "arg[1]0" instead of "arg[10]"
```

✅ **Right**: Match complete digit sequences with `\d+`

### Pitfall 3: Missing Boundary Detection

❌ **Wrong**: `$ARGUMENTS` matches in `MY$ARGUMENTS`

```typescript
// "MY$ARGUMENTS" incorrectly becomes "MYarg1 arg2"
```

✅ **Right**: Add word boundary checks or negative lookaround

### Pitfall 4: Escaped Dollars

❌ **Wrong**: Handle escaping last or not at all

```typescript
// "$$0" with ["test"] becomes "$test" instead of "$0"
```

✅ **Right**: Handle escaping first with placeholder technique

## Performance Considerations

For the performance tests to pass efficiently:

1. **Use Single Pass**: Apply all replacements in one iteration where possible
2. **Avoid Nested Loops**: Don't loop through args array for each occurrence
3. **Regex Efficiency**: Use capturing groups instead of multiple regex operations
4. **String Concatenation**: Modern JS handles string concatenation efficiently, but consider using arrays for very large strings

## Debugging Tips

### Use Console Logging

```typescript
console.log("Before:", content);
console.log("After escaping:", result);
console.log("After session:", result);
// etc.
```

### Test Individual Patterns

```typescript
const testPattern = /\$ARGUMENTS\[(\d+)\]/g;
const matches = [...content.matchAll(testPattern)];
console.log("Matches:", matches);
```

### Verify Boundary Cases

```typescript
const testCases = [
  "$$100",
  "$ARGUMENTS",
  "MY$ARGUMENTS",
  "$ARGUMENTS[0]",
  "$0$1",
  "$10"
];

testCases.forEach((tc) => {
  console.log(`"${tc}" ->`, interpolate(tc, ["a", "b"]));
});
```

## Next Steps

1. ✅ Tests written (TDD Red phase)
2. ⏳ Implement interpolate method (TDD Green phase)
3. ⏳ Refactor and optimize (TDD Refactor phase)
4. ⏳ Update exports in index.ts
5. ⏳ Add to registry/validator integration

## Success Criteria

- ✅ All 60 tests passing
- ✅ No TypeScript errors
- ✅ Build completes successfully
- ✅ Performance tests complete in < 100ms
- ✅ Code coverage > 95%

## Reference

See test file for complete expected behaviors:

- `packages/core/src/__tests__/interpolator.test.ts`

See test summary for detailed breakdown:

- `packages/core/src/__tests__/INTERPOLATOR_TEST_SUMMARY.md`
