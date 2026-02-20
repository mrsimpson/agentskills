# SkillParser Implementation Guide

This guide helps implement the parser to make all tests pass (TDD Green phase).

## Quick Start

```bash
# Watch tests while implementing
npm run test:watch

# Current state: All 29 tests failing (Red ✅)
# Goal: Make all 29 tests pass (Green ✅)
```

## Implementation Checklist

### Phase 1: Basic Parsing (8 tests)
- [ ] Install `gray-matter` for frontmatter extraction
- [ ] Implement `parseSkillContent` basic flow:
  - [ ] Check for empty content
  - [ ] Extract YAML frontmatter
  - [ ] Parse YAML to object
  - [ ] Validate required fields (name, description)
  - [ ] Map field names (kebab-case → camelCase)
  - [ ] Construct Skill object with metadata + body

**Target tests:**
- should parse a basic skill with name and description
- should parse a skill with all optional fields
- should parse Claude Code extensions
- should handle skill with nested metadata structures
- should handle special characters in fields
- should handle very long descriptions
- should handle empty optional fields
- should handle skill with only frontmatter (no body)

### Phase 2: Error Handling (5 tests)
- [ ] Handle missing frontmatter
- [ ] Handle YAML parsing errors (try-catch)
- [ ] Validate required field presence
- [ ] Return proper ParseError objects

**Target tests:**
- should fail when frontmatter is missing
- should fail when YAML syntax is invalid
- should fail when required field 'name' is missing
- should fail when required field 'description' is missing
- should fail when file is empty

### Phase 3: File System Operations (5 tests)
- [ ] Implement `parseSkill` function
- [ ] Read file using `fs.promises.readFile`
- [ ] Handle file not found errors
- [ ] Handle file read errors
- [ ] Delegate to `parseSkillContent`

**Target tests:**
- should successfully parse a valid skill file
- should fail when file does not exist
- should fail gracefully on file read error
- should handle permission errors gracefully
- should handle invalid UTF-8 encoding gracefully

### Phase 4: Edge Cases (8 tests)
Should mostly pass automatically if Phase 1 is solid.
- [ ] Verify whitespace handling
- [ ] Verify line ending handling (CRLF, LF, mixed)
- [ ] Verify markdown preservation
- [ ] Verify type preservation (numbers, booleans)

**Target tests:**
- should handle frontmatter with no body whitespace
- should handle frontmatter with extra whitespace
- should handle CRLF line endings
- should handle mixed line endings
- should preserve markdown formatting in body
- should handle frontmatter delimiter in body
- should handle numeric field values
- should handle boolean field values

### Phase 5: Type Safety (2 tests)
Should pass automatically if types are correct.
- [ ] Verify return types match ParseResult
- [ ] Verify discriminated union works

**Target tests:**
- should return properly typed Skill object
- should return properly typed ParseError on failure

### Phase 6: Immutability (1 test)
- [ ] Ensure returned objects are immutable
- [ ] Consider using `Object.freeze()` or readonly types

**Target tests:**
- should return immutable Skill object

## Implementation Tips

### Field Name Mapping
```typescript
const FIELD_MAP: Record<string, string> = {
  'name': 'name',
  'description': 'description',
  'license': 'license',
  'compatibility': 'compatibility',
  'metadata': 'metadata',
  'allowed-tools': 'allowedTools',
  'disable-model-invocation': 'disableModelInvocation',
  'user-invocable': 'userInvocable',
  'argument-hint': 'argumentHint',
  'context': 'context',
  'agent': 'agent',
  'model': 'model',
  'hooks': 'hooks',
};
```

### Frontmatter Extraction with gray-matter
```typescript
import matter from 'gray-matter';

const { data, content } = matter(fileContent);
// data = parsed YAML object
// content = markdown body (after frontmatter)
```

### Error Helper Functions
```typescript
function createError(
  code: ParseErrorCode,
  message: string,
  field?: string
): ParseFailure {
  return {
    success: false,
    error: { code, message, field }
  };
}
```

### File Reading with Error Handling
```typescript
import { promises as fs } from 'fs';

try {
  const content = await fs.readFile(filePath, 'utf-8');
  return parseSkillContent(content);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
    return createError('FILE_NOT_FOUND', `File not found: ${filePath}`);
  }
  return createError('FILE_READ_ERROR', `Failed to read file: ${error.message}`);
}
```

## Common Pitfalls

1. **Don't parse the markdown body**
   - Return body as-is (raw markdown)
   - No markdown-to-HTML or other transformations

2. **Preserve YAML types**
   - Keep numbers as numbers (not strings)
   - Keep booleans as booleans
   - Keep null as null

3. **Handle both missing and empty fields**
   - Missing field → undefined
   - Empty string → ""
   - Empty array → []
   - Empty object → {}

4. **Handle line endings**
   - YAML parser (gray-matter) should handle this automatically
   - Don't assume LF only

5. **Error messages should be descriptive**
   - Include context (field name, file path)
   - Be actionable for users

## Testing Strategy

```bash
# Run one test at a time
npm test -- -t "should parse a basic skill"

# Run test category
npm test -- -t "Valid Skills"

# Watch mode for rapid iteration
npm run test:watch

# Check coverage
npm test -- --coverage
```

## Success Criteria

✅ All 29 tests pass
✅ No TypeScript errors
✅ Code follows design principles
✅ Clear error messages
✅ Proper type safety

## Next Steps After Implementation

1. **Run linter**: `npm run lint`
2. **Format code**: `npm run format:fix`
3. **Build package**: `npm run build`
4. **Move to next component**: SkillValidator
