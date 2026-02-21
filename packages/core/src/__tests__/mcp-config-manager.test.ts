import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as os from "os";
import { MCPConfigManager } from "../mcp-config-manager.js";
import type { McpClientType } from "../types.js";

describe("MCPConfigManager", () => {
  let tempDir: string;
  let originalPlatform: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `mcp-config-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Store original values
    originalPlatform = process.platform;
    originalEnv = { ...process.env };

    // Mock homedir to use temp directory
    vi.spyOn(os, "homedir").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore original values
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true
    });
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("detectClient", () => {
    it("should detect claude-desktop from CLAUDE_DESKTOP environment variable", () => {
      process.env.CLAUDE_DESKTOP = "true";
      const manager = new MCPConfigManager();
      expect(manager.detectClient()).toBe("claude-desktop");
    });

    it("should detect cline from CLINE_MCP environment variable", () => {
      process.env.CLINE_MCP = "true";
      const manager = new MCPConfigManager();
      expect(manager.detectClient()).toBe("cline");
    });

    it("should detect continue from CONTINUE_MCP environment variable", () => {
      process.env.CONTINUE_MCP = "true";
      const manager = new MCPConfigManager();
      expect(manager.detectClient()).toBe("continue");
    });

    it("should detect cursor from CURSOR_MCP environment variable", () => {
      process.env.CURSOR_MCP = "true";
      const manager = new MCPConfigManager();
      expect(manager.detectClient()).toBe("cursor");
    });

    it("should detect junie from JUNIE_MCP environment variable", () => {
      process.env.JUNIE_MCP = "true";
      const manager = new MCPConfigManager();
      expect(manager.detectClient()).toBe("junie");
    });

    it("should return null when no client is detected", () => {
      delete process.env.CLAUDE_DESKTOP;
      delete process.env.CLINE_MCP;
      delete process.env.CONTINUE_MCP;
      delete process.env.CURSOR_MCP;
      delete process.env.JUNIE_MCP;

      const manager = new MCPConfigManager();
      expect(manager.detectClient()).toBeNull();
    });

    it("should prioritize CLAUDE_DESKTOP when multiple env vars are set", () => {
      process.env.CLAUDE_DESKTOP = "true";
      process.env.CLINE_MCP = "true";
      const manager = new MCPConfigManager();
      expect(manager.detectClient()).toBe("claude-desktop");
    });
  });

  describe("getConfigPath", () => {
    describe("claude-desktop paths", () => {
      it("should return macOS path for darwin platform", () => {
        Object.defineProperty(process, "platform", {
          value: "darwin",
          writable: true
        });
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("claude-desktop");
        expect(path).toBe(
          join(
            tempDir,
            "Library/Application Support/Claude/claude_desktop_config.json"
          )
        );
      });

      it("should return Linux path for linux platform", () => {
        Object.defineProperty(process, "platform", {
          value: "linux",
          writable: true
        });
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("claude-desktop");
        expect(path).toBe(
          join(tempDir, ".config/Claude/claude_desktop_config.json")
        );
      });

      it("should return Windows path for win32 platform", () => {
        Object.defineProperty(process, "platform", {
          value: "win32",
          writable: true
        });
        process.env.APPDATA = join(tempDir, "AppData", "Roaming");
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("claude-desktop");
        expect(path).toBe(
          join(tempDir, "AppData/Roaming/Claude/claude_desktop_config.json")
        );
      });

      it("should throw error on unsupported platform for claude-desktop", () => {
        Object.defineProperty(process, "platform", {
          value: "freebsd",
          writable: true
        });
        const manager = new MCPConfigManager();
        expect(() => manager.getConfigPath("claude-desktop")).toThrow(
          "Unsupported platform"
        );
      });
    });

    describe("cline paths", () => {
      it("should return cline config path for all platforms", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("cline");
        expect(path).toBe(join(tempDir, ".cline/mcp_settings.json"));
      });
    });

    describe("continue paths", () => {
      it("should return continue config path for all platforms", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("continue");
        expect(path).toBe(join(tempDir, ".continue/config.json"));
      });
    });

    describe("cursor paths", () => {
      it("should return cursor config path for all platforms", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("cursor");
        expect(path).toBe(join(tempDir, ".cursor/mcp_settings.json"));
      });
    });

    describe("junie paths", () => {
      it("should return junie config path for all platforms", () => {
        const manager = new MCPConfigManager();
        const path = manager.getConfigPath("junie");
        expect(path).toBe(join(tempDir, ".junie/mcp_settings.json"));
      });
    });

    it("should throw error for unknown client type", () => {
      const manager = new MCPConfigManager();
      expect(() => manager.getConfigPath("unknown" as McpClientType)).toThrow(
        "Unknown client type"
      );
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
      const result = await manager.readConfig("cline");

      expect(result).toEqual(config);
    });

    it("should return empty config when file does not exist", async () => {
      const manager = new MCPConfigManager();
      const result = await manager.readConfig("cline");

      expect(result).toEqual({ mcpServers: {} });
    });

    it("should throw error for invalid JSON", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });
      await fs.writeFile(configPath, "{ invalid json }");

      const manager = new MCPConfigManager();
      await expect(manager.readConfig("cline")).rejects.toThrow();
    });

    it("should create mcpServers object if missing from config", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({ otherField: "value" }));

      const manager = new MCPConfigManager();
      const result = await manager.readConfig("cline");

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
      await expect(manager.readConfig("cline")).rejects.toThrow();
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
        "existing-server"
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
        "missing-server"
      );

      expect(result).toBe(false);
    });

    it("should return false when config file does not exist", async () => {
      const manager = new MCPConfigManager();
      const result = await manager.isServerConfigured("cline", "any-server");

      expect(result).toBe(false);
    });

    it("should return false when mcpServers is empty", async () => {
      const configPath = join(tempDir, ".cline/mcp_settings.json");
      await fs.mkdir(join(tempDir, ".cline"), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({ mcpServers: {} }));

      const manager = new MCPConfigManager();
      const result = await manager.isServerConfigured("cline", "any-server");

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
        env: { NODE_ENV: "production" },
        cwd: "/path/to/dir"
      };

      const manager = new MCPConfigManager();
      await manager.addServer("cline", "agent-skills", serverConfig);

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
      await manager.addServer("cline", "agent-skills", newServerConfig);

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
        manager.addServer("cline", "agent-skills", {
          command: "node",
          args: ["server.js"]
        })
      ).rejects.toThrow("Server agent-skills already exists");
    });

    it("should create config directory if it does not exist", async () => {
      const serverConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills"]
      };

      const manager = new MCPConfigManager();
      await manager.addServer("cline", "agent-skills", serverConfig);

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
      await manager.addServer("cline", "agent-skills", serverConfig);

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
      await manager.addServer("cline", "agent-skills", serverConfig);

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
      await manager.removeServer("cline", "server-1");

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
        manager.removeServer("cline", "non-existent-server")
      ).rejects.toThrow("Server non-existent-server not found");
    });

    it("should throw error when config file does not exist", async () => {
      const manager = new MCPConfigManager();
      await expect(
        manager.removeServer("cline", "any-server")
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
      await manager.removeServer("cline", "server-1");

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
      await manager.removeServer("cline", "only-server");

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
      await manager.removeServer("cline", "server-1");

      const fileContent = await fs.readFile(configPath, "utf-8");

      // Check that the file is properly formatted (has newlines and indentation)
      expect(fileContent).toContain("\n");
      expect(fileContent).toContain("  ");
    });
  });

  describe("Cross-platform integration tests", () => {
    it("should work with claude-desktop on macOS", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true
      });

      const configDir = join(tempDir, "Library/Application Support/Claude");
      await fs.mkdir(configDir, { recursive: true });

      const serverConfig = {
        command: "npx",
        args: ["-y", "@codemcp/agentskills"]
      };

      const manager = new MCPConfigManager();
      await manager.addServer("claude-desktop", "agent-skills", serverConfig);

      const isConfigured = await manager.isServerConfigured(
        "claude-desktop",
        "agent-skills"
      );
      expect(isConfigured).toBe(true);

      const config = await manager.readConfig("claude-desktop");
      expect(config.mcpServers["agent-skills"]).toEqual(serverConfig);

      await manager.removeServer("claude-desktop", "agent-skills");
      const isConfiguredAfterRemoval = await manager.isServerConfigured(
        "claude-desktop",
        "agent-skills"
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
      await manager.addServer("cline", "agent-skills", clineConfig);
      await manager.addServer("cursor", "agent-skills", cursorConfig);

      const clineConfigured = await manager.isServerConfigured(
        "cline",
        "agent-skills"
      );
      const cursorConfigured = await manager.isServerConfigured(
        "cursor",
        "agent-skills"
      );

      expect(clineConfigured).toBe(true);
      expect(cursorConfigured).toBe(true);

      const clineReadConfig = await manager.readConfig("cline");
      const cursorReadConfig = await manager.readConfig("cursor");

      expect(clineReadConfig.mcpServers["agent-skills"]).toEqual(clineConfig);
      expect(cursorReadConfig.mcpServers["agent-skills"]).toEqual(cursorConfig);
    });
  });
});
