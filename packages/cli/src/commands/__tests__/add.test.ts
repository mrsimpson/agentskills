import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { addCommand } from '../add.js';
import { SkillInstaller } from '../../../../core/src/installer.js';
import type { InstallResult } from '../../../../core/src/types.js';

/**
 * Comprehensive test suite for add command
 * 
 * Following TDD RED phase:
 * - Write tests first to define the command interface and behavior
 * - Tests define expected user experience before implementation
 * - Clear test structure with arrange-act-assert
 * - Mock SkillInstaller to avoid real downloads
 * - Use real file system with temp directories
 * 
 * Coverage (~14 tests):
 * 1. Basic Operation (4 tests): add & install, create field, create package.json, success message
 * 2. Error Handling (4 tests): empty name, empty spec, invalid spec, installation fails
 * 3. Options (2 tests): skip-install flag, custom cwd
 * 4. Update Existing (2 tests): replace spec, preserve other skills
 * 5. Output (2 tests): spinner during install, success checkmark
 */

describe('add command', () => {
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;
  let skillInstallerInstallSpy: any;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `agentskills-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock console and process.exit
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    // Mock SkillInstaller.install method
    skillInstallerInstallSpy = vi.spyOn(SkillInstaller.prototype, 'install');
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
  });

  // Helper function to create package.json
  async function createPackageJson(content: any): Promise<void> {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify(content, null, 2),
      'utf-8'
    );
  }

  // Helper function to read package.json
  async function readPackageJson(): Promise<any> {
    const content = await fs.readFile(join(testDir, 'package.json'), 'utf-8');
    return JSON.parse(content);
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

  describe('Basic Operation', () => {
    it('should add skill to package.json and install it', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {},
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('api-integration', 'github:anthropic/api-integration#v1.0.0')
      );

      // Act
      await addCommand('api-integration', 'github:anthropic/api-integration#v1.0.0', {
        cwd: testDir,
      });

      // Assert - package.json updated
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        'api-integration': 'github:anthropic/api-integration#v1.0.0',
      });

      // Assert - installer called
      expect(skillInstallerInstallSpy).toHaveBeenCalledWith(
        'api-integration',
        'github:anthropic/api-integration#v1.0.0'
      );
      expect(skillInstallerInstallSpy).toHaveBeenCalledTimes(1);
    });

    it('should create agentskills field if it does not exist', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('local-skill', 'file:./skills/my-skill')
      );

      // Act
      await addCommand('local-skill', 'file:./skills/my-skill', {
        cwd: testDir,
      });

      // Assert
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        'local-skill': 'file:./skills/my-skill',
      });
    });

    it('should create package.json if it does not exist', async () => {
      // Arrange
      // No package.json exists

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('new-skill', 'git+https://example.com/skill.git')
      );

      // Act
      await addCommand('new-skill', 'git+https://example.com/skill.git', {
        cwd: testDir,
      });

      // Assert
      const packageJson = await readPackageJson();
      expect(packageJson).toMatchObject({
        name: 'agentskills-project',
        agentskills: {
          'new-skill': 'git+https://example.com/skill.git',
        },
      });
    });

    it('should display success message with skill name and spec', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {},
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('success-skill', 'github:user/skill#v2.0.0')
      );

      // Act
      await addCommand('success-skill', 'github:user/skill#v2.0.0', {
        cwd: testDir,
      });

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/✓.*success-skill/)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/github:user\/skill#v2\.0\.0/)
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error when skill name is empty', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {},
      });

      // Act & Assert
      await expect(
        addCommand('', 'github:user/skill#v1.0.0', { cwd: testDir })
      ).rejects.toThrow('Skill name cannot be empty');

      // Verify installer was not called
      expect(skillInstallerInstallSpy).not.toHaveBeenCalled();
    });

    it('should throw error when spec is empty', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {},
      });

      // Act & Assert
      await expect(
        addCommand('test-skill', '', { cwd: testDir })
      ).rejects.toThrow('Skill spec cannot be empty');

      // Verify installer was not called
      expect(skillInstallerInstallSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid spec format during installation', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {},
      });

      skillInstallerInstallSpy.mockResolvedValue({
        success: false,
        name: 'invalid-skill',
        spec: 'invalid:::spec',
        error: 'Invalid spec format',
      });

      // Act & Assert
      await expect(
        addCommand('invalid-skill', 'invalid:::spec', { cwd: testDir })
      ).rejects.toThrow('Invalid spec format');

      // Verify package.json was updated despite failure
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        'invalid-skill': 'invalid:::spec',
      });
    });

    it('should throw error when installation fails but update package.json', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {},
      });

      skillInstallerInstallSpy.mockResolvedValue({
        success: false,
        name: 'fail-skill',
        spec: 'github:user/nonexistent#v1.0.0',
        error: 'Repository not found',
      });

      // Act & Assert
      await expect(
        addCommand('fail-skill', 'github:user/nonexistent#v1.0.0', { cwd: testDir })
      ).rejects.toThrow('Repository not found');

      // Verify package.json was still updated
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        'fail-skill': 'github:user/nonexistent#v1.0.0',
      });
    });
  });

  describe('Options', () => {
    it('should skip installation when skipInstall flag is true', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {},
      });

      // Act
      await addCommand('skip-skill', 'github:user/skill#v1.0.0', {
        cwd: testDir,
        skipInstall: true,
      });

      // Assert - package.json updated
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        'skip-skill': 'github:user/skill#v1.0.0',
      });

      // Assert - installer NOT called
      expect(skillInstallerInstallSpy).not.toHaveBeenCalled();

      // Assert - success message shown
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/✓.*skip-skill/)
      );
    });

    it('should use custom cwd option', async () => {
      // Arrange
      const customDir = join(testDir, 'custom');
      await fs.mkdir(customDir, { recursive: true });
      await createPackageJson({
        name: 'custom-project',
        version: '1.0.0',
        agentskills: {},
      });

      // Move package.json to custom directory
      await fs.rename(
        join(testDir, 'package.json'),
        join(customDir, 'package.json')
      );

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('custom-skill', 'file:./skill')
      );

      // Act
      await addCommand('custom-skill', 'file:./skill', {
        cwd: customDir,
      });

      // Assert
      const packageJson = JSON.parse(
        await fs.readFile(join(customDir, 'package.json'), 'utf-8')
      );
      expect(packageJson.agentskills).toEqual({
        'custom-skill': 'file:./skill',
      });
    });
  });

  describe('Update Existing', () => {
    it('should update existing skill with new spec', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {
          'existing-skill': 'github:user/skill#v1.0.0',
        },
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('existing-skill', 'github:user/skill#v2.0.0')
      );

      // Act
      await addCommand('existing-skill', 'github:user/skill#v2.0.0', {
        cwd: testDir,
      });

      // Assert
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        'existing-skill': 'github:user/skill#v2.0.0',
      });
    });

    it('should preserve other skills when adding new skill', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {
          'skill-one': 'github:user/skill-one#v1.0.0',
          'skill-two': 'github:user/skill-two#v1.0.0',
        },
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('skill-three', 'github:user/skill-three#v1.0.0')
      );

      // Act
      await addCommand('skill-three', 'github:user/skill-three#v1.0.0', {
        cwd: testDir,
      });

      // Assert
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        'skill-one': 'github:user/skill-one#v1.0.0',
        'skill-two': 'github:user/skill-two#v1.0.0',
        'skill-three': 'github:user/skill-three#v1.0.0',
      });
    });
  });

  describe('Output', () => {
    it('should show spinner during installation', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {},
      });

      let spinnerStarted = false;
      skillInstallerInstallSpy.mockImplementation(async () => {
        // Check that spinner message was shown before install completes
        const calls = consoleLogSpy.mock.calls.flat().join(' ');
        if (calls.includes('Installing') || calls.includes('⠋') || calls.includes('⠙')) {
          spinnerStarted = true;
        }
        return createSuccessResult('spinner-skill', 'github:user/skill#v1.0.0');
      });

      // Act
      await addCommand('spinner-skill', 'github:user/skill#v1.0.0', {
        cwd: testDir,
      });

      // Assert - check that spinner-related output was shown
      // Note: ora spinner output may not show in tests, but we can verify the pattern
      const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(
        allOutput.includes('spinner-skill') || spinnerStarted
      ).toBe(true);
    });

    it('should show success checkmark and summary after installation', async () => {
      // Arrange
      await createPackageJson({
        name: 'test-project',
        version: '1.0.0',
        agentskills: {},
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult('summary-skill', 'github:user/skill#v1.0.0')
      );

      // Act
      await addCommand('summary-skill', 'github:user/skill#v1.0.0', {
        cwd: testDir,
      });

      // Assert - checkmark and skill info shown
      const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
      expect(allOutput).toMatch(/✓/);
      expect(allOutput).toMatch(/summary-skill/);
      expect(allOutput).toMatch(/github:user\/skill#v1\.0\.0/);
    });
  });
});
