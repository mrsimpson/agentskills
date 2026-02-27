/**
 * GitHub Copilot Agent Config Generator
 *
 * Generates Markdown + YAML frontmatter agent configurations for:
 * - GitHub Copilot CLI
 * - Copilot coding agent
 * - VS Code Copilot extension
 */

import {
  ConfigGenerator,
  GeneratorOptions,
  GeneratedConfig,
  SkillsMcpAgentConfig,
  GeneratorMetadata
} from "../config-generators.js";
import { SKILLS_AGENT_DESCRIPTION_MARKDOWN } from "./skills-agent-description.js";

export class GitHubCopilotGenerator implements ConfigGenerator {
  readonly agentTypes = [
    "github-copilot",
    "copilot-cli",
    "copilot-coding-agent"
  ];

  async generate(
    config: SkillsMcpAgentConfig,
    options: GeneratorOptions
  ): Promise<GeneratedConfig> {
    const yaml = this.generateYamlFrontmatter(config);
    const markdown = this.generateMarkdownContent();

    return {
      filePath: `${options.skillsDir}/.github/agents/skills-mcp.agent.md`,
      content: `${yaml}\n\n${markdown}`,
      format: "markdown"
    };
  }

  supports(agentType: string): boolean {
    return this.agentTypes.includes(agentType);
  }

  getOutputPath(skillsDir: string): string {
    return `${skillsDir}/.github/agents/skills-mcp.agent.md`;
  }

  getMetadata(): GeneratorMetadata {
    return {
      name: "GitHub Copilot",
      description:
        "Generates Markdown+YAML agent configs for GitHub Copilot CLI and coding agent",
      agentTypes: this.agentTypes,
      docsUrl:
        "https://docs.github.com/en/copilot/reference/custom-agents-configuration",
      version: "1.0.0"
    };
  }

  private generateYamlFrontmatter(config: SkillsMcpAgentConfig): string {
    const tools = this.mapToolsToGitHubFormat(config.tools, config.mcp_servers);

    const yamlObj: Record<string, unknown> = {
      name: config.id,
      description: config.description
    };

    if (tools.length > 0) {
      yamlObj.tools = tools;
    }

    if (config.mcp_servers && Object.keys(config.mcp_servers).length > 0) {
      yamlObj["mcp-servers"] = this.generateMcpServers(config.mcp_servers);
    }

    yamlObj["disable-model-invocation"] = false;
    yamlObj["user-invocable"] = true;

    let yaml = "---\n";
    for (const [k, v] of Object.entries(yamlObj)) {
      yaml += this.formatYamlEntry(k, v) + "\n";
    }
    yaml += "---";

    return yaml;
  }

  private generateMarkdownContent(): string {
    return SKILLS_AGENT_DESCRIPTION_MARKDOWN;
  }

  private generateMcpServers(
    servers: Record<string, unknown>
  ): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};

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
      if (serverConfig.headers) {
        serverEntry.headers = serverConfig.headers;
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

  private mapToolsToGitHubFormat(
    tools: Record<string, boolean> | undefined,
    servers: Record<string, unknown> | undefined
  ): string[] {
    const result: string[] = [];

    // Built-in tools
    if (tools?.write) result.push("edit");
    if (tools?.read) result.push("read");
    if (tools?.bash) result.push("execute");
    if (tools?.use_skill) result.push("use_skill");

    // MCP server tools
    if (servers) {
      for (const name of Object.keys(servers)) {
        result.push(`${name}/*`);
      }
    }

    // Default to all if nothing specified
    return result.length > 0 ? result : ["*"];
  }

  private formatYamlEntry(key: string, value: unknown, indent = 0): string {
    const prefix = " ".repeat(indent);

    if (Array.isArray(value)) {
      return `${prefix}${key}:\n${value.map((v) => `${prefix}  - ${v}`).join("\n")}`;
    }

    if (typeof value === "object" && value !== null) {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return `${prefix}${key}: {}`;

      let result = `${prefix}${key}:\n`;
      for (const [k, v] of entries) {
        const entry = this.formatYamlEntry(k, v, indent + 2);
        result += entry + "\n";
      }
      return result.trimEnd();
    }

    if (typeof value === "boolean") {
      return `${prefix}${key}: ${value}`;
    }

    // Don't quote simple string values in YAML
    return `${prefix}${key}: ${value}`;
  }
}
