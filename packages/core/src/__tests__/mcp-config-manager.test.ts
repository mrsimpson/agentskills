import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { McpClientType } from "../types.js";

import { MCPConfigManager } from "../mcp-config-manager.js";

describe("MCPConfigManager", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `mcp-config-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe("getConfigPath", () => {
    describe("project-relative paths", () => {
      it("should return project-relative path for claude-desktop", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("claude-desktop", tempDir);
        expect(path).toBe(join(tempDir, ".claude/mcp_settings.json"));
      });

      it("should return project-relative path for cline", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("cline", tempDir);
        expect(path).toBe(join(tempDir, ".cline/mcp_settings.json"));
      });

      it("should return project-relative path for continue", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("continue", tempDir);
        expect(path).toBe(join(tempDir, ".continue/config.json"));
      });

      it("should return project-relative path for cursor", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("cursor", tempDir);
        expect(path).toBe(join(tempDir, ".cursor/mcp_settings.json"));
      });

      it("should return project-relative path for junie", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("junie", tempDir);
        expect(path).toBe(join(tempDir, ".junie/mcp_settings.json"));
      });

      it("should return project-relative path for kiro", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("kiro", tempDir);
        expect(path).toBe(join(tempDir, ".kiro/settings/mcp.json"));
      });

      it("should return project-relative path for zed", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("zed", tempDir);
        expect(path).toBe(join(tempDir, ".zed/mcp_settings.json"));
      });

      it("should use process.cwd() when projectRoot is not provided", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("cline");
        expect(path).toBe(join(process.cwd(), ".cline/mcp_settings.json"));
      });
    });

    it("should throw error for unknown client type", () => {
      const manager = new MCPConfigManager();
      expect(() =>
        manager.getConfigPath("unknown" as McpClientType, tempDir)
      ).toThrow("Unknown client type");
    });
  });

  describe("readConfig", () => {
    it("should read and parse valid JSON config", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const config = {
        mcpServers: {
          "test-server": {
            command: "npx",
            args: ["-y", "@test/package"],
            env: { TEST: "value" }
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const manager = new MCPConfigManager();
      const result = await manager.readConfig("cline", tempDir);

      expect(result).toEqual(config);
    });

    it("should return empty config when file does not exist", async () => {
      const manager = new MCPConfigManager();
      const result = await manager.readConfig("cline", tempDir);

      expect(result).toEqual({ mcpServers: {} });
    });

    it("should throw error for invalid JSON", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });
      await fs.writeFile(configPath, "{ invalid json }");

      const manager = new MCPConfigManager();
      await expect(manager.readConfig("cline", tempDir)).rejects.toThrow();
    });

    it("should create mcpServers object if missing from config", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({ otherField: "value" }));

      const manager = new MCPConfigManager();
      const result = await manager.readConfig("cline", tempDir);

      expect(result).toEqual({
        otherField: "value",
        mcpServers: {}
      });
    });

    it("should handle empty file gracefully", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });
      await fs.writeFile(configPath, "");

      const manager = new MCPConfigManager();
      await expect(manager.readConfig("cline", tempDir)).rejects.toThrow();
    });
  });

  describe("isServerConfigured", () => {
    it("should return true when server exists in config", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const config = {
        mcpServers: {
          "existing-server": {
            command: "npx",
            args: ["-y", "@test/package"]
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config));

      const manager = new MCPConfigManager();
      const result = await manager.isServerConfigured(
        "cline",
        "existing-server",
        tempDir
      );

      expect(result).toBe(true);
    });

    it("should return false when server does not exist in config", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const config = {
        mcpServers: {
          "other-server": {
            command: "npx",
            args: ["-y", "@test/package"]
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config));

      const manager = new MCPConfigManager();
      const result = await manager.isServerConfigured(
        "cline",
        "missing-server",
        tempDir
      );

      expect(result).toBe(false);
    });

    it("should return false when config file does not exist", async () => {
      const manager = new MCPConfigManager();
      const result = await manager.isServerConfigured(
        "cline",
        "any-server",
        tempDir
      );

      expect(result).toBe(false);
    });

    it("should return false when mcpServers is empty", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({ mcpServers: {} }));

      const manager = new MCPConfigManager();
      const result = await manager.isServerConfigured(
        "cline",
        "any-server",
        tempDir
      );

      expect(result).toBe(false);
    });
  });

  describe("addServer", () => {
    it("should add new server to empty config", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const serverConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills"],
        env: { NODE_ENV: "production" }
      };

      const manager = new MCPConfigManager();
      await manager.addServer("cline", "agent-skills", serverConfig, tempDir);

      const fileContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(fileContent);

      expect(config.mcpServers["agent-skills"]).toEqual(serverConfig);
    });

    it("should add new server to existing config with other servers", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const existingConfig = {
        mcpServers: {
          "existing-server": {
            command: "node",
            args: ["server.js"]
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(existingConfig));

      const newServerConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills"]
      };

      const manager = new MCPConfigManager();
      await manager.addServer(
        "cline",
        "agent-skills",
        newServerConfig,
        tempDir
      );

      const fileContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(fileContent);

      expect(config.mcpServers["existing-server"]).toEqual(
        existingConfig.mcpServers["existing-server"]
      );
      expect(config.mcpServers["agent-skills"]).toEqual(newServerConfig);
    });

    it("should throw error when adding duplicate server", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const existingConfig = {
        mcpServers: {
          "agent-skills": {
            command: "npx",
            args: ["-y", "@codemcp/agentskills"]
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(existingConfig));

      const manager = new MCPConfigManager();
      await expect(
        manager.addServer(
          "cline",
          "agent-skills",
          {
            command: "node",
            args: ["server.js"]
          },
          tempDir
        )
      ).rejects.toThrow("Server agent-skills already exists");
    });

    it("should create config directory if it does not exist", async () => {
      const serverConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills"]
      };

      const manager = new MCPConfigManager();
      await manager.addServer("cline", "agent-skills", serverConfig, tempDir);

      const configPath = join(tempDir, ".cline/mcp_settings.json");
      const fileContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(fileContent);

      expect(config.mcpServers["agent-skills"]).toEqual(serverConfig);
    });

    it("should preserve other config fields when adding server", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const existingConfig = {
        version: "1.0.0",
        otherField: "value",
        mcpServers: {}
      };

      await fs.writeFile(configPath, JSON.stringify(existingConfig));

      const serverConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills"]
      };

      const manager = new MCPConfigManager();
      await manager.addServer("cline", "agent-skills", serverConfig, tempDir);

      const fileContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(fileContent);

      expect(config.version).toBe("1.0.0");
      expect(config.otherField).toBe("value");
      expect(config.mcpServers["agent-skills"]).toEqual(serverConfig);
    });

    it("should format JSON output with proper indentation", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const serverConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills"]
      };

      const manager = new MCPConfigManager();
      await manager.addServer("cline", "agent-skills", serverConfig, tempDir);

      const fileContent = await fs.readFile(configPath, "utf-8");

      // Check that the file is properly formatted (has newlines and indentation)
      expect(fileContent).toContain("\n");
      expect(fileContent).toContain("  ");
    });
  });

  describe("removeServer", () => {
    it("should remove existing server from config", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const config = {
        mcpServers: {
          "server-1": {
            command: "npx",
            args: ["-y", "@test/package1"]
          },
          "server-2": {
            command: "npx",
            args: ["-y", "@test/package2"]
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config));

      const manager = new MCPConfigManager();
      await manager.removeServer("cline", "server-1", tempDir);

      const fileContent = await fs.readFile(configPath, "utf-8");
      const updatedConfig = JSON.parse(fileContent);

      expect(updatedConfig.mcpServers["server-1"]).toBeUndefined();
      expect(updatedConfig.mcpServers["server-2"]).toEqual(
        config.mcpServers["server-2"]
      );
    });

    it("should throw error when removing non-existent server", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const config = {
        mcpServers: {
          "server-1": {
            command: "npx",
            args: ["-y", "@test/package1"]
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config));

      const manager = new MCPConfigManager();
      await expect(
        manager.removeServer("cline", "non-existent-server", tempDir)
      ).rejects.toThrow("Server non-existent-server not found");
    });

    it("should throw error when config file does not exist", async () => {
      const manager = new MCPConfigManager();
      await expect(
        manager.removeServer("cline", "any-server", tempDir)
      ).rejects.toThrow();
    });

    it("should preserve other config fields when removing server", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const config = {
        version: "1.0.0",
        otherField: "value",
        mcpServers: {
          "server-1": {
            command: "npx",
            args: ["-y", "@test/package1"]
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config));

      const manager = new MCPConfigManager();
      await manager.removeServer("cline", "server-1", tempDir);

      const fileContent = await fs.readFile(configPath, "utf-8");
      const updatedConfig = JSON.parse(fileContent);

      expect(updatedConfig.version).toBe("1.0.0");
      expect(updatedConfig.otherField).toBe("value");
      expect(updatedConfig.mcpServers).toEqual({});
    });

    it("should handle removing the last server correctly", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const config = {
        mcpServers: {
          "only-server": {
            command: "npx",
            args: ["-y", "@test/package"]
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config));

      const manager = new MCPConfigManager();
      await manager.removeServer("cline", "only-server", tempDir);

      const fileContent = await fs.readFile(configPath, "utf-8");
      const updatedConfig = JSON.parse(fileContent);

      expect(updatedConfig.mcpServers).toEqual({});
    });

    it("should format JSON output with proper indentation after removal", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });

      const config = {
        mcpServers: {
          "server-1": {
            command: "npx",
            args: ["-y", "@test/package1"]
          },
          "server-2": {
            command: "npx",
            args: ["-y", "@test/package2"]
          }
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config));

      const manager = new MCPConfigManager();
      await manager.removeServer("cline", "server-1", tempDir);

      const fileContent = await fs.readFile(configPath, "utf-8");

      // Check that the file is properly formatted (has newlines and indentation)
      expect(fileContent).toContain("\n");
      expect(fileContent).toContain("  ");
    });
  });

  describe("Cross-platform integration tests", () => {
    it("should work with claude-desktop using project directory", async () => {
      const configDir = join(tempDir, ".claude");
      await fs.mkdir(configDir, { recursive: true });

      const serverConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills"]
      };

      const manager = new MCPConfigManager();
      await manager.addServer(
        "claude-desktop",
        "agent-skills",
        serverConfig,
        tempDir
      );

      const isConfigured = await manager.isServerConfigured(
        "claude-desktop",
        "agent-skills",
        tempDir
      );
      expect(isConfigured).toBe(true);

      const config = await manager.readConfig("claude-desktop", tempDir);
      expect(config.mcpServers["agent-skills"]).toEqual(serverConfig);

      await manager.removeServer("claude-desktop", "agent-skills", tempDir);
      const isConfiguredAfterRemoval = await manager.isServerConfigured(
        "claude-desktop",
        "agent-skills",
        tempDir
      );
      expect(isConfiguredAfterRemoval).toBe(false);
    });

    it("should work with multiple clients simultaneously", async () => {
      const clineConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills-cline"]
      };

      const cursorConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills-cursor"]
      };

      const manager = new MCPConfigManager();
      await manager.addServer("cline", "agent-skills", clineConfig, tempDir);
      await manager.addServer("cursor", "agent-skills", cursorConfig, tempDir);

      const clineConfigured = await manager.isServerConfigured(
        "cline",
        "agent-skills",
        tempDir
      );
      const cursorConfigured = await manager.isServerConfigured(
        "cursor",
        "agent-skills",
        tempDir
      );

      expect(clineConfigured).toBe(true);
      expect(cursorConfigured).toBe(true);

      const clineReadConfig = await manager.readConfig("cline", tempDir);
      const cursorReadConfig = await manager.readConfig("cursor", tempDir);

      expect(clineReadConfig.mcpServers["agent-skills"]).toEqual(clineConfig);
      expect(cursorReadConfig.mcpServers["agent-skills"]).toEqual(cursorConfig);
    });
  });
});
