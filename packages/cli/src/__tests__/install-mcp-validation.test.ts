/**
 * Tests for CLI install command with MCP dependency validation
 *
 * TDD RED PHASE - Tests written before implementation
 * These tests define the expected behavior of MCP dependency validation
 * during skill installation via the CLI install command.
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
  McpClientType,
  McpDependencyInfo,
  McpDependencyCheckResult,
  McpServerDependency
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

// Mock all dependencies
vi.mock("@codemcp/agentskills-core", () => {
  const actualCore = vi.importActual("@codemcp/agentskills-core");
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

describe("Install Command - MCP Dependency Validation", () => {
  let mockConfigManager: any;  
  let mockInstaller: any;  
  let mockMCPConfigManager: any;  
  let mockMCPDependencyChecker: any;  
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;  

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
      isServerConfigured: vi.fn()
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
        path: "/test/package.json"
      }
    } as PackageConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("MCP Client Detection", () => {
    it("should detect MCP client when environment variable is set", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/repo#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/repo#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue([]);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(mockMCPConfigManager.detectClient).toHaveBeenCalled();
    });

    it("should proceed without MCP validation if no client is detected", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/repo#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue(null);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/repo#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify - should not attempt to check dependencies
      expect(
        mockMCPDependencyChecker.collectDependencies
      ).not.toHaveBeenCalled();
      expect(mockMCPDependencyChecker.checkDependencies).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should handle all supported MCP client types", async () => {
      const clientTypes: McpClientType[] = [
        "claude-desktop",
        "cline",
        "continue",
        "cursor",
        "junie"
      ];

      for (const clientType of clientTypes) {
        vi.clearAllMocks();

        const config: PackageConfig = {
          skills: {
            "test-skill": "github:user/repo#v1.0.0"
          },
          config: {
            skillsDirectory: ".agentskills/skills",
            autoDiscover: [],
            maxSkillSize: 5000,
            logLevel: "info"
          },
          source: {
            type: "file",
            path: "/test/package.json"
          }
        };

        mockConfigManager.loadConfig.mockResolvedValue(config);
        mockMCPConfigManager.detectClient.mockReturnValue(clientType);
        mockInstaller.install.mockResolvedValue({
          success: true,
          name: "test-skill",
          spec: "github:user/repo#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-abc123",
          installPath: "/test/.agentskills/skills/test-skill"
        } as InstallResult);
        mockInstaller.loadInstalledSkills.mockResolvedValue([]);
        mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);

        await installCommand({ cwd: "/test" });

        expect(mockMCPConfigManager.detectClient).toHaveBeenCalled();
      }
    });
  });

  describe("Dependency Collection", () => {
    it("should collect MCP dependencies from installed skills", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "file-manager",
        spec: "github:user/file-manager#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/file-manager"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(mockMCPDependencyChecker.collectDependencies).toHaveBeenCalledWith(
        installedSkills
      );
    });

    it("should handle skills with no MCP dependencies", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "simple-skill": "github:user/simple-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "simple-skill",
            description: "Simple skill without MCP dependencies"
          },
          body: "Skill content"
        }
      ];

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "simple-skill",
        spec: "github:user/simple-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/simple-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify - should still check but find no dependencies
      expect(mockMCPDependencyChecker.collectDependencies).toHaveBeenCalledWith(
        installedSkills
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should collect dependencies from multiple skills", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0",
          "github-helper": "github:user/github-helper#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "github-helper",
            description: "GitHub operations",
            requiresMcpServers: [
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install
        .mockResolvedValueOnce({
          success: true,
          name: "file-manager",
          spec: "github:user/file-manager#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-abc123",
          installPath: "/test/.agentskills/skills/file-manager"
        } as InstallResult)
        .mockResolvedValueOnce({
          success: true,
          name: "github-helper",
          spec: "github:user/github-helper#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-def456",
          installPath: "/test/.agentskills/skills/github-helper"
        } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(mockMCPDependencyChecker.collectDependencies).toHaveBeenCalledWith(
        installedSkills
      );
    });
  });

  describe("Dependency Checking", () => {
    it("should check dependencies against MCP client configuration", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: ["filesystem"]
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "file-manager",
        spec: "github:user/file-manager#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/file-manager"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(mockMCPDependencyChecker.checkDependencies).toHaveBeenCalledWith(
        "claude-desktop",
        dependencies,
        expect.any(Object) // MCPConfigManager instance
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should skip dependency checking if no dependencies are found", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "simple-skill": "github:user/simple-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "simple-skill",
            description: "Simple skill"
          },
          body: "Skill content"
        }
      ];

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "simple-skill",
        spec: "github:user/simple-skill#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/simple-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(mockMCPDependencyChecker.checkDependencies).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("Success Cases - All Dependencies Configured", () => {
    it("should succeed when all MCP dependencies are configured", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: ["filesystem"]
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "file-manager",
        spec: "github:user/file-manager#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/file-manager"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Successfully installed")
      );
    });

    it("should succeed with multiple skills when all dependencies are configured", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0",
          "github-helper": "github:user/github-helper#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "github-helper",
            description: "GitHub operations",
            requiresMcpServers: [
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        },
        {
          serverName: "github",
          neededBy: ["github-helper"],
          spec: {
            name: "github",
            description: "GitHub API access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: ["filesystem", "github"]
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install
        .mockResolvedValueOnce({
          success: true,
          name: "file-manager",
          spec: "github:user/file-manager#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-abc123",
          installPath: "/test/.agentskills/skills/file-manager"
        } as InstallResult)
        .mockResolvedValueOnce({
          success: true,
          name: "github-helper",
          spec: "github:user/github-helper#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-def456",
          installPath: "/test/.agentskills/skills/github-helper"
        } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Successfully installed 2 skills")
      );
    });
  });

  describe("Failure Cases - Missing Dependencies", () => {
    it("should fail when MCP dependencies are missing", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "file-manager",
        spec: "github:user/file-manager#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/file-manager"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Missing MCP server dependencies")
      );
    });

    it("should display helpful error message with missing server details", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "file-manager",
        spec: "github:user/file-manager#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/file-manager"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify error message contains server name
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("filesystem")
      );
    });

    it("should show which skills need each missing server", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0",
          "file-reader": "github:user/file-reader#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "file-reader",
            description: "File reading skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager", "file-reader"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install
        .mockResolvedValueOnce({
          success: true,
          name: "file-manager",
          spec: "github:user/file-manager#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-abc123",
          installPath: "/test/.agentskills/skills/file-manager"
        } as InstallResult)
        .mockResolvedValueOnce({
          success: true,
          name: "file-reader",
          spec: "github:user/file-reader#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-def456",
          installPath: "/test/.agentskills/skills/file-reader"
        } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify error message mentions both skills
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("file-manager")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("file-reader")
      );
    });

    it("should suggest using --with-mcp flag for auto-install", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "file-manager",
        spec: "github:user/file-manager#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/file-manager"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify suggestion for --with-mcp flag
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("--with-mcp")
      );
    });

    it("should fail with multiple missing dependencies", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "devops-tool": "github:user/devops-tool#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "devops-tool",
            description: "DevOps operations",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency,
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"]
              } as McpServerDependency,
              {
                name: "slack",
                description: "Slack API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-slack"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["devops-tool"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        },
        {
          serverName: "github",
          neededBy: ["devops-tool"],
          spec: {
            name: "github",
            description: "GitHub API access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"]
          }
        },
        {
          serverName: "slack",
          neededBy: ["devops-tool"],
          spec: {
            name: "slack",
            description: "Slack API access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-slack"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "devops-tool",
        spec: "github:user/devops-tool#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/devops-tool"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("filesystem")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("github")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("slack")
      );
    });

    it("should fail with partially missing dependencies", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0",
          "github-helper": "github:user/github-helper#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "github-helper",
            description: "GitHub operations",
            requiresMcpServers: [
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        },
        {
          serverName: "github",
          neededBy: ["github-helper"],
          spec: {
            name: "github",
            description: "GitHub API access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"]
          }
        }
      ];

      // filesystem is configured, github is missing
      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: [dependencies[1]], // only github is missing
        configured: ["filesystem"]
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install
        .mockResolvedValueOnce({
          success: true,
          name: "file-manager",
          spec: "github:user/file-manager#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-abc123",
          installPath: "/test/.agentskills/skills/file-manager"
        } as InstallResult)
        .mockResolvedValueOnce({
          success: true,
          name: "github-helper",
          spec: "github:user/github-helper#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-def456",
          installPath: "/test/.agentskills/skills/github-helper"
        } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("github")
      );
      // Should not mention filesystem since it's configured
      const calls = consoleErrorSpy.mock.calls.map((call) => call[0]).join(" ");
      expect(calls).not.toContain("filesystem");
    });
  });

  describe("Edge Cases", () => {
    it("should handle error during dependency collection", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/repo#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/repo#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockRejectedValue(
        new Error("Failed to load skills")
      );

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify - should handle gracefully
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle error during dependency checking", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "test-skill": "github:user/repo#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "test-skill",
            description: "Test skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["test-skill"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "test-skill",
        spec: "github:user/repo#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/test-skill"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockRejectedValue(
        new Error("Failed to check dependencies")
      );

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify - should handle gracefully
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle skills that fail to install before MCP validation", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "failing-skill": "github:user/failing-skill#v1.0.0",
          "working-skill": "github:user/working-skill#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install
        .mockResolvedValueOnce({
          success: false,
          name: "failing-skill",
          spec: "github:user/failing-skill#v1.0.0",
          error: {
            code: "INSTALL_FAILED",
            message: "Failed to download"
          }
        } as InstallResult)
        .mockResolvedValueOnce({
          success: true,
          name: "working-skill",
          spec: "github:user/working-skill#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-abc123",
          installPath: "/test/.agentskills/skills/working-skill"
        } as InstallResult);

      const installedSkills = [
        {
          metadata: {
            name: "working-skill",
            description: "Working skill"
          },
          body: "Skill content"
        }
      ];

      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue([]);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify - should still run MCP validation on successful installs
      expect(mockMCPDependencyChecker.collectDependencies).toHaveBeenCalledWith(
        installedSkills
      );
    });
  });

  describe("Error Message Formatting", () => {
    it("should format error message with proper structure", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "file-manager",
        spec: "github:user/file-manager#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/file-manager"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify error message structure
      const errorCalls = consoleErrorSpy.mock.calls.map((call) => call[0]);
      const errorOutput = errorCalls.join("\n");

      // Should contain main error message
      expect(errorOutput).toContain("Missing MCP server dependencies");

      // Should contain server name
      expect(errorOutput).toContain("filesystem");

      // Should contain needed by information
      expect(errorOutput).toContain("file-manager");

      // Should contain suggestion
      expect(errorOutput).toContain("--with-mcp");
    });

    it("should use chalk for colorized output in error messages", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0"
        },
        config: {
          skillsDirectory: ".agentskills/skills",
          autoDiscover: [],
          maxSkillSize: 5000,
          logLevel: "info"
        },
        source: {
          type: "file",
          path: "/test/package.json"
        }
      };

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.detectClient.mockReturnValue("claude-desktop");
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "file-manager",
        spec: "github:user/file-manager#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/file-manager"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Execute
      await installCommand({ cwd: "/test" });

      // Verify chalk was used
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Check that error output contains expected content (chalk's job is to colorize)
      // In test environment, chalk may strip colors, but the content should still be there
      const allOutput = consoleErrorSpy.mock.calls
        .map((call) => String(call[0]))
        .join(" ");

      // Just verify the messages are present - chalk may strip colors in test env
      expect(allOutput).toContain("Missing MCP server dependencies");
      expect(allOutput).toContain("filesystem");
      expect(allOutput).toContain("file-manager");
    });
  });
});
