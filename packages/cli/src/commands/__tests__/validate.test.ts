import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateCommand } from '../validate.js';

/**
 * Comprehensive test suite for validate command
 * 
 * Following TDD approach:
 * - Write tests first to define the command interface and behavior
 * - Tests define expected user experience before implementation
 * - Clear test structure with arrange-act-assert
 * - Minimal mocking - use real file system with temp directories
 * 
 * Coverage:
 * 1. Single skill validation (valid, invalid parse, invalid validation, warnings)
 * 2. Directory validation (all valid, some invalid, mixed, no skills)
 * 3. Error handling (missing paths, no SKILL.md, permissions)
 * 4. Output formatting (success, error, warning, summary messages)
 * 5. --strict flag (treats warnings as errors)
 * 6. --fix flag (stub for now, shows not implemented message)
 */

describe('validate command', () => {
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `agentskills-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock console and process.exit
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Restore mocks
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // Helper function to create a skill file
  async function createSkillFile(dir: string, content: string): Promise<string> {
    const skillPath = join(dir, 'SKILL.md');
    await fs.writeFile(skillPath, content);
    return skillPath;
  }

  // Helper function to create a valid skill (with proper description length to avoid warnings)
  async function createValidSkill(dir: string, name: string = 'test-skill'): Promise<string> {
    const content = `---
name: ${name}
description: A comprehensive test skill for validation with sufficient description length to avoid warnings
license: MIT
---

# Test Skill

This is a valid skill for testing with no validation warnings.
`;
    return createSkillFile(dir, content);
  }

  // Helper function to create skill with parse error
  async function createParseErrorSkill(dir: string): Promise<string> {
    const content = `---
name: invalid-yaml
description: "Missing closing quote
---

# Invalid Skill
`;
    return createSkillFile(dir, content);
  }

  // Helper function to create skill with validation error
  async function createValidationErrorSkill(dir: string): Promise<string> {
    const content = `---
name: ""
description: This skill has actual validation errors - empty name field
---

# Invalid Skill

This skill has validation errors (empty name).
`;
    return createSkillFile(dir, content);
  }

  // Helper function to create skill with warnings
  async function createWarningSkill(dir: string): Promise<string> {
    const content = `---
name: warning-skill
description: Short
---

# Warning Skill

This skill has a very short description which should trigger a warning.
`;
    return createSkillFile(dir, content);
  }

  describe('Single Skill Validation', () => {
    describe('Valid skill', () => {
      it('should display success message for valid skill', async () => {
        // Arrange
        const skillDir = join(testDir, 'valid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createValidSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        expect(consoleLogSpy).toHaveBeenCalled();
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✓.*test-skill.*valid/i);
        expect(processExitSpy).toHaveBeenCalledWith(0);
      });

      it('should exit with code 0 for valid skill', async () => {
        // Arrange
        const skillDir = join(testDir, 'valid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createValidSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(0);
      });

      it('should validate when given direct path to SKILL.md', async () => {
        // Arrange
        const skillDir = join(testDir, 'valid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        const skillPath = await createValidSkill(skillDir);

        // Act
        await validateCommand(skillPath, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(0);
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✓.*test-skill.*valid/i);
      });
    });

    describe('Invalid skill - parse error', () => {
      it('should display error message for parse error', async () => {
        // Arrange
        const skillDir = join(testDir, 'invalid-parse');
        await fs.mkdir(skillDir, { recursive: true });
        await createParseErrorSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalled();
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✗/);
        expect(output).toMatch(/failed/i);
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should exit with code 1 for parse error', async () => {
        // Arrange
        const skillDir = join(testDir, 'invalid-parse');
        await fs.mkdir(skillDir, { recursive: true });
        await createParseErrorSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should display detailed error information', async () => {
        // Arrange
        const skillDir = join(testDir, 'invalid-parse');
        await fs.mkdir(skillDir, { recursive: true });
        await createParseErrorSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/yaml|parse|invalid/i);
      });
    });

    describe('Invalid skill - validation error', () => {
      it('should display error message for validation error', async () => {
        // Arrange
        const skillDir = join(testDir, 'invalid-validation');
        await fs.mkdir(skillDir, { recursive: true });
        await createValidationErrorSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalled();
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✗/);
        expect(output).toMatch(/validation/i);
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should display all validation errors', async () => {
        // Arrange
        const skillDir = join(testDir, 'invalid-validation');
        await fs.mkdir(skillDir, { recursive: true });
        await createValidationErrorSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        // Should show error details
        expect(output.length).toBeGreaterThan(50);
      });

      it('should exit with code 1 for validation error', async () => {
        // Arrange
        const skillDir = join(testDir, 'invalid-validation');
        await fs.mkdir(skillDir, { recursive: true });
        await createValidationErrorSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });
    });

    describe('Skill with warnings (no --strict)', () => {
      it('should display warning message', async () => {
        // Arrange
        const skillDir = join(testDir, 'warning-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createWarningSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        expect(consoleLogSpy).toHaveBeenCalled();
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/⚠|warning/i);
      });

      it('should still show success with warnings', async () => {
        // Arrange
        const skillDir = join(testDir, 'warning-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createWarningSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✓.*warning-skill/i);
        expect(output).toMatch(/⚠|warning/i);
      });

      it('should exit with code 0 when warnings present but not strict', async () => {
        // Arrange
        const skillDir = join(testDir, 'warning-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createWarningSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(0);
      });
    });

    describe('Skill with warnings (--strict mode)', () => {
      it('should treat warnings as errors in strict mode', async () => {
        // Arrange
        const skillDir = join(testDir, 'warning-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createWarningSkill(skillDir);

        // Act
        await validateCommand(skillDir, { strict: true });

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalled();
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✗/);
        expect(output).toMatch(/warning|strict/i);
      });

      it('should exit with code 1 in strict mode when warnings present', async () => {
        // Arrange
        const skillDir = join(testDir, 'warning-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createWarningSkill(skillDir);

        // Act
        await validateCommand(skillDir, { strict: true });

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should display warning details as errors in strict mode', async () => {
        // Arrange
        const skillDir = join(testDir, 'warning-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createWarningSkill(skillDir);

        // Act
        await validateCommand(skillDir, { strict: true });

        // Assert
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/⚠|warning/i);
        expect(output).toMatch(/description/i);
      });
    });
  });

  describe('Directory Validation (All Skills)', () => {
    describe('All valid skills', () => {
      it('should validate all skills in directory', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await createValidSkill(skill1, 'skill-one');
        await createValidSkill(skill2, 'skill-two');

        // Act
        await validateCommand(testDir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/skill-one/i);
        expect(output).toMatch(/skill-two/i);
        expect(processExitSpy).toHaveBeenCalledWith(0);
      });

      it('should display success summary for all valid', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await createValidSkill(skill1, 'skill-one');
        await createValidSkill(skill2, 'skill-two');

        // Act
        await validateCommand(testDir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/validated.*2.*skills/i);
        expect(output).toMatch(/2.*valid/i);
        expect(output).toMatch(/0.*invalid/i);
      });

      it('should exit with code 0 when all valid', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await createValidSkill(skill1, 'skill-one');
        await createValidSkill(skill2, 'skill-two');

        // Act
        await validateCommand(testDir, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(0);
      });
    });

    describe('Some invalid skills', () => {
      it('should validate all and report invalid ones', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await createValidSkill(skill1, 'skill-one');
        await createParseErrorSkill(skill2);

        // Act
        await validateCommand(testDir, {});

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalled();
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✗/);
      });

      it('should display summary with failure count', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await createValidSkill(skill1, 'skill-one');
        await createParseErrorSkill(skill2);

        // Act
        await validateCommand(testDir, {});

        // Assert
        const allOutput = [
          ...consoleLogSpy.mock.calls.map(call => call.join(' ')),
          ...consoleErrorSpy.mock.calls.map(call => call.join(' '))
        ].join('\n');
        expect(allOutput).toMatch(/validated.*2.*skills/i);
        expect(allOutput).toMatch(/1.*valid/i);
        expect(allOutput).toMatch(/1.*invalid/i);
      });

      it('should exit with code 1 when some invalid', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await createValidSkill(skill1, 'skill-one');
        await createParseErrorSkill(skill2);

        // Act
        await validateCommand(testDir, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });
    });

    describe('Mix of valid, invalid, and warnings', () => {
      it('should report detailed results for mixed scenarios', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        const skill3 = join(testDir, 'skill-3');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await fs.mkdir(skill3, { recursive: true });
        await createValidSkill(skill1, 'skill-one');
        await createWarningSkill(skill2);
        await createParseErrorSkill(skill3);

        // Act
        await validateCommand(testDir, {});

        // Assert
        const allOutput = [
          ...consoleLogSpy.mock.calls.map(call => call.join(' ')),
          ...consoleErrorSpy.mock.calls.map(call => call.join(' '))
        ].join('\n');
        expect(allOutput).toMatch(/✓/); // Valid skill
        expect(allOutput).toMatch(/⚠/); // Warning
        expect(allOutput).toMatch(/✗/); // Error
      });

      it('should exit with code 1 when any invalid present', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        const skill3 = join(testDir, 'skill-3');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await fs.mkdir(skill3, { recursive: true });
        await createValidSkill(skill1, 'skill-one');
        await createWarningSkill(skill2);
        await createParseErrorSkill(skill3);

        // Act
        await validateCommand(testDir, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should treat warnings as errors in strict mode for directory', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await createValidSkill(skill1, 'skill-one');
        await createWarningSkill(skill2);

        // Act
        await validateCommand(testDir, { strict: true });

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(1);
        const allOutput = [
          ...consoleLogSpy.mock.calls.map(call => call.join(' ')),
          ...consoleErrorSpy.mock.calls.map(call => call.join(' '))
        ].join('\n');
        expect(allOutput).toMatch(/1.*valid/i);
        expect(allOutput).toMatch(/1.*invalid/i);
      });
    });

    describe('No skills found', () => {
      it('should display appropriate message when no skills found', async () => {
        // Arrange - empty directory
        const emptyDir = join(testDir, 'empty');
        await fs.mkdir(emptyDir, { recursive: true });

        // Act
        await validateCommand(emptyDir, {});

        // Assert
        expect(consoleLogSpy).toHaveBeenCalled();
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/no skills found/i);
      });

      it('should exit with code 0 when no skills found', async () => {
        // Arrange - empty directory
        const emptyDir = join(testDir, 'empty');
        await fs.mkdir(emptyDir, { recursive: true });

        // Act
        await validateCommand(emptyDir, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(0);
      });

      it('should handle directory with only non-skill files', async () => {
        // Arrange
        const dir = join(testDir, 'non-skills');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(join(dir, 'README.md'), '# Not a skill');
        await fs.writeFile(join(dir, 'notes.txt'), 'Some notes');

        // Act
        await validateCommand(dir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/no skills found/i);
      });
    });
  });

  describe('Error Handling', () => {
    describe('Path does not exist', () => {
      it('should display error message for non-existent path', async () => {
        // Arrange
        const nonExistentPath = join(testDir, 'does-not-exist');

        // Act
        await validateCommand(nonExistentPath, {});

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalled();
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/not found|does not exist/i);
      });

      it('should exit with code 1 for non-existent path', async () => {
        // Arrange
        const nonExistentPath = join(testDir, 'does-not-exist');

        // Act
        await validateCommand(nonExistentPath, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });
    });

    describe('Not a skill directory (no SKILL.md)', () => {
      it('should display error when directory has no SKILL.md', async () => {
        // Arrange
        const noSkillDir = join(testDir, 'no-skill');
        await fs.mkdir(noSkillDir, { recursive: true });
        await fs.writeFile(join(noSkillDir, 'README.md'), '# Not a skill');

        // Act
        await validateCommand(noSkillDir, {});

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalled();
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/no.*skill\.md|not.*skill/i);
      });

      it('should exit with code 1 when no SKILL.md found', async () => {
        // Arrange
        const noSkillDir = join(testDir, 'no-skill');
        await fs.mkdir(noSkillDir, { recursive: true });
        await fs.writeFile(join(noSkillDir, 'README.md'), '# Not a skill');

        // Act
        await validateCommand(noSkillDir, {});

        // Assert
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });
    });

    describe('Permission errors', () => {
      it('should handle permission errors gracefully', async () => {
        // Arrange
        const restrictedDir = join(testDir, 'restricted');
        await fs.mkdir(restrictedDir, { recursive: true });
        await createValidSkill(restrictedDir);
        
        // Make directory unreadable (Unix-like systems only)
        if (process.platform !== 'win32') {
          await fs.chmod(restrictedDir, 0o000);
        } else {
          // Skip on Windows
          return;
        }

        // Act
        try {
          await validateCommand(restrictedDir, {});

          // Assert
          expect(consoleErrorSpy).toHaveBeenCalled();
          const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
          expect(output).toMatch(/permission|access/i);
          expect(processExitSpy).toHaveBeenCalledWith(1);
        } finally {
          // Restore permissions for cleanup
          await fs.chmod(restrictedDir, 0o755);
        }
      });
    });

    describe('No path provided (should validate default locations)', () => {
      it('should validate skills in default locations when no path provided', async () => {
        // This test requires mocking config to provide default locations
        // For now, we'll test that it doesn't crash
        
        // Act
        await validateCommand(undefined, {});

        // Assert
        // Should either find skills or report none found, but not crash
        expect(processExitSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Output Formatting', () => {
    describe('Success format', () => {
      it('should use green checkmark for success', async () => {
        // Arrange
        const skillDir = join(testDir, 'valid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createValidSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✓/);
      });

      it('should include skill name in success message', async () => {
        // Arrange
        const skillDir = join(testDir, 'valid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createValidSkill(skillDir, 'my-awesome-skill');

        // Act
        await validateCommand(skillDir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/my-awesome-skill/);
        expect(output).toMatch(/valid/i);
      });
    });

    describe('Error format', () => {
      it('should use red X for errors', async () => {
        // Arrange
        const skillDir = join(testDir, 'invalid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createParseErrorSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✗/);
      });

      it('should include error details with indentation', async () => {
        // Arrange
        const skillDir = join(testDir, 'invalid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createParseErrorSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        // Should have indented error details (spaces or dashes)
        expect(output).toMatch(/\s{2,}|  -/);
      });
    });

    describe('Warning format', () => {
      it('should use yellow warning symbol for warnings', async () => {
        // Arrange
        const skillDir = join(testDir, 'warning-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createWarningSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/⚠/);
      });

      it('should include warning description', async () => {
        // Arrange
        const skillDir = join(testDir, 'warning-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createWarningSkill(skillDir);

        // Act
        await validateCommand(skillDir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/warning/i);
      });
    });

    describe('Summary format', () => {
      it('should display summary with skill counts', async () => {
        // Arrange
        const skill1 = join(testDir, 'skill-1');
        const skill2 = join(testDir, 'skill-2');
        await fs.mkdir(skill1, { recursive: true });
        await fs.mkdir(skill2, { recursive: true });
        await createValidSkill(skill1);
        await createValidSkill(skill2);

        // Act
        await validateCommand(testDir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/validated.*2.*skills/i);
        expect(output).toMatch(/2.*valid/i);
        expect(output).toMatch(/0.*invalid/i);
      });

      it('should use proper pluralization for summary', async () => {
        // Arrange - single skill
        const skill1 = join(testDir, 'skill-1');
        await fs.mkdir(skill1, { recursive: true });
        await createValidSkill(skill1);

        // Act
        await validateCommand(testDir, {});

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        // Should handle singular properly
        expect(output).toMatch(/1.*skill|skill[^s]|1.*valid/i);
      });
    });
  });

  describe('--fix Flag', () => {
    describe('Not implemented (stub)', () => {
      it('should display not implemented message when --fix used', async () => {
        // Arrange
        const skillDir = join(testDir, 'valid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createValidSkill(skillDir);

        // Act
        await validateCommand(skillDir, { fix: true });

        // Assert
        expect(consoleLogSpy).toHaveBeenCalled();
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/auto-fix.*not.*implemented|--fix.*not.*available/i);
      });

      it('should still validate when --fix flag is used', async () => {
        // Arrange
        const skillDir = join(testDir, 'valid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createValidSkill(skillDir);

        // Act
        await validateCommand(skillDir, { fix: true });

        // Assert
        const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✓.*test-skill/i);
        expect(processExitSpy).toHaveBeenCalledWith(0);
      });

      it('should report issues even with --fix flag', async () => {
        // Arrange
        const skillDir = join(testDir, 'invalid-skill');
        await fs.mkdir(skillDir, { recursive: true });
        await createParseErrorSkill(skillDir);

        // Act
        await validateCommand(skillDir, { fix: true });

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalled();
        const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
        expect(output).toMatch(/✗/);
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Combined Flags', () => {
    it('should handle --strict and --fix together', async () => {
      // Arrange
      const skillDir = join(testDir, 'warning-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await createWarningSkill(skillDir);

      // Act
      await validateCommand(skillDir, { strict: true, fix: true });

      // Assert
      const allOutput = [
        ...consoleLogSpy.mock.calls.map(call => call.join(' ')),
        ...consoleErrorSpy.mock.calls.map(call => call.join(' '))
      ].join('\n');
      expect(allOutput).toMatch(/auto-fix.*not.*implemented/i);
      expect(processExitSpy).toHaveBeenCalledWith(1); // Should fail due to strict mode
    });
  });

  describe('Edge Cases', () => {
    it('should handle skill with very long content', async () => {
      // Arrange
      const skillDir = join(testDir, 'long-skill');
      await fs.mkdir(skillDir, { recursive: true });
      const longContent = `---
name: long-skill
description: A skill with very long content
---

# Long Skill

${'Lorem ipsum dolor sit amet. '.repeat(1000)}
`;
      await createSkillFile(skillDir, longContent);

      // Act
      await validateCommand(skillDir, {});

      // Assert - should handle without crashing
      expect(processExitSpy).toHaveBeenCalled();
    });

    it('should handle skill with special characters in description', async () => {
      // Arrange
      const skillDir = join(testDir, 'special-skill');
      await fs.mkdir(skillDir, { recursive: true });
      const content = `---
name: skill-with-special-chars
description: Testing special characters émojis 🚀 and unicode 日本語 in skill description field
license: MIT
---

# Special Skill

This tests special characters in descriptions are allowed.
`;
      await createSkillFile(skillDir, content);

      // Act
      await validateCommand(skillDir, {});

      // Assert
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/skill-with-special-chars/);
      expect(output).toMatch(/valid/);
    });

    it('should handle nested directory structures when validating all', async () => {
      // Arrange
      const nested1 = join(testDir, 'category1', 'skill-1');
      const nested2 = join(testDir, 'category2', 'skill-2');
      await fs.mkdir(nested1, { recursive: true });
      await fs.mkdir(nested2, { recursive: true });
      await createValidSkill(nested1, 'nested-skill-1');
      await createValidSkill(nested2, 'nested-skill-2');

      // Act
      await validateCommand(testDir, {});

      // Assert
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/nested-skill-1/);
      expect(output).toMatch(/nested-skill-2/);
    });
  });
});
