/**
 * OpenCode Agent Config Generator
 *
 * Generates Markdown agent configurations for OpenCode
 * Stores agent config as .md files in .opencode/agents/ directory
 */

import {
  ConfigGenerator,
  GeneratorOptions,
  GeneratedConfig,
  SkillsMcpAgentConfig,
  GeneratorMetadata
} from "../config-generators.js";
import { SKILLS_AGENT_DESCRIPTION_MARKDOWN } from "./skills-agent-description.js";

export class OpenCodeGenerator implements ConfigGenerator {
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
      name: "OpenCode",
      description: "Generates Markdown agent configs for OpenCode",
      agentTypes: this.agentTypes,
      docsUrl: "https://opencode.ai/docs/de/agents/",
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
