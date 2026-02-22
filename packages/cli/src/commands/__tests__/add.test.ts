import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { addCommand } from "../add.js";
import { SkillInstaller } from "@codemcp/agentskills-core";
import type { InstallResult } from "@codemcp/agentskills-core";

/**
 * Test suite for the add command
 *
 * New semantics (post-refactor):
 * - Validates the skill via a dry-run (download to temp dir) BEFORE touching package.json
 * - Adds skill to package.json only if validation succeeds
 * - Does NOT install the skill - prints a hint to run `agentskills install`
 * - No --skip-install option
 *
 * Coverage:
 * 1. Basic Operation (4 tests): validate + add, create field, create package.json, success message
 * 2. Error Handling (3 tests): empty name, empty spec, validation failure leaves package.json untouched
 * 3. Options (1 test): custom cwd
 * 4. Update Existing (2 tests): replace spec, preserve other skills
 * 5. Output (2 tests): spinner during validation, install hint shown
 */

describe("add command", () => {
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
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    // Mock SkillInstaller.install - used for dry-run validation
    skillInstallerInstallSpy = vi.spyOn(SkillInstaller.prototype, "install");
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
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
      join(testDir, "package.json"),
      JSON.stringify(content, null, 2),
      "utf-8"
    );
  }

  // Helper function to read package.json
  async function readPackageJson(): Promise<any> {
    const content = await fs.readFile(join(testDir, "package.json"), "utf-8");
    return JSON.parse(content);
  }

  // Helper function to create a successful validation result
  function createSuccessResult(name: string, spec: string): InstallResult {
    return {
      success: true,
      name,
      spec,
      resolvedVersion: "1.0.0",
      integrity: "sha512-test",
      installPath: join(testDir, ".agentskills/skills", name),
      manifest: {
        name,
        description: "Test skill"
      }
    };
  }

  describe("Basic Operation", () => {
    it("should validate skill then add it to package.json", async () => {
      // Arrange
      await createPackageJson({
        name: "test-project",
        version: "1.0.0",
        agentskills: {}
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult(
          "api-integration",
          "github:anthropic/api-integration#v1.0.0"
        )
      );

      // Act
      await addCommand(
        "api-integration",
        "github:anthropic/api-integration#v1.0.0",
        { cwd: testDir }
      );

      // Assert - validation (dry-run install) was called
      expect(skillInstallerInstallSpy).toHaveBeenCalledWith(
        "api-integration",
        "github:anthropic/api-integration#v1.0.0"
      );
      expect(skillInstallerInstallSpy).toHaveBeenCalledTimes(1);

      // Assert - package.json updated
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        "api-integration": "github:anthropic/api-integration#v1.0.0"
      });
    });

    it("should create agentskills field if it does not exist", async () => {
      // Arrange
      await createPackageJson({
        name: "test-project",
        version: "1.0.0"
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult("local-skill", "file:./skills/my-skill")
      );

      // Act
      await addCommand("local-skill", "file:./skills/my-skill", {
        cwd: testDir
      });

      // Assert
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        "local-skill": "file:./skills/my-skill"
      });
    });

    it("should create package.json if it does not exist", async () => {
      // Arrange - no package.json

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult("new-skill", "git+https://example.com/skill.git")
      );

      // Act
      await addCommand("new-skill", "git+https://example.com/skill.git", {
        cwd: testDir
      });

      // Assert
      const packageJson = await readPackageJson();
      expect(packageJson).toMatchObject({
        name: "agentskills-project",
        agentskills: {
          "new-skill": "git+https://example.com/skill.git"
        }
      });
    });

    it("should display success message with skill name and spec", async () => {
      // Arrange
      await createPackageJson({
        name: "test-project",
        version: "1.0.0",
        agentskills: {}
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult("success-skill", "github:user/skill#v2.0.0")
      );

      // Act
      await addCommand("success-skill", "github:user/skill#v2.0.0", {
        cwd: testDir
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

  describe("Error Handling", () => {
    it("should throw error when skill name is empty", async () => {
      await createPackageJson({
        name: "test-project",
        version: "1.0.0",
        agentskills: {}
      });

      await expect(
        addCommand("", "github:user/skill#v1.0.0", { cwd: testDir })
      ).rejects.toThrow("Skill name cannot be empty");

      // Validator and package.json must not be touched
      expect(skillInstallerInstallSpy).not.toHaveBeenCalled();
    });

    it("should throw error when spec is empty", async () => {
      await createPackageJson({
        name: "test-project",
        version: "1.0.0",
        agentskills: {}
      });

      await expect(
        addCommand("test-skill", "", { cwd: testDir })
      ).rejects.toThrow("Skill spec cannot be empty");

      expect(skillInstallerInstallSpy).not.toHaveBeenCalled();
    });

    it("should NOT update package.json when validation fails", async () => {
      // Arrange
      await createPackageJson({
        name: "test-project",
        version: "1.0.0",
        agentskills: {}
      });

      skillInstallerInstallSpy.mockResolvedValue({
        success: false,
        name: "bad-skill",
        spec: "github:user/nonexistent#v1.0.0",
        error: { message: "Repository not found" }
      });

      // Act & Assert
      await expect(
        addCommand("bad-skill", "github:user/nonexistent#v1.0.0", {
          cwd: testDir
        })
      ).rejects.toThrow("Repository not found");

      // package.json must NOT have been updated
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({});
    });
  });

  describe("Options", () => {
    it("should use custom cwd option", async () => {
      // Arrange
      const customDir = join(testDir, "custom");
      await fs.mkdir(customDir, { recursive: true });
      await fs.writeFile(
        join(customDir, "package.json"),
        JSON.stringify(
          { name: "custom-project", version: "1.0.0", agentskills: {} },
          null,
          2
        ),
        "utf-8"
      );

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult("custom-skill", "file:./skill")
      );

      // Act
      await addCommand("custom-skill", "file:./skill", { cwd: customDir });

      // Assert
      const packageJson = JSON.parse(
        await fs.readFile(join(customDir, "package.json"), "utf-8")
      );
      expect(packageJson.agentskills).toEqual({
        "custom-skill": "file:./skill"
      });
    });
  });

  describe("Update Existing", () => {
    it("should update existing skill with new spec", async () => {
      // Arrange
      await createPackageJson({
        name: "test-project",
        version: "1.0.0",
        agentskills: {
          "existing-skill": "github:user/skill#v1.0.0"
        }
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult("existing-skill", "github:user/skill#v2.0.0")
      );

      // Act
      await addCommand("existing-skill", "github:user/skill#v2.0.0", {
        cwd: testDir
      });

      // Assert
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        "existing-skill": "github:user/skill#v2.0.0"
      });
    });

    it("should preserve other skills when adding new skill", async () => {
      // Arrange
      await createPackageJson({
        name: "test-project",
        version: "1.0.0",
        agentskills: {
          "skill-one": "github:user/skill-one#v1.0.0",
          "skill-two": "github:user/skill-two#v1.0.0"
        }
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult("skill-three", "github:user/skill-three#v1.0.0")
      );

      // Act
      await addCommand("skill-three", "github:user/skill-three#v1.0.0", {
        cwd: testDir
      });

      // Assert
      const packageJson = await readPackageJson();
      expect(packageJson.agentskills).toEqual({
        "skill-one": "github:user/skill-one#v1.0.0",
        "skill-two": "github:user/skill-two#v1.0.0",
        "skill-three": "github:user/skill-three#v1.0.0"
      });
    });
  });

  describe("Output", () => {
    it("should show spinner during validation", async () => {
      // Arrange
      await createPackageJson({
        name: "test-project",
        version: "1.0.0",
        agentskills: {}
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult("spinner-skill", "github:user/skill#v1.0.0")
      );

      // Act
      await addCommand("spinner-skill", "github:user/skill#v1.0.0", {
        cwd: testDir
      });

      // Assert - spinner output or skill name in output after completion
      const allOutput = consoleLogSpy.mock.calls.flat().join(" ");
      expect(allOutput).toContain("spinner-skill");
    });

    it("should show install hint after adding skill", async () => {
      // Arrange
      await createPackageJson({
        name: "test-project",
        version: "1.0.0",
        agentskills: {}
      });

      skillInstallerInstallSpy.mockResolvedValue(
        createSuccessResult("hint-skill", "github:user/skill#v1.0.0")
      );

      // Act
      await addCommand("hint-skill", "github:user/skill#v1.0.0", {
        cwd: testDir
      });

      // Assert - hint about install command shown
      const allOutput = consoleLogSpy.mock.calls.flat().join("\n");
      expect(allOutput).toMatch(/agentskills install/);
    });
  });
});
