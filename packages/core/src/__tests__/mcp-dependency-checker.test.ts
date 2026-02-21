import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  Skill,
  McpServerDependency,
  McpDependencyInfo,
  McpClientType
} from "../types.js";
import { MCPDependencyChecker } from "../mcp-dependency-checker.js";
import { MCPConfigManager } from "../mcp-config-manager.js";

// Mock MCPConfigManager
vi.mock("../mcp-config-manager.js", () => {
  return {
    MCPConfigManager: vi.fn().mockImplementation(() => ({
      isServerConfigured: vi.fn()
    }))
  };
});

describe("MCPDependencyChecker", () => {
  let checker: MCPDependencyChecker;
  let mockConfigManager: MCPConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    checker = new MCPDependencyChecker();
    mockConfigManager = new MCPConfigManager();
  });

  describe("collectDependencies", () => {
    it("should return empty array when given 0 skills", () => {
      const result = checker.collectDependencies([]);

      expect(result).toEqual([]);
    });

    it("should return empty array when skills have no MCP dependencies", () => {
      const skills: Skill[] = [
        {
          metadata: {
            name: "skill1",
            description: "Test skill 1"
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "skill2",
            description: "Test skill 2"
          },
          body: "Skill content"
        }
      ];

      const result = checker.collectDependencies(skills);

      expect(result).toEqual([]);
    });

    it("should collect MCP dependencies from a single skill", () => {
      const mcpDep: McpServerDependency = {
        name: "filesystem",
        description: "File system access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      };

      const skills: Skill[] = [
        {
          metadata: {
            name: "file-manager",
            description: "Manages files",
            requiresMcpServers: [mcpDep]
          },
          body: "Skill content"
        }
      ];

      const result = checker.collectDependencies(skills);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        serverName: "filesystem",
        neededBy: ["file-manager"],
        spec: mcpDep
      });
    });

    it("should collect MCP dependencies from multiple skills", () => {
      const filesystemDep: McpServerDependency = {
        name: "filesystem",
        description: "File system access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      };

      const githubDep: McpServerDependency = {
        name: "github",
        description: "GitHub API access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          GITHUB_TOKEN: "${GITHUB_TOKEN}"
        }
      };

      const skills: Skill[] = [
        {
          metadata: {
            name: "file-manager",
            description: "Manages files",
            requiresMcpServers: [filesystemDep]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "github-helper",
            description: "GitHub operations",
            requiresMcpServers: [githubDep]
          },
          body: "Skill content"
        }
      ];

      const result = checker.collectDependencies(skills);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        serverName: "filesystem",
        neededBy: ["file-manager"],
        spec: filesystemDep
      });
      expect(result[1]).toEqual({
        serverName: "github",
        neededBy: ["github-helper"],
        spec: githubDep
      });
    });

    it("should merge neededBy when multiple skills require the same server", () => {
      const filesystemDep: McpServerDependency = {
        name: "filesystem",
        description: "File system access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      };

      const skills: Skill[] = [
        {
          metadata: {
            name: "file-manager",
            description: "Manages files",
            requiresMcpServers: [filesystemDep]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "file-reader",
            description: "Reads files",
            requiresMcpServers: [filesystemDep]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "file-writer",
            description: "Writes files",
            requiresMcpServers: [filesystemDep]
          },
          body: "Skill content"
        }
      ];

      const result = checker.collectDependencies(skills);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        serverName: "filesystem",
        neededBy: ["file-manager", "file-reader", "file-writer"],
        spec: filesystemDep
      });
    });

    it("should handle skills with multiple MCP dependencies", () => {
      const filesystemDep: McpServerDependency = {
        name: "filesystem",
        description: "File system access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      };

      const githubDep: McpServerDependency = {
        name: "github",
        description: "GitHub API access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"]
      };

      const skills: Skill[] = [
        {
          metadata: {
            name: "devops-helper",
            description: "DevOps operations",
            requiresMcpServers: [filesystemDep, githubDep]
          },
          body: "Skill content"
        }
      ];

      const result = checker.collectDependencies(skills);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        serverName: "filesystem",
        neededBy: ["devops-helper"],
        spec: filesystemDep
      });
      expect(result[1]).toEqual({
        serverName: "github",
        neededBy: ["devops-helper"],
        spec: githubDep
      });
    });

    it("should handle duplicate server names with different specs by merging neededBy", () => {
      // Different specs for the same server name (edge case)
      const filesystemDep1: McpServerDependency = {
        name: "filesystem",
        description: "File system access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      };

      const filesystemDep2: McpServerDependency = {
        name: "filesystem",
        description: "File system access (different config)",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/home"]
      };

      const skills: Skill[] = [
        {
          metadata: {
            name: "skill1",
            description: "Skill 1",
            requiresMcpServers: [filesystemDep1]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "skill2",
            description: "Skill 2",
            requiresMcpServers: [filesystemDep2]
          },
          body: "Skill content"
        }
      ];

      const result = checker.collectDependencies(skills);

      expect(result).toHaveLength(1);
      expect(result[0].serverName).toBe("filesystem");
      expect(result[0].neededBy).toEqual(["skill1", "skill2"]);
      // Should use the first spec encountered
      expect(result[0].spec).toEqual(filesystemDep1);
    });

    it("should handle mix of skills with and without MCP dependencies", () => {
      const filesystemDep: McpServerDependency = {
        name: "filesystem",
        description: "File system access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      };

      const skills: Skill[] = [
        {
          metadata: {
            name: "skill1",
            description: "No dependencies"
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "skill2",
            description: "Has dependencies",
            requiresMcpServers: [filesystemDep]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "skill3",
            description: "No dependencies"
          },
          body: "Skill content"
        }
      ];

      const result = checker.collectDependencies(skills);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        serverName: "filesystem",
        neededBy: ["skill2"],
        spec: filesystemDep
      });
    });
  });

  describe("checkDependencies", () => {
    it("should return all configured when all servers are configured", async () => {
      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["skill1"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        },
        {
          serverName: "github",
          neededBy: ["skill2"],
          spec: {
            name: "github",
            description: "GitHub API access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"]
          }
        }
      ];

      const clientType: McpClientType = "claude-desktop";

      // Mock all servers as configured
      vi.mocked(mockConfigManager.isServerConfigured)
        .mockResolvedValueOnce(true) // filesystem
        .mockResolvedValueOnce(true); // github

      const result = await checker.checkDependencies(
        clientType,
        dependencies,
        mockConfigManager
      );

      expect(result.allConfigured).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.configured).toEqual(["filesystem", "github"]);
    });

    it("should return missing servers when some are not configured", async () => {
      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["skill1"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        },
        {
          serverName: "github",
          neededBy: ["skill2"],
          spec: {
            name: "github",
            description: "GitHub API access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"]
          }
        }
      ];

      const clientType: McpClientType = "claude-desktop";

      // Mock filesystem configured, github not configured
      vi.mocked(mockConfigManager.isServerConfigured)
        .mockResolvedValueOnce(true) // filesystem
        .mockResolvedValueOnce(false); // github

      const result = await checker.checkDependencies(
        clientType,
        dependencies,
        mockConfigManager
      );

      expect(result.allConfigured).toBe(false);
      expect(result.missing).toEqual([dependencies[1]]);
      expect(result.configured).toEqual(["filesystem"]);
    });

    it("should return all missing when no servers are configured", async () => {
      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["skill1"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        },
        {
          serverName: "github",
          neededBy: ["skill2"],
          spec: {
            name: "github",
            description: "GitHub API access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"]
          }
        }
      ];

      const clientType: McpClientType = "claude-desktop";

      // Mock all servers as not configured
      vi.mocked(mockConfigManager.isServerConfigured)
        .mockResolvedValueOnce(false) // filesystem
        .mockResolvedValueOnce(false); // github

      const result = await checker.checkDependencies(
        clientType,
        dependencies,
        mockConfigManager
      );

      expect(result.allConfigured).toBe(false);
      expect(result.missing).toEqual(dependencies);
      expect(result.configured).toEqual([]);
    });

    it("should return empty result when checking empty dependencies", async () => {
      const clientType: McpClientType = "claude-desktop";

      const result = await checker.checkDependencies(
        clientType,
        [],
        mockConfigManager
      );

      expect(result.allConfigured).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.configured).toEqual([]);
    });

    it("should handle config file that does not exist", async () => {
      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["skill1"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const clientType: McpClientType = "claude-desktop";

      // Mock isServerConfigured to return false (config doesn't exist)
      vi.mocked(mockConfigManager.isServerConfigured).mockResolvedValueOnce(
        false
      );

      const result = await checker.checkDependencies(
        clientType,
        dependencies,
        mockConfigManager
      );

      expect(result.allConfigured).toBe(false);
      expect(result.missing).toEqual(dependencies);
      expect(result.configured).toEqual([]);
    });

    it("should work with different MCP client types", async () => {
      const dependencies: McpDependencyInfo[] = [
        {
          serverName: "filesystem",
          neededBy: ["skill1"],
          spec: {
            name: "filesystem",
            description: "File system access",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      ];

      const clientTypes: McpClientType[] = [
        "claude-desktop",
        "cline",
        "continue",
        "cursor",
        "junie"
      ];

      for (const clientType of clientTypes) {
        vi.mocked(mockConfigManager.isServerConfigured).mockResolvedValueOnce(
          true
        );

        const result = await checker.checkDependencies(
          clientType,
          dependencies,
          mockConfigManager
        );

        expect(result.allConfigured).toBe(true);
        expect(result.configured).toEqual(["filesystem"]);

        expect(mockConfigManager.isServerConfigured).toHaveBeenCalledWith(
          clientType,
          "filesystem"
        );
      }
    });
  });

  describe("Integration: Full flow", () => {
    it("should collect and check dependencies from skills to result", async () => {
      // Step 1: Create skills with various dependencies
      const filesystemDep: McpServerDependency = {
        name: "filesystem",
        description: "File system access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      };

      const githubDep: McpServerDependency = {
        name: "github",
        description: "GitHub API access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          GITHUB_TOKEN: "${GITHUB_TOKEN}"
        }
      };

      const slackDep: McpServerDependency = {
        name: "slack",
        description: "Slack API access",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-slack"],
        env: {
          SLACK_TOKEN: "${SLACK_TOKEN}"
        }
      };

      const skills: Skill[] = [
        {
          metadata: {
            name: "file-manager",
            description: "Manages files",
            requiresMcpServers: [filesystemDep]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "github-helper",
            description: "GitHub operations",
            requiresMcpServers: [githubDep]
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "devops-tool",
            description: "DevOps operations",
            requiresMcpServers: [filesystemDep, slackDep] // Uses filesystem AND slack
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "simple-skill",
            description: "No dependencies"
          },
          body: "Skill content"
        }
      ];

      // Step 2: Collect dependencies
      const dependencies = checker.collectDependencies(skills);

      expect(dependencies).toHaveLength(3);
      expect(dependencies[0].serverName).toBe("filesystem");
      expect(dependencies[0].neededBy).toEqual(["file-manager", "devops-tool"]);
      expect(dependencies[1].serverName).toBe("github");
      expect(dependencies[1].neededBy).toEqual(["github-helper"]);
      expect(dependencies[2].serverName).toBe("slack");
      expect(dependencies[2].neededBy).toEqual(["devops-tool"]);

      // Step 3: Check dependencies
      // Simulate: filesystem configured, github not configured, slack configured
      const clientType: McpClientType = "claude-desktop";

      vi.mocked(mockConfigManager.isServerConfigured)
        .mockResolvedValueOnce(true) // filesystem
        .mockResolvedValueOnce(false) // github
        .mockResolvedValueOnce(true); // slack

      const result = await checker.checkDependencies(
        clientType,
        dependencies,
        mockConfigManager
      );

      // Step 4: Verify result
      expect(result.allConfigured).toBe(false);
      expect(result.configured).toEqual(["filesystem", "slack"]);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].serverName).toBe("github");
      expect(result.missing[0].neededBy).toEqual(["github-helper"]);
    });

    it("should handle empty skills list through full flow", async () => {
      const skills: Skill[] = [];

      // Collect dependencies
      const dependencies = checker.collectDependencies(skills);
      expect(dependencies).toEqual([]);

      // Check dependencies
      const clientType: McpClientType = "claude-desktop";
      const result = await checker.checkDependencies(
        clientType,
        dependencies,
        mockConfigManager
      );

      expect(result.allConfigured).toBe(true);
      expect(result.configured).toEqual([]);
      expect(result.missing).toEqual([]);
    });

    it("should handle all skills having no dependencies through full flow", async () => {
      const skills: Skill[] = [
        {
          metadata: {
            name: "skill1",
            description: "Simple skill"
          },
          body: "Skill content"
        },
        {
          metadata: {
            name: "skill2",
            description: "Another simple skill"
          },
          body: "Skill content"
        }
      ];

      // Collect dependencies
      const dependencies = checker.collectDependencies(skills);
      expect(dependencies).toEqual([]);

      // Check dependencies
      const clientType: McpClientType = "claude-desktop";
      const result = await checker.checkDependencies(
        clientType,
        dependencies,
        mockConfigManager
      );

      expect(result.allConfigured).toBe(true);
      expect(result.configured).toEqual([]);
      expect(result.missing).toEqual([]);
    });
  });
});
