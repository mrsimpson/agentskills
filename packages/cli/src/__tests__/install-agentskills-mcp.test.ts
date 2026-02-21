/**
 * Tests for auto-install agentskills-mcp server feature
 *
 * TDD RED PHASE - Tests written before implementation
 * These tests define the expected behavior of automatically installing
 * the @codemcp/agentskills-mcp server when running install command.
 *
 * Task: agent-skills-2.3.19
 * Phase: TDD RED - Writing failing tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { installCommand } from "../commands/install.js";
import {
  PackageConfigManager,
  SkillInstaller,
  MCPConfigManager,
  MCPDependencyChecker
} from "@codemcp/agentskills-core";
import type {
  PackageConfig,
  InstallResult,
  McpDependencyCheckResult
} from "@codemcp/agentskills-core";

// Mock fs module
vi.mock("fs", () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    rm: vi.fn()
  }
}));

// Mock inquirer
vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock all dependencies
vi.mock("@codemcp/agentskills-core", async () => {
  const actualCore = await vi.importActual("@codemcp/agentskills-core");
  return {
    ...actualCore,
    PackageConfigManager: vi.fn(),
    SkillInstaller: vi.fn(),
    MCPConfigManager: vi.fn(),
    MCPDependencyChecker: vi.fn()
  };
});

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis()
  }))
}));

describe("Install Command - Auto-install agentskills-mcp Server", () => {
  let mockConfigManager: any;
  let mockInstaller: any;
  let mockMCPConfigManager: any;
  let mockMCPDependencyChecker: any;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;
  let processCwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Setup mocks
    mockConfigManager = {
      loadConfig: vi.fn()
    };

    mockInstaller = {
      install: vi.fn(),
      generateLockFile: vi.fn(),
      loadInstalledSkills: vi.fn()
    };

    mockMCPConfigManager = {
      detectClient: vi.fn(),
      isServerConfigured: vi.fn(),
      addServer: vi.fn()
    };

    mockMCPDependencyChecker = {
      collectDependencies: vi.fn(),
      checkDependencies: vi.fn()
    };

    vi.mocked(PackageConfigManager).mockImplementation(() => mockConfigManager);
    vi.mocked(SkillInstaller).mockImplementation(() => mockInstaller);
    vi.mocked(MCPConfigManager).mockImplementation(() => mockMCPConfigManager);
    vi.mocked(MCPDependencyChecker).mockImplementation(
      () => mockMCPDependencyChecker
    );

    // Setup spies
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);
    processCwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/test/project");

    // Default mock implementations
    mockConfigManager.loadConfig.mockResolvedValue({
      skills: {},
      config: {
        skillsDirectory: ".agentskills/skills",
        autoDiscover: [],
        maxSkillSize: 5000,
        logLevel: "info"
      },
      source: {
        type: "file",
        path: "/test/project/package.json"
      }
    } as PackageConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    processCwdSpy.mockRestore();
  });

  describe("First install - agentskills server not configured", () => {
    it("should add agentskills server after successful skill installation", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false); // agentskills NOT configured
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify agentskills server was added
      expect(mockMCPConfigManager.isServerConfigured).toHaveBeenCalledWith(
        "claude-desktop",
        "agentskills"
      );
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "agentskills",
        {
          command: "npx",
          args: ["-y", "@codemcp/agentskills-mcp"],
          env: {},
          cwd: "/test/project"
        }
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should show success message when agentskills server is added", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("agentskills")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/added|configured/i)
      );
    });

    it("should use process.cwd() as cwd in server config", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      processCwdSpy.mockReturnValue("/custom/working/directory");

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({
        cwd: "/custom/working/directory",
        withMcp: false
      });

      // Verify cwd is from process.cwd()
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "agentskills",
        expect.objectContaining({
          cwd: "/custom/working/directory"
        })
      );
    });

    it("should work with --with-mcp flag", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute with --with-mcp
      await installCommand({ cwd: "/test/project", withMcp: true });

      // Verify agentskills server was added
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "agentskills",
        expect.objectContaining({
          command: "npx",
          args: ["-y", "@codemcp/agentskills-mcp"]
        })
      );
    });
  });

  describe("Subsequent install - agentskills server already configured", () => {
    it("should skip adding agentskills server when already configured", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(true); // ALREADY configured
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify agentskills server was NOT added
      expect(mockMCPConfigManager.isServerConfigured).toHaveBeenCalledWith(
        "claude-desktop",
        "agentskills"
      );
      expect(mockMCPConfigManager.addServer).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should not show message when skipping already configured server", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(true);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      consoleLogSpy.mockClear(); // Clear previous calls

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify NO message about agentskills (silently skip)
      const agentskillsMessages = consoleLogSpy.mock.calls.filter((call) =>
        call.some((arg) => String(arg).toLowerCase().includes("agentskills"))
      );
      expect(agentskillsMessages.length).toBe(0);
    });
  });

  describe("Works with all MCP client types", () => {
    it("should add agentskills server for claude-desktop client", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "agentskills",
        expect.any(Object)
      );
    });

    it("should add agentskills server for cline client", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("cline");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "cline",
        "agentskills",
        expect.any(Object)
      );
    });

    it("should add agentskills server for zed client", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("zed");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "zed",
        "agentskills",
        expect.any(Object)
      );
    });
  });

  describe("Handle MCP client not detected", () => {
    it("should skip gracefully when no MCP client is detected", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue(null); // NO client detected
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify graceful skip
      expect(mockMCPConfigManager.isServerConfigured).not.toHaveBeenCalled();
      expect(mockMCPConfigManager.addServer).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0); // Still successful
    });

    it("should not show error when MCP client not detected", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue(null);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify no error
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("agentskills")
      );
    });
  });

  describe("Handle addServer errors gracefully", () => {
    it("should not fail installation if addServer throws error", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockMCPConfigManager.addServer.mockRejectedValue(
        new Error("Failed to write config")
      );
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify installation still succeeds
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should log warning when addServer fails", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockMCPConfigManager.addServer.mockRejectedValue(
        new Error("Failed to write config")
      );
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify warning was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/warning|failed|could not/i)
      );
    });
  });

  describe("Server config format", () => {
    it("should use correct command format with npx", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify exact format
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "agentskills",
        {
          command: "npx",
          args: ["-y", "@codemcp/agentskills-mcp"],
          env: {},
          cwd: "/test/project"
        }
      );
    });

    it("should include empty env object in config", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/test-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/project/package.json"
        }
      };

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockMCPConfigManager.isServerConfigured.mockReturnValue(false);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/test-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([
        {
          metadata: { name: "test-skill", description: "Test skill" },
          body: "Skill content"
        }
      ]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test/project", withMcp: false });

      // Verify env is empty object
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "agentskills",
        expect.objectContaining({
          env: {}
        })
      );
    });
  });
});
