/**
 * VS Code MCP Generator
 *
 * Writes .vscode/mcp.json using VS Code's native `servers` format.
 * This file makes MCP servers available to GitHub Copilot (and any other
 * VS Code extension that reads .vscode/mcp.json).
 *
 * Format:
 *   {
 *     "servers": {
 *       "<name>": { "command": "...", "args": [...] }
 *     }
 *   }
 *
 * Key difference from the generic mcp.json format: top-level key is
 * `servers`, not `mcpServers`.
 *
 * This generator ONLY produces the .vscode/mcp.json file. The companion
 * GitHubCopilotGenerator produces the optional .github/agents/*.agent.md
 * file when agent-config mode is requested.
 */

import {
  ConfigGenerator,
  GeneratorOptions,
  GeneratedConfig,
  SkillsMcpAgentConfig,
  GeneratorMetadata
} from "../config-generators.js";

export class VsCodeGenerator implements ConfigGenerator {
  // github-copilot is the primary agent type; the others are aliases
  // that also live inside VS Code and share the same MCP config file.
  readonly agentTypes = [
    "github-copilot",
    "copilot-cli",
    "copilot-coding-agent"
  ];

  async generate(
    config: SkillsMcpAgentConfig,
    options: GeneratorOptions
  ): Promise<GeneratedConfig> {
    const vscodeConfig = this.generateVsCodeConfig(config);

    return {
      filePath: `${options.skillsDir}/.vscode/mcp.json`,
      content: JSON.stringify(vscodeConfig, null, 2),
      format: "json"
    };
  }

  supports(agentType: string): boolean {
    return this.agentTypes.includes(agentType);
  }

  getOutputPath(skillsDir: string): string {
    return `${skillsDir}/.vscode/mcp.json`;
  }

  getMetadata(): GeneratorMetadata {
    return {
      name: "VS Code",
      description:
        "Writes .vscode/mcp.json (servers format) so MCP servers are available to GitHub Copilot and other VS Code extensions",
      agentTypes: this.agentTypes,
      docsUrl: "https://code.visualstudio.com/docs/copilot/chat/mcp-servers",
      version: "1.0.0"
    };
  }

  private generateVsCodeConfig(
    config: SkillsMcpAgentConfig
  ): Record<string, unknown> {
    const servers: Record<string, unknown> = {};

    if (config.mcp_servers) {
      for (const [name, serverConfig] of Object.entries(config.mcp_servers)) {
        const entry: Record<string, unknown> = {};

        // VS Code mcp.json uses plain command/args/env for stdio servers
        // and type + url for HTTP/SSE servers — no "type: stdio" needed.
        if (serverConfig.url) {
          entry.type = serverConfig.type ?? "http";
          entry.url = serverConfig.url;
          if (serverConfig.headers) entry.headers = serverConfig.headers;
        } else if (serverConfig.command) {
          entry.command = serverConfig.command;
          if (serverConfig.args?.length) entry.args = serverConfig.args;
          if (serverConfig.env && Object.keys(serverConfig.env).length) {
            entry.env = serverConfig.env;
          }
        }

        servers[name] = entry;
      }
    }

    return { servers };
  }
}
