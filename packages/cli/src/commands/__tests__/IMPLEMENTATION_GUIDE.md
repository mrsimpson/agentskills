# Validate Command - Implementation Guide

This document provides guidance for implementing the validate command to pass all tests.

## Quick Start

```bash
# Run tests in watch mode during development
cd packages/cli
npm test:watch -- validate.test.ts
```

## Implementation Checklist

### Phase 1: Basic Single Skill Validation

- [ ] Implement path resolution (handle both directory and SKILL.md file paths)
- [ ] Use `parseSkill()` from @agentskills/core to parse skill
- [ ] Use `validateSkill()` from @agentskills/core to validate parsed skill
- [ ] Format success output with chalk (green ✓)
- [ ] Exit with code 0 on success

### Phase 2: Error Handling

- [ ] Handle file not found errors
- [ ] Handle parse errors (invalid YAML)
- [ ] Handle validation errors
- [ ] Format error output with chalk (red ✗)
- [ ] Display error details with indentation
- [ ] Exit with code 1 on errors

### Phase 3: Warning Support

- [ ] Display warnings (yellow ⚠)
- [ ] Allow success with warnings (exit 0) in normal mode
- [ ] Implement --strict mode (treat warnings as errors, exit 1)

### Phase 4: Directory Validation

- [ ] Recursively find all SKILL.md files in directory
- [ ] Validate each skill
- [ ] Aggregate results (counts for valid/invalid)
- [ ] Display summary statistics

### Phase 5: --fix Flag (Stub)

- [ ] Display "Auto-fix not implemented" message
- [ ] Continue with validation as normal

## Key Implementation Details

### 1. Path Resolution

```typescript
async function resolvePath(path: string | undefined): Promise<string[]> {
  if (!path) {
    // Load default paths from config
    // TODO: Implement config loading
    return [];
  }

  const stat = await fs.stat(path);

  if (stat.isFile()) {
    // Direct SKILL.md file
    return [path];
  } else if (stat.isDirectory()) {
    // Check if directory contains SKILL.md
    const skillPath = join(path, "SKILL.md");
    try {
      await fs.access(skillPath);
      return [skillPath];
    } catch {
      // Not a single skill dir, search for all skills
      return await findAllSkills(path);
    }
  }
}
```

### 2. Skill Validation

```typescript
async function validateSingleSkill(
  skillPath: string,
  options: ValidateOptions
): Promise<{
  success: boolean;
  name?: string;
  errors: string[];
  warnings: string[];
}> {
  const parseResult = await parseSkill(skillPath);

  if (!parseResult.success) {
    return {
      success: false,
      errors: [parseResult.error.message],
      warnings: []
    };
  }

  const validationResult = validateSkill(parseResult.skill);
  const errors = validationResult.errors.map((e) => e.message);
  const warnings = validationResult.warnings.map((w) => w.message);

  // In strict mode, warnings become errors
  if (options.strict && warnings.length > 0) {
    return {
      success: false,
      name: parseResult.skill.metadata.name,
      errors: [...errors, ...warnings],
      warnings: []
    };
  }

  return {
    success: validationResult.valid && errors.length === 0,
    name: parseResult.skill.metadata.name,
    errors,
    warnings
  };
}
```

### 3. Output Formatting

```typescript
function formatSuccess(skillName: string, warnings: string[]): void {
  console.log(chalk.green(`✓ Skill '${skillName}' is valid`));

  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      console.log(chalk.yellow(`  ⚠ ${warning}`));
    });
  }
}

function formatError(skillName: string | undefined, errors: string[]): void {
  const name = skillName || "unknown";
  console.error(chalk.red(`✗ Skill '${name}' failed validation:`));

  errors.forEach((error) => {
    console.error(chalk.red(`  - ${error}`));
  });
}

function formatSummary(total: number, valid: number, invalid: number): void {
  const skillWord = total === 1 ? "skill" : "skills";
  const validColor = invalid === 0 ? chalk.green : chalk.yellow;
  const invalidColor = invalid > 0 ? chalk.red : chalk.gray;

  console.log("");
  console.log(
    `Validated ${total} ${skillWord}: ` +
      validColor(`${valid} valid`) +
      ", " +
      invalidColor(`${invalid} invalid`)
  );
}
```

