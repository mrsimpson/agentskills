/**
 * Tests for CLI install command with --with-mcp flag
 *
 * TDD RED PHASE - Tests written before implementation
 * These tests define the expected behavior of automatic MCP server
 * installation and configuration via the --with-mcp flag.
 *
 * Task: agent-skills-2.3.18
 * Phase: TDD RED - Writing failing tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { installCommand } from "../commands/install.js";
import {
  PackageConfigManager,
  SkillInstaller,
  MCPConfigManager,
  MCPDependencyChecker,
  substituteParameters
} from "@codemcp/agentskills-core";
import type {
  PackageConfig,
  InstallResult,
  McpDependencyInfo,
  McpDependencyCheckResult,
  McpServerDependency,
  McpParameterSpec
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

// Mock inquirer for prompting
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
    MCPDependencyChecker: vi.fn(),
    substituteParameters: vi.fn()
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

describe("Install Command - --with-mcp Flag", () => {
  let mockConfigManager: any;
  let mockInstaller: any;
  let mockMCPConfigManager: any;
  let mockMCPDependencyChecker: any;
  let mockInquirer: any;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;

  beforeEach(async () => {
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
      isServerConfigured: vi.fn(),
      addServer: vi.fn()
    };

    mockMCPDependencyChecker = {
      collectDependencies: vi.fn(),
      checkDependencies: vi.fn()
    };

    // Get the mocked inquirer
    const inquirer = await import("inquirer");
    mockInquirer = inquirer.default;

    vi.mocked(PackageConfigManager).mockImplementation(() => mockConfigManager);
    vi.mocked(SkillInstaller).mockImplementation(() => mockInstaller);
    vi.mocked(MCPConfigManager).mockImplementation(() => mockMCPConfigManager);
    vi.mocked(MCPDependencyChecker).mockImplementation(
      () => mockMCPDependencyChecker
    );

    // Default substituteParameters to pass-through
    vi.mocked(substituteParameters).mockImplementation(
      (template: any, params: any) => {
        if (typeof template === "string") {
          let result = template;
          for (const [key, value] of Object.entries(params)) {
            result = result.replace(
              new RegExp(`{{${key}}}`, "g"),
              String(value)
            );
          }
          return result;
        }
        if (Array.isArray(template)) {
          return template.map((item) =>
            typeof item === "string"
              ? Object.entries(params).reduce(
                  (str, [key, value]) =>
                    str.replace(new RegExp(`{{${key}}}`, "g"), String(value)),
                  item
                )
              : item
          );
        }
        if (typeof template === "object" && template !== null) {
          const result: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(template)) {
            // Recursively substitute parameters in object values
            if (typeof value === "string") {
              let substituted = value;
              for (const [paramKey, paramValue] of Object.entries(params)) {
                substituted = substituted.replace(
                  new RegExp(`{{${paramKey}}}`, "g"),
                  String(paramValue)
                );
              }
              result[key] = substituted;
            } else {
              result[key] = value;
            }
          }
          return result;
        }
        return template;
      }
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

  describe("--with-mcp flag with no missing dependencies", () => {
    it("should succeed when all MCP dependencies are already configured", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
            args: [
              "-y",
              "@modelcontextprotocol/server-filesystem",
              "{{ROOT_PATH}}"
            ],
            parameters: {
              ROOT_PATH: {
                description: "Root directory for file operations",
                required: true,
                default: "/tmp"
              } as McpParameterSpec
            }
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: ["filesystem"]
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.isServerConfigured.mockResolvedValue(true); // agentskills already configured
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

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify
      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(mockInquirer.prompt).not.toHaveBeenCalled(); // No prompting needed
      expect(mockMCPConfigManager.addServer).not.toHaveBeenCalled(); // All servers already configured
    });

    it("should succeed when no MCP dependencies are required", async () => {
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
      mockMCPConfigManager.isServerConfigured.mockResolvedValue(true); // agentskills already configured
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

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify
      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(mockInquirer.prompt).not.toHaveBeenCalled();
      expect(mockMCPConfigManager.addServer).not.toHaveBeenCalled(); // agentskills already configured
    });
  });

  describe("--with-mcp flag with missing dependencies", () => {
    it("should prompt for required parameters when dependencies are missing", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
            args: [
              "-y",
              "@modelcontextprotocol/server-filesystem",
              "{{ROOT_PATH}}"
            ],
            parameters: {
              ROOT_PATH: {
                description: "Root directory for file operations",
                required: true,
                default: "/tmp"
              } as McpParameterSpec
            }
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
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

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ ROOT_PATH: "/home/user/files" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify prompting occurred
      expect(mockInquirer.prompt).toHaveBeenCalled();
      expect(mockMCPConfigManager.addServer).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should display parameter description in prompt", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
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
            name: "github-helper",
            description: "GitHub operations",
            requiresMcpServers: [
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: {
                  GITHUB_TOKEN: "{{API_TOKEN}}"
                },
                parameters: {
                  API_TOKEN: {
                    description: "GitHub personal access token with repo scope",
                    required: true,
                    sensitive: true,
                    example: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  } as McpParameterSpec
                }
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "github",
          neededBy: ["github-helper"],
          spec: {
            name: "github",
            description: "GitHub API access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            env: {
              GITHUB_TOKEN: "{{API_TOKEN}}"
            },
            parameters: {
              API_TOKEN: {
                description: "GitHub personal access token with repo scope",
                required: true,
                sensitive: true,
                example: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              } as McpParameterSpec
            }
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "github-helper",
        spec: "github:user/github-helper#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/github-helper"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ API_TOKEN: "ghp_secret_token" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify prompt contains description
      expect(mockInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining(
              "GitHub personal access token with repo scope"
            )
          })
        ])
      );
    });

    it("should show default value in prompt", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
            args: [
              "-y",
              "@modelcontextprotocol/server-filesystem",
              "{{ROOT_PATH}}"
            ],
            parameters: {
              ROOT_PATH: {
                description: "Root directory for file operations",
                required: true,
                default: "/tmp"
              } as McpParameterSpec
            }
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
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

      // Mock user accepts default
      mockInquirer.prompt.mockResolvedValue({ ROOT_PATH: "/tmp" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify prompt shows default
      expect(mockInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            default: "/tmp"
          })
        ])
      );
    });
  });

  describe("Parameter substitution", () => {
    it("should substitute parameters in args with user values", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
            args: [
              "-y",
              "@modelcontextprotocol/server-filesystem",
              "{{ROOT_PATH}}"
            ],
            parameters: {
              ROOT_PATH: {
                description: "Root directory for file operations",
                required: true,
                default: "/tmp"
              } as McpParameterSpec
            }
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
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

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ ROOT_PATH: "/home/user/files" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify substituteParameters was called with user values
      expect(substituteParameters).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ ROOT_PATH: "/home/user/files" })
      );
    });

    it("should substitute parameters in env with user values", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
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
            name: "github-helper",
            description: "GitHub operations",
            requiresMcpServers: [
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: {
                  GITHUB_TOKEN: "{{API_TOKEN}}"
                },
                parameters: {
                  API_TOKEN: {
                    description: "GitHub personal access token",
                    required: true,
                    sensitive: true
                  } as McpParameterSpec
                }
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "github",
          neededBy: ["github-helper"],
          spec: {
            name: "github",
            description: "GitHub API access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            env: {
              GITHUB_TOKEN: "{{API_TOKEN}}"
            },
            parameters: {
              API_TOKEN: {
                description: "GitHub personal access token",
                required: true,
                sensitive: true
              } as McpParameterSpec
            }
          }
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "github-helper",
        spec: "github:user/github-helper#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/github-helper"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ API_TOKEN: "ghp_secret_token" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify substituteParameters was called for env vars
      expect(substituteParameters).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ API_TOKEN: "ghp_secret_token" })
      );
    });

    it("should substitute multiple parameters in complex configuration", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "database-tool": "github:user/database-tool#v1.0.0"
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
            name: "database-tool",
            description: "Database operations",
            requiresMcpServers: [
              {
                name: "postgres",
                description: "PostgreSQL database access",
                command: "npx",
                args: [
                  "-y",
                  "@modelcontextprotocol/server-postgres",
                  "--host",
                  "{{DB_HOST}}",
                  "--port",
                  "{{DB_PORT}}"
                ],
                env: {
                  POSTGRES_USER: "{{DB_USER}}",
                  POSTGRES_PASSWORD: "{{DB_PASSWORD}}"
                },
                parameters: {
                  DB_HOST: {
                    description: "Database host",
                    required: true,
                    default: "localhost"
                  } as McpParameterSpec,
                  DB_PORT: {
                    description: "Database port",
                    required: true,
                    default: "5432"
                  } as McpParameterSpec,
                  DB_USER: {
                    description: "Database user",
                    required: true,
                    default: "postgres"
                  } as McpParameterSpec,
                  DB_PASSWORD: {
                    description: "Database password",
                    required: true,
                    sensitive: true
                  } as McpParameterSpec
                }
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "postgres",
          neededBy: ["database-tool"],
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "database-tool",
        spec: "github:user/database-tool#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/database-tool"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user input for all parameters
      mockInquirer.prompt.mockResolvedValue({
        DB_HOST: "db.example.com",
        DB_PORT: "5433",
        DB_USER: "admin",
        DB_PASSWORD: "secret123"
      });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify all parameters were substituted
      expect(substituteParameters).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          DB_HOST: "db.example.com",
          DB_PORT: "5433",
          DB_USER: "admin",
          DB_PASSWORD: "secret123"
        })
      );
    });
  });

  describe("Adding servers to MCP config", () => {
    it("should add server to MCP config after prompting", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
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

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ ROOT_PATH: "/home/user/files" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify addServer was called with substituted config
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "filesystem",
        expect.objectContaining({
          command: "npx",
          args: expect.arrayContaining([
            "-y",
            "@modelcontextprotocol/server-filesystem",
            "/home/user/files"
          ])
        }),
        "/test"
      );
    });

    it("should add server with env vars to MCP config", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
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
            name: "github-helper",
            description: "GitHub operations",
            requiresMcpServers: [
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: {
                  GITHUB_TOKEN: "{{API_TOKEN}}"
                },
                parameters: {
                  API_TOKEN: {
                    description: "GitHub personal access token",
                    required: true,
                    sensitive: true
                  } as McpParameterSpec
                }
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "github",
          neededBy: ["github-helper"],
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "github-helper",
        spec: "github:user/github-helper#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/github-helper"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ API_TOKEN: "ghp_secret_token" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify addServer was called with env vars
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "github",
        expect.objectContaining({
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: expect.objectContaining({
            GITHUB_TOKEN: "ghp_secret_token"
          })
        }),
        "/test"
      );
    });
  });

  describe("Skip already configured servers", () => {
    it("should skip prompting for servers that are already configured", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      // Filesystem is already configured
      const checkResult: McpDependencyCheckResult = {
        allConfigured: true,
        missing: [],
        configured: ["filesystem"]
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.isServerConfigured.mockResolvedValue(true); // agentskills already configured
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

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify no prompting occurred since server is already configured
      // and agentskills server is already configured too
      expect(mockInquirer.prompt).not.toHaveBeenCalled();
      expect(mockMCPConfigManager.addServer).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should only prompt for missing servers when some are configured", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
              } as McpServerDependency,
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: {
                  GITHUB_TOKEN: "{{API_TOKEN}}"
                },
                parameters: {
                  API_TOKEN: {
                    description: "GitHub token",
                    required: true,
                    sensitive: true
                  } as McpParameterSpec
                }
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const allDependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["devops-tool"],
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        },
        {
          serverName: "github",
          neededBy: ["devops-tool"],
          spec: installedSkills[0].metadata.requiresMcpServers![1]
        }
      ];

      // filesystem is configured, github is missing
      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: [allDependencies[1]], // only github is missing
        configured: ["filesystem"]
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.isServerConfigured.mockResolvedValue(false); // agentskills NOT configured
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
        allDependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user input for github only
      mockInquirer.prompt.mockResolvedValue({ API_TOKEN: "ghp_token" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify only github prompted (not filesystem)
      expect(mockInquirer.prompt).toHaveBeenCalledTimes(1);
      // addServer called twice: once for github, once for agentskills
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledTimes(2);
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "github",
        expect.any(Object),
        "/test"
      );
    });
  });

  describe("Handle multiple missing servers", () => {
    it("should prompt for each missing server sequentially", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
              } as McpServerDependency,
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: {
                  GITHUB_TOKEN: "{{API_TOKEN}}"
                },
                parameters: {
                  API_TOKEN: {
                    description: "GitHub token",
                    required: true,
                    sensitive: true
                  } as McpParameterSpec
                }
              } as McpServerDependency,
              {
                name: "slack",
                description: "Slack API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-slack"],
                env: {
                  SLACK_TOKEN: "{{SLACK_TOKEN}}"
                },
                parameters: {
                  SLACK_TOKEN: {
                    description: "Slack bot token",
                    required: true,
                    sensitive: true
                  } as McpParameterSpec
                }
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
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        },
        {
          serverName: "github",
          neededBy: ["devops-tool"],
          spec: installedSkills[0].metadata.requiresMcpServers![1]
        },
        {
          serverName: "slack",
          neededBy: ["devops-tool"],
          spec: installedSkills[0].metadata.requiresMcpServers![2]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.isServerConfigured.mockResolvedValue(false); // agentskills NOT configured
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

      // Mock user input for each server
      mockInquirer.prompt
        .mockResolvedValueOnce({ ROOT_PATH: "/home/user" })
        .mockResolvedValueOnce({ API_TOKEN: "ghp_token" })
        .mockResolvedValueOnce({ SLACK_TOKEN: "xoxb-token" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify prompts for all three dependency servers
      expect(mockInquirer.prompt).toHaveBeenCalledTimes(3);
      // addServer called 4 times: 3 dependency servers + agentskills
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledTimes(4);
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "filesystem",
        expect.any(Object),
        "/test"
      );
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "github",
        expect.any(Object),
        "/test"
      );
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "slack",
        expect.any(Object),
        "/test"
      );
    });

    it("should add all missing servers to config", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "multi-tool": "github:user/multi-tool#v1.0.0"
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
            name: "multi-tool",
            description: "Multi-server tool",
            requiresMcpServers: [
              {
                name: "filesystem",
                description: "File system access",
                command: "npx",
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
              } as McpServerDependency,
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: {
                  GITHUB_TOKEN: "{{API_TOKEN}}"
                },
                parameters: {
                  API_TOKEN: {
                    description: "GitHub token",
                    required: true,
                    sensitive: true
                  } as McpParameterSpec
                }
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["multi-tool"],
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        },
        {
          serverName: "github",
          neededBy: ["multi-tool"],
          spec: installedSkills[0].metadata.requiresMcpServers![1]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.isServerConfigured.mockResolvedValue(false); // agentskills NOT configured
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "multi-tool",
        spec: "github:user/multi-tool#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/multi-tool"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user input
      mockInquirer.prompt
        .mockResolvedValueOnce({ ROOT_PATH: "/home/user" })
        .mockResolvedValueOnce({ API_TOKEN: "ghp_token" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify both dependency servers + agentskills server were added
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledTimes(3);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("Handle user cancellation", () => {
    it("should handle Ctrl+C gracefully during prompting", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
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

      // Simulate user cancellation (Ctrl+C)
      mockInquirer.prompt.mockRejectedValue(new Error("User cancelled"));

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify graceful handling
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should show helpful message on cancellation", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory",
                    required: true,
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
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

      // Simulate user cancellation
      mockInquirer.prompt.mockRejectedValue(new Error("User cancelled"));

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify helpful message
      const errorCalls = consoleErrorSpy.mock.calls
        .map((call) => call[0])
        .join(" ");
      expect(errorCalls).toContain("cancelled");
    });
  });

  describe("Parameter validation", () => {
    it("should handle required parameters", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true, // Required parameter
                    default: "/tmp"
                  } as McpParameterSpec
                }
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
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
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

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ ROOT_PATH: "/home/user/files" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify required parameter was prompted
      expect(mockInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: "ROOT_PATH",
            type: "input"
          })
        ])
      );
    });

    it("should handle optional parameters with defaults", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "web-server": "github:user/web-server#v1.0.0"
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
            name: "web-server",
            description: "Web server skill",
            requiresMcpServers: [
              {
                name: "http",
                description: "HTTP server",
                command: "npx",
                args: [
                  "-y",
                  "@modelcontextprotocol/server-http",
                  "--port",
                  "{{PORT}}"
                ],
                parameters: {
                  PORT: {
                    description: "Server port",
                    required: false, // Optional parameter
                    default: "8080"
                  } as McpParameterSpec
                }
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "http",
          neededBy: ["web-server"],
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "web-server",
        spec: "github:user/web-server#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/web-server"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user accepts default
      mockInquirer.prompt.mockResolvedValue({ PORT: "8080" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify optional parameter has default
      expect(mockInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: "PORT",
            default: "8080"
          })
        ])
      );
    });

    it("should mark sensitive parameters appropriately", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
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
            name: "github-helper",
            description: "GitHub operations",
            requiresMcpServers: [
              {
                name: "github",
                description: "GitHub API access",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: {
                  GITHUB_TOKEN: "{{API_TOKEN}}"
                },
                parameters: {
                  API_TOKEN: {
                    description: "GitHub personal access token",
                    required: true,
                    sensitive: true // Sensitive parameter (password)
                  } as McpParameterSpec
                }
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "github",
          neededBy: ["github-helper"],
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "github-helper",
        spec: "github:user/github-helper#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/github-helper"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ API_TOKEN: "ghp_secret_token" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify sensitive parameter uses password type
      expect(mockInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: "API_TOKEN",
            type: "password"
          })
        ])
      );
    });
  });

  describe("Environment variable defaults", () => {
    it("should support {{ENV:VAR}} syntax in defaults", async () => {
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
                args: [
                  "-y",
                  "@modelcontextprotocol/server-filesystem",
                  "{{ROOT_PATH}}"
                ],
                parameters: {
                  ROOT_PATH: {
                    description: "Root directory for file operations",
                    required: true,
                    default: "{{ENV:HOME}}" // Use environment variable
                  } as McpParameterSpec
                }
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
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
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

      // Set environment variable
      process.env.HOME = "/home/testuser";

      // Mock user accepts env default
      mockInquirer.prompt.mockResolvedValue({ ROOT_PATH: "/home/testuser" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify env var was resolved in default
      expect(mockInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            default: "/home/testuser"
          })
        ])
      );

      // Cleanup
      delete process.env.HOME;
    });

    it("should handle missing environment variables gracefully", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "api-tool": "github:user/api-tool#v1.0.0"
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
            name: "api-tool",
            description: "API tool",
            requiresMcpServers: [
              {
                name: "api",
                description: "API server",
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-api"],
                env: {
                  API_KEY: "{{API_KEY}}"
                },
                parameters: {
                  API_KEY: {
                    description: "API key",
                    required: true,
                    sensitive: true,
                    default: "{{ENV:NONEXISTENT_VAR}}" // Missing env var
                  } as McpParameterSpec
                }
              } as McpServerDependency
            ]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "api",
          neededBy: ["api-tool"],
          spec: installedSkills[0].metadata.requiresMcpServers![0]
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockInstaller.install.mockResolvedValue({
        success: true,
        name: "api-tool",
        spec: "github:user/api-tool#v1.0.0",
        resolvedVersion: "1.0.0",
        integrity: "sha512-abc123",
        installPath: "/test/.agentskills/skills/api-tool"
      } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user provides value
      mockInquirer.prompt.mockResolvedValue({ API_KEY: "user-provided-key" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify graceful handling (no default or warning about missing env var)
      expect(mockInquirer.prompt).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("Multiple skills needing same server", () => {
    it("should only prompt once for server needed by multiple skills", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "file-manager": "github:user/file-manager#v1.0.0",
          "file-reader": "github:user/file-reader#v1.0.0",
          "file-writer": "github:user/file-writer#v1.0.0"
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

      const fileServerSpec = {
        name: "filesystem",
        description: "File system access",
        command: "npx",
        args: [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "{{ROOT_PATH}}"
        ],
        parameters: {
          ROOT_PATH: {
            description: "Root directory for file operations",
            required: true,
            default: "/tmp"
          } as McpParameterSpec
        }
      } as McpServerDependency;

      const installedSkills = [
        {
          metadata: {
            name: "file-manager",
            description: "File management skill",
            requiresMcpServers: [fileServerSpec]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "file-reader",
            description: "File reading skill",
            requiresMcpServers: [fileServerSpec]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "file-writer",
            description: "File writing skill",
            requiresMcpServers: [fileServerSpec]
          },
          body: "Skill content"
        }
      ];

      // All three skills need the same filesystem server
      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["file-manager", "file-reader", "file-writer"],
          spec: fileServerSpec
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockMCPConfigManager.isServerConfigured.mockResolvedValue(false); // agentskills NOT configured
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
        } as InstallResult)
        .mockResolvedValueOnce({
          success: true,
          name: "file-writer",
          spec: "github:user/file-writer#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-ghi789",
          installPath: "/test/.agentskills/skills/file-writer"
        } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ ROOT_PATH: "/home/user/files" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify prompted only ONCE despite three skills needing it
      expect(mockInquirer.prompt).toHaveBeenCalledTimes(1);
      // addServer called twice: once for filesystem, once for agentskills
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledTimes(2);
      expect(mockMCPConfigManager.addServer).toHaveBeenCalledWith(
        "claude-desktop",
        "filesystem",
        expect.any(Object),
        "/test"
      );
    });

    it("should show all dependent skills in prompt message", async () => {
      // Setup
      const config: PackageConfig = {
        skills: {
          "skill-a": "github:user/skill-a#v1.0.0",
          "skill-b": "github:user/skill-b#v1.0.0"
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

      const githubSpec = {
        name: "github",
        description: "GitHub API access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          GITHUB_TOKEN: "{{API_TOKEN}}"
        },
        parameters: {
          API_TOKEN: {
            description: "GitHub personal access token",
            required: true,
            sensitive: true
          } as McpParameterSpec
        }
      } as McpServerDependency;

      const installedSkills = [
        {
          metadata: {
            name: "skill-a",
            description: "Skill A",
            requiresMcpServers: [githubSpec]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "skill-b",
            description: "Skill B",
            requiresMcpServers: [githubSpec]
          },
          body: "Skill content"
        }
      ];

      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "github",
          neededBy: ["skill-a", "skill-b"],
          spec: githubSpec
        }
      ];

      const checkResult: McpDependencyCheckResult = {
        allConfigured: false,
        missing: dependencies,
        configured: []
      };

      mockConfigManager.loadConfig.mockResolvedValue(config);
      mockInstaller.install
        .mockResolvedValueOnce({
          success: true,
          name: "skill-a",
          spec: "github:user/skill-a#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-abc123",
          installPath: "/test/.agentskills/skills/skill-a"
        } as InstallResult)
        .mockResolvedValueOnce({
          success: true,
          name: "skill-b",
          spec: "github:user/skill-b#v1.0.0",
          resolvedVersion: "1.0.0",
          integrity: "sha512-def456",
          installPath: "/test/.agentskills/skills/skill-b"
        } as InstallResult);
      mockInstaller.loadInstalledSkills.mockResolvedValue(installedSkills);
      mockMCPDependencyChecker.collectDependencies.mockReturnValue(
        dependencies
      );
      mockMCPDependencyChecker.checkDependencies.mockResolvedValue(checkResult);

      // Mock user input
      mockInquirer.prompt.mockResolvedValue({ API_TOKEN: "ghp_token" });

      // Execute with --with-mcp flag
      await installCommand({ cwd: "/test", withMcp: true, agent: "claude" });

      // Verify prompt mentions both skills
      // Note: Implementation should show "needed by: skill-a, skill-b"
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("skill-a")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("skill-b")
      );
    });
  });
});
