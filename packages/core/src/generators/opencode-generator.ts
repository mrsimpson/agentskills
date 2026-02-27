/**
 * OpenCode MCP Configuration Generator
 *
 * Generates opencode.json containing MCP server configurations.
 * This is the baseline config that OpenCode needs to load MCP servers.
 *
 * Format:
 *   {
 *     "mcp": {
 *       "<name>": { "type": "local", "command": [...], "enabled": true, "environment": {} }
 *     }
 *   }
 *
 * This generator ONLY produces the opencode.json file. The companion
 * OpenCodeAgentGenerator produces the optional .opencode/agents/*.md
 * file when agent-config mode is requested.
 */

import {
  ConfigGenerator,
  GeneratorOptions,
  GeneratedConfig,
  SkillsMcpAgentConfig,
  GeneratorMetadata
} from "../config-generators.js";

export class OpenCodeMcpGenerator implements ConfigGenerator {
  readonly agentTypes = ["opencode", "opencode-cli"];

  async generate(
    config: SkillsMcpAgentConfig,
    options: GeneratorOptions
  ): Promise<GeneratedConfig> {
    const opencodeConfig = this.generateOpenCodeConfig(config);

    return {
      filePath: `${options.skillsDir}/opencode.json`,
      content: JSON.stringify(opencodeConfig, null, 2),
      format: "json"
    };
  }

  supports(agentType: string): boolean {
    return this.agentTypes.includes(agentType);
  }

  getOutputPath(skillsDir: string): string {
    return `${skillsDir}/opencode.json`;
  }

  getMetadata(): GeneratorMetadata {
    return {
      name: "OpenCode MCP",
      description:
        "Writes opencode.json with MCP server configurations for OpenCode",
      agentTypes: this.agentTypes,
      docsUrl: "https://opencode.ai/docs/mcp-servers/",
      version: "1.0.0"
    };
  }

  private generateOpenCodeConfig(
    config: SkillsMcpAgentConfig
  ): Record<string, unknown> {
    const opencodeConfig: Record<string, unknown> = {
      $schema: "https://opencode.ai/config.json",
      permission: {
        skill: "deny" // Disable native skill tool to avoid conflicts
      },
      mcp: {}
    };

    if (config.mcp_servers) {
      const mcp = opencodeConfig.mcp as Record<string, unknown>;

      for (const [name, serverConfig] of Object.entries(config.mcp_servers)) {
        const entry: Record<string, unknown> = {
          type: "local",
          enabled: true,
          environment: serverConfig.env || {}
        };

        // Build command array from command + args
        if (serverConfig.command) {
          entry.command = [serverConfig.command, ...(serverConfig.args || [])];
        }

        mcp[name] = entry;
      }
    }

    return opencodeConfig;
  }
}

/**
 * OpenCode Agent File Generator
 *
 * Generates Markdown agent configurations for OpenCode.
 * Stores agent config as .md files in .opencode/agents/ directory.
 *
 * This is optional - only generated when includeAgentConfig=true
 * (i.e., in agent-config mode). The baseline opencode.json is handled
 * by OpenCodeMcpGenerator.
 */

import { SKILLS_AGENT_DESCRIPTION_MARKDOWN } from "./skills-agent-description.js";

export class OpenCodeAgentGenerator implements ConfigGenerator {
  readonly agentTypes = ["opencode", "opencode-cli"];

  async generate(
    config: SkillsMcpAgentConfig,
    options: GeneratorOptions
  ): Promise<GeneratedConfig> {
    const markdown = this.generateMarkdown(config);

    return {
      filePath: `${options.skillsDir}/.opencode/agents/skills-mcp.md`,
      content: markdown,
      format: "markdown"
    };
  }

  supports(agentType: string): boolean {
    return this.agentTypes.includes(agentType);
  }

  getOutputPath(skillsDir: string): string {
    return `${skillsDir}/.opencode/agents/skills-mcp.md`;
  }

  getMetadata(): GeneratorMetadata {
    return {
      name: "OpenCode Agent",
      description: "Generates Markdown agent configs for OpenCode",
      agentTypes: this.agentTypes,
      docsUrl: "https://opencode.ai/docs/agents/",
      version: "1.0.0"
    };
  }

  private generateMarkdown(config: SkillsMcpAgentConfig): string {
    const frontmatter = this.generateFrontmatter(config);
    const content = this.generateContent();

    return `${frontmatter}\n\n${content}`;
  }

  private generateFrontmatter(config: SkillsMcpAgentConfig): string {
    const permissions = this.mapPermissions(config.permissions);

    const frontmatterObj: Record<string, unknown> = {
      name: config.id,
      description: config.description,
      mode: "subagent",
      model: config.model || "anthropic/claude-sonnet-4-20250514",
      temperature: config.temperature || 0.1,
      tools: this.mapTools(config.tools),
      permission: permissions
    };

    // Add MCP servers config if present
    if (config.mcp_servers && Object.keys(config.mcp_servers).length > 0) {
      frontmatterObj.mcp = this.generateMcpServers(config.mcp_servers);
    }

    let yaml = "---\n";
    for (const [key, value] of Object.entries(frontmatterObj)) {
      yaml += this.formatYamlValue(key, value);
    }
    yaml += "---";

    return yaml;
  }

  private formatYamlValue(key: string, value: unknown, indent = 0): string {
    const prefix = " ".repeat(indent);

    if (typeof value === "boolean" || typeof value === "number") {
      return `${prefix}${key}: ${value}\n`;
    }

    if (Array.isArray(value)) {
      let result = `${prefix}${key}:\n`;
      for (const item of value) {
        result += `${prefix}  - ${item}\n`;
      }
      return result;
    }

    if (typeof value === "object" && value !== null) {
      let result = `${prefix}${key}:\n`;
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result += this.formatYamlValue(k, v, indent + 2);
      }
      return result;
    }

    // Don't quote simple string values in YAML
    return `${prefix}${key}: ${value}\n`;
  }

  private mapTools(
    tools: Record<string, boolean> | undefined
  ): Record<string, boolean> {
    const mapped: Record<string, boolean> = {
      read: true,
      write: false,
      edit: false,
      bash: false,
      use_skill: true
    };

    if (tools) {
      Object.assign(mapped, tools);
    }

    return mapped;
  }

  private mapPermissions(permissions: unknown): Record<string, unknown> {
    if (!permissions) {
      return {
        edit: "ask",
        bash: "ask",
        use_skill: "allow"
      };
    }

    return (
      (permissions as Record<string, unknown>) || {
        edit: "ask",
        bash: "ask",
        use_skill: "allow"
      }
    );
  }

  private generateMcpServers(
    servers: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, config] of Object.entries(servers)) {
      const serverConfig = config as Record<string, unknown>;
      const serverEntry: Record<string, unknown> = {};

      if (serverConfig.type) {
        serverEntry.type = serverConfig.type;
      }
      if (serverConfig.command) {
        serverEntry.command = serverConfig.command;
      }
      if (serverConfig.args) {
        serverEntry.args = serverConfig.args;
      }
      if (serverConfig.url) {
        serverEntry.url = serverConfig.url;
      }
      if (serverConfig.env) {
        serverEntry.env = serverConfig.env;
      }
      if (serverConfig.tools) {
        serverEntry.tools = serverConfig.tools;
      }

      result[name] = serverEntry;
    }

    return result;
  }

  private generateContent(): string {
    return SKILLS_AGENT_DESCRIPTION_MARKDOWN;
  }
}