### 4. Directory Traversal

```typescript
async function findAllSkills(dir: string): Promise<string[]> {
  const skills: string[] = [];

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        await walk(fullPath);
      } else if (entry.name === "SKILL.md") {
        skills.push(fullPath);
      }
    }
  }

  await walk(dir);
  return skills;
}
```

### 5. Main Command Logic

```typescript
export async function validateCommand(
  path: string | undefined,
  options: ValidateOptions
): Promise<void> {
  try {
    // Show --fix message if flag is present
    if (options.fix) {
      console.log(chalk.yellow("⚠ Auto-fix is not yet implemented"));
      console.log("");
    }

    // Resolve paths
    const skillPaths = await resolvePath(path);

    if (skillPaths.length === 0) {
      console.log(chalk.yellow("No skills found"));
      process.exit(0);
    }

    // Validate all skills
    const results = await Promise.all(
      skillPaths.map((p) => validateSingleSkill(p, options))
    );

    // Display results
    let hasErrors = false;
    results.forEach((result, index) => {
      if (result.success) {
        formatSuccess(result.name!, result.warnings);
      } else {
        formatError(result.name, result.errors);
        hasErrors = true;
      }
    });

    // Display summary if multiple skills
    if (skillPaths.length > 1) {
      const valid = results.filter((r) => r.success).length;
      const invalid = results.length - valid;
      formatSummary(results.length, valid, invalid);
    }

    // Exit with appropriate code
    process.exit(hasErrors ? 1 : 0);
  } catch (error: any) {
    // Handle unexpected errors
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
```

## Testing During Development

### Run Specific Test Groups

```bash
# Test only single skill validation
npm test -- validate.test.ts -t "Single Skill Validation"

# Test only directory validation
npm test -- validate.test.ts -t "Directory Validation"

# Test only error handling
npm test -- validate.test.ts -t "Error Handling"

# Test only output formatting
npm test -- validate.test.ts -t "Output Formatting"
```

### Watch Mode for Rapid Development

```bash
npm test:watch -- validate.test.ts
```

This will re-run tests automatically when you save changes to the implementation file.

## Common Pitfalls

1. **Forgetting to exit**: Always call `process.exit()` with appropriate code
2. **Wrong exit codes**: 0 = success, 1 = failure
3. **Missing chalk colors**: Use `chalk.green()`, `chalk.red()`, `chalk.yellow()`
4. **Not handling undefined path**: Must handle case where no path is provided
5. **Incorrect strict mode**: Warnings should become errors in strict mode
6. **Missing summary**: Multi-skill validation needs summary output

## Validation Examples

### Example 1: Valid Skill

```bash
$ agentskills validate ./skills/my-skill

✓ Skill 'my-skill' is valid
```

### Example 2: Skill with Warnings

```bash
$ agentskills validate ./skills/my-skill

✓ Skill 'my-skill' is valid
  ⚠ Warning: Description is very short (recommended 50+ characters)
```

### Example 3: Invalid Skill

```bash
$ agentskills validate ./skills/invalid-skill

✗ Skill 'invalid-skill' failed validation:
  - Invalid YAML in frontmatter
  - Missing required field: description
```

### Example 4: Multiple Skills

```bash
$ agentskills validate ./skills

✓ Skill 'skill-one' is valid
✗ Skill 'skill-two' failed validation:
  - Name must be at least 3 characters
✓ Skill 'skill-three' is valid
  ⚠ Warning: Description is very short

Validated 3 skills: 2 valid, 1 invalid
```

### Example 5: Strict Mode

```bash
$ agentskills validate ./skills/warning-skill --strict

✗ Skill 'warning-skill' failed validation:
  ⚠ Warning: Description is very short (recommended 50+ characters)
```

## Next Steps After Implementation

1. Run full test suite: `npm test`
2. Check test coverage: `npm test -- --coverage`
3. Test manually with real skills
4. Update CLI help text if needed
5. Add to main CLI exports if not already done

## Related Files

- Test file: `src/commands/__tests__/validate.test.ts`
- Implementation: `src/commands/validate.ts`
- Core types: `@agentskills/core/src/types.ts`
- Core parser: `@agentskills/core/src/parser.ts`
- Core validator: `@agentskills/core/src/validator.ts`
