import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { installCommand } from '../install.js';
import { SkillInstaller } from '@codemcp/agentskills-core';
import type { InstallResult } from '@codemcp/agentskills-core';

/**
 * Comprehensive test suite for install command
 * 
 * Following TDD RED phase:
 * - Write tests first to define the command interface and behavior
 * - Tests define expected user experience before implementation
 * - Clear test structure with arrange-act-assert
 * - Mock SkillInstaller to avoid real downloads
 * - Use real file system with temp directories
 * 
 * Coverage:
 * 1. Basic Installation (install skills, create directory, parallel install, lock file, success message)
 * 2. Error Handling (no package.json, no agentskills field, empty agentskills, installation failures)
 * 3. Configuration (custom skillsDirectory, default directory, create parent dirs)
 * 4. Output (spinner, checkmarks, summary)
 * 5. Options (custom cwd, default cwd)
 */

describe('install command', () => {
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;
  let skillInstallerInstallSpy: any;
  let skillInstallerGenerateLockFileSpy: any;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `agentskills-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock console and process.exit
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    // Mock SkillInstaller methods
    skillInstallerInstallSpy = vi.spyOn(SkillInstaller.prototype, 'install');
    skillInstallerGenerateLockFileSpy = vi.spyOn(SkillInstaller.prototype, 'generateLockFile');
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
    skillInstallerInstallSpy.mockRestore();
    skillInstallerGenerateLockFileSpy.mockRestore();
  });

  // Helper function to create package.json with agentskills
  async function createPackageJson(skills: Record<string, string>, config?: any): Promise<void> {
    const packageJson: any = {
      name: 'test-project',
      version: '1.0.0',
      agentskills: skills,
    };

    if (config) {
      packageJson.agentskillsConfig = config;
    }

    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );
  }

  // Helper function to create successful install result
  function createSuccessResult(name: string, spec: string): InstallResult {
    return {
      success: true,
      name,
      spec,
      resolvedVersion: '1.0.0',
      integrity: 'sha512-test',
      installPath: join(testDir, '.agentskills/skills', name),
      manifest: {
        name,
        description: 'Test skill',
      },
    };
  }

  // Helper function to create failed install result
  function createFailureResult(name: string, spec: string, message: string): InstallResult {
    return {
      success: false,
      name,
      spec,
      error: {
        code: 'INSTALL_FAILED',
        message,
      },
    };
  }

  describe('Basic Installation', () => {
    it('should install skills from package.json', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/skill-one',
        'skill-two': 'github:user/skill-two',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        return createSuccessResult(name, spec);
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(skillInstallerInstallSpy).toHaveBeenCalledWith('skill-one', 'github:user/skill-one');
      expect(skillInstallerInstallSpy).toHaveBeenCalledWith('skill-two', 'github:user/skill-two');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should create .agentskills/skills/ directory', async () => {
      // Arrange
      await createPackageJson({
        'test-skill': 'github:user/test-skill',
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('test-skill', 'github:user/test-skill')
      );
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      const skillsDir = join(testDir, '.agentskills/skills');
      const exists = await fs.access(skillsDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should install multiple skills in parallel', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/skill-one',
        'skill-two': 'github:user/skill-two',
        'skill-three': 'github:user/skill-three',
      });

      const installPromises: Promise<InstallResult>[] = [];
      
      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        const promise = new Promise<InstallResult>((resolve) => {
          setTimeout(() => resolve(createSuccessResult(name, spec)), 10);
        });
        installPromises.push(promise);
        return promise;
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      const startTime = Date.now();
      await installCommand({ cwd: testDir });
      const duration = Date.now() - startTime;

      // Assert - should complete in parallel (< 50ms total, not 30ms sequential)
      expect(installPromises.length).toBe(3);
      expect(duration).toBeLessThan(50); // If sequential, would take 30ms
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should generate lock file after installation', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/skill-one',
      });

      const result = createSuccessResult('skill-one', 'github:user/skill-one');
      skillInstallerInstallSpy.mockResolvedValue(result);
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(skillInstallerGenerateLockFileSpy).toHaveBeenCalledWith({
        'skill-one': result,
      });
    });

    it('should display success message', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/skill-one',
        'skill-two': 'github:user/skill-two',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        return createSuccessResult(name, spec);
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/installed.*2.*skills?/i);
      expect(output).toMatch(/\.agentskills\/skills/i);
    });
  });

  describe('Error Handling', () => {
    it('should error when no package.json found', async () => {
      // Arrange - no package.json created

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/package\.json.*not found/i);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should warn and exit 0 when no agentskills field', async () => {
      // Arrange
      await fs.writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2),
        'utf-8'
      );

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/no.*skills.*install|agentskills.*field.*empty/i);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should warn and exit 0 when empty agentskills object', async () => {
      // Arrange
      await createPackageJson({});

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/no.*skills.*install|agentskills.*empty/i);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should show error for failed skill but continue installing others', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/skill-one',
        'skill-two': 'github:user/invalid-skill',
        'skill-three': 'github:user/skill-three',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        if (name === 'skill-two') {
          return createFailureResult(name, spec, 'Package not found');
        }
        return createSuccessResult(name, spec);
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(skillInstallerInstallSpy).toHaveBeenCalledTimes(3);
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(errorOutput).toMatch(/skill-two.*failed/i);
      expect(errorOutput).toMatch(/package not found/i);
      
      const logOutput = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(logOutput).toMatch(/2.*installed/i);
      expect(logOutput).toMatch(/1.*failed/i);
    });

    it('should exit with code 1 when all skills fail to install', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/invalid-one',
        'skill-two': 'github:user/invalid-two',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        return createFailureResult(name, spec, 'Network error');
      });

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/skill-one.*failed/i);
      expect(output).toMatch(/skill-two.*failed/i);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should error when package.json is invalid JSON', async () => {
      // Arrange
      await fs.writeFile(
        join(testDir, 'package.json'),
        '{ invalid json }',
        'utf-8'
      );

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/failed.*parse|invalid.*json/i);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should error when permission error creating directory', async () => {
      // Arrange
      await createPackageJson({
        'test-skill': 'github:user/test-skill',
      });

      // Create a file where the directory should be to cause EEXIST error
      const skillsDir = join(testDir, '.agentskills');
      await fs.mkdir(skillsDir, { recursive: true });
      await fs.writeFile(join(skillsDir, 'skills'), 'blocking file', 'utf-8');

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('test-skill', 'github:user/test-skill')
      );

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/failed.*create.*directory|permission|error/i);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Configuration', () => {
    it('should use agentskillsConfig.skillsDirectory if specified', async () => {
      // Arrange
      await createPackageJson(
        {
          'test-skill': 'github:user/test-skill',
        },
        {
          skillsDirectory: 'custom-skills-dir',
        }
      );

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('test-skill', 'github:user/test-skill')
      );
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      // SkillInstaller should be created with custom directory
      const customDir = join(testDir, 'custom-skills-dir');
      const exists = await fs.access(customDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should default to .agentskills/skills/ if not specified', async () => {
      // Arrange
      await createPackageJson({
        'test-skill': 'github:user/test-skill',
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('test-skill', 'github:user/test-skill')
      );
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      const defaultDir = join(testDir, '.agentskills/skills');
      const exists = await fs.access(defaultDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create parent directories if needed', async () => {
      // Arrange
      await createPackageJson(
        {
          'test-skill': 'github:user/test-skill',
        },
        {
          skillsDirectory: 'deeply/nested/skills/directory',
        }
      );

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('test-skill', 'github:user/test-skill')
      );
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      const nestedDir = join(testDir, 'deeply/nested/skills/directory');
      const exists = await fs.access(nestedDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Output', () => {
    it('should show spinner during installation', async () => {
      // Arrange
      await createPackageJson({
        'test-skill': 'github:user/test-skill',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        // Simulate some delay
        await new Promise(resolve => setTimeout(resolve, 50));
        return createSuccessResult(name, spec);
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      // Output should contain some indication of progress (spinner messages)
      // The actual implementation will use ora for spinners
      expect(output.length).toBeGreaterThan(0);
    });

    it('should show success checkmarks for each skill', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/skill-one',
        'skill-two': 'github:user/skill-two',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        return createSuccessResult(name, spec);
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/✓.*skill-one/i);
      expect(output).toMatch(/✓.*skill-two/i);
    });

    it('should show final summary with count and location', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/skill-one',
        'skill-two': 'github:user/skill-two',
        'skill-three': 'github:user/skill-three',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        return createSuccessResult(name, spec);
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/3.*skills?.*installed/i);
      expect(output).toMatch(/\.agentskills\/skills/i);
    });
  });

  describe('Options', () => {
    it('should use custom cwd option', async () => {
      // Arrange
      const customDir = join(testDir, 'custom-project');
      await fs.mkdir(customDir, { recursive: true });
      await fs.writeFile(
        join(customDir, 'package.json'),
        JSON.stringify({
          name: 'custom-project',
          agentskills: {
            'test-skill': 'github:user/test-skill',
          },
        }, null, 2),
        'utf-8'
      );

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('test-skill', 'github:user/test-skill')
      );
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: customDir });

      // Assert
      const skillsDir = join(customDir, '.agentskills/skills');
      const exists = await fs.access(skillsDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should default cwd to process.cwd()', async () => {
      // Arrange
      const originalCwd = process.cwd();
      
      // Change to test directory
      process.chdir(testDir);

      await createPackageJson({
        'test-skill': 'github:user/test-skill',
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('test-skill', 'github:user/test-skill')
      );
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      try {
        // Act
        await installCommand(); // No cwd option

        // Assert
        const skillsDir = join(testDir, '.agentskills/skills');
        const exists = await fs.access(skillsDir).then(() => true).catch(() => false);
        expect(exists).toBe(true);
        expect(processExitSpy).toHaveBeenCalledWith(0);
      } finally {
        // Restore original cwd
        process.chdir(originalCwd);
      }
    });
  });

  describe('Lock File Generation', () => {
    it('should generate lock file only with successful installs', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/skill-one',
        'skill-two': 'github:user/invalid-skill',
        'skill-three': 'github:user/skill-three',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        if (name === 'skill-two') {
          return createFailureResult(name, spec, 'Package not found');
        }
        return createSuccessResult(name, spec);
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(skillInstallerGenerateLockFileSpy).toHaveBeenCalledTimes(1);
      const lockFileArg = skillInstallerGenerateLockFileSpy.mock.calls[0][0] as Record<string, InstallResult>;
      expect(Object.keys(lockFileArg)).toHaveLength(2);
      expect(lockFileArg['skill-one']).toBeDefined();
      expect(lockFileArg['skill-three']).toBeDefined();
      expect(lockFileArg['skill-two']).toBeUndefined();
    });

    it('should not generate lock file when all installs fail', async () => {
      // Arrange
      await createPackageJson({
        'skill-one': 'github:user/invalid-one',
        'skill-two': 'github:user/invalid-two',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        return createFailureResult(name, spec, 'Network error');
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(skillInstallerGenerateLockFileSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle skills with special characters in names', async () => {
      // Arrange
      await createPackageJson({
        'skill-with-dashes': 'github:user/skill-with-dashes',
        '@scoped/skill': 'github:org/scoped-skill',
      });

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        return createSuccessResult(name, spec);
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(skillInstallerInstallSpy).toHaveBeenCalledWith('skill-with-dashes', 'github:user/skill-with-dashes');
      expect(skillInstallerInstallSpy).toHaveBeenCalledWith('@scoped/skill', 'github:org/scoped-skill');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle large number of skills', async () => {
      // Arrange
      const skills: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        skills[`skill-${i}`] = `github:user/skill-${i}`;
      }
      await createPackageJson(skills);

      skillInstallerInstallSpy.mockImplementation(async (name: string, spec: string) => {
        return createSuccessResult(name, spec);
      });
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Act
      await installCommand({ cwd: testDir });

      // Assert
      expect(skillInstallerInstallSpy).toHaveBeenCalledTimes(50);
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toMatch(/50.*skills?.*installed/i);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle installation with no output captured', async () => {
      // Arrange
      await createPackageJson({
        'test-skill': 'github:user/test-skill',
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('test-skill', 'github:user/test-skill')
      );
      skillInstallerGenerateLockFileSpy.mockResolvedValue(undefined);

      // Remove console spies to ensure command works without them
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();

      // Act & Assert - should not throw
      await installCommand({ cwd: testDir });
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });
});
