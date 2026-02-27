/**
 * Kiro Agent Config Generator
 *
 * Generates JSON agent configuration for Kiro CLI
 * Follows the same schema as .kiro/agents/*.json
 */

import {
  ConfigGenerator,
  GeneratorOptions,
  GeneratedConfig,
  SkillsMcpAgentConfig,
  GeneratorMetadata
} from "../config-generators.js";
import { SKILLS_AGENT_DESCRIPTION_MARKDOWN } from "./skills-agent-description.js";

export class KiroGenerator implements ConfigGenerator {
  readonly agentTypes = ["kiro", "kiro-cli"];

  async generate(
    config: SkillsMcpAgentConfig,
    _options: GeneratorOptions
  ): Promise<GeneratedConfig> {
    const agentConfig = this.generateAgentConfig(config);

    return {
      filePath: `${_options.skillsDir}/.kiro/agents/skills-mcp.json`,
      content: JSON.stringify(agentConfig, null, 2),
      format: "json"
    };
  }

  supports(agentType: string): boolean {
    return this.agentTypes.includes(agentType);
  }

  getOutputPath(skillsDir: string): string {
    return `${skillsDir}/.kiro/agents/skills-mcp.json`;
  }

  getMetadata(): GeneratorMetadata {
    return {
      name: "Kiro",
      description: "Generates JSON agent configs for Kiro CLI",
      agentTypes: this.agentTypes,
      docsUrl: "https://kiro.dev/docs/cli/custom-agents/",
      version: "1.0.0"
    };
  }

  private generateAgentConfig(
    config: SkillsMcpAgentConfig
  ): Record<string, unknown> {
    const agentConfig: Record<string, unknown> = {
      name: config.id,
      prompt: SKILLS_AGENT_DESCRIPTION_MARKDOWN,
      mcpServers: this.generateMcpServers(config.mcp_servers),
      tools: this.generateTools(config),
      allowedTools: this.generateAllowedTools(config)
    };

    return agentConfig;
  }

  private generateMcpServers(
    servers: Record<string, unknown> | undefined
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (!servers) return result;

    for (const [name, config] of Object.entries(servers)) {
      const serverConfig = config as Record<string, unknown>;
      const serverEntry: Record<string, unknown> = {};

      if (serverConfig.command) {
        // Keep command and args separate for Kiro
        serverEntry.command = serverConfig.command;
      }

      if (serverConfig.args && Array.isArray(serverConfig.args)) {
        serverEntry.args = serverConfig.args;
      }

      if (serverConfig.env) {
        serverEntry.env = serverConfig.env;
      }

      result[name] = serverEntry;
    }

    return result;
  }

  private generateTools(config: SkillsMcpAgentConfig): string[] {
    const tools: string[] = [
      "execute_bash",
      "fs_read",
      "fs_write",
      "report_issue",
      "knowledge",
      "thinking",
      "use_aws"
    ];

    // Add MCP servers as tools
    if (config.mcp_servers && Object.keys(config.mcp_servers).length > 0) {
      for (const name of Object.keys(config.mcp_servers)) {
        tools.push(`@${name}`);
      }
    }

    return tools;
  }

  private generateAllowedTools(config: SkillsMcpAgentConfig): string[] {
    const allowed: string[] = ["fs_read", "use_skill"];

    // Add MCP server tools
    if (config.mcp_servers) {
      for (const [name, server] of Object.entries(config.mcp_servers)) {
        if (server.tools && !server.tools.includes("*")) {
          // Respect explicit tool restrictions from skill allowedTools
          for (const tool of server.tools) {
            allowed.push(`@${name}/${tool}`);
          }
        } else {
          // No restriction declared → allow all tools for this server
          allowed.push(`@${name}/*`);
        }
      }
    }

    return allowed;
  }
}
