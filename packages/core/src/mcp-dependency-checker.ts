import type {
  Skill,
  McpDependencyInfo,
  McpDependencyCheckResult,
  McpClientType
} from "./types.js";
import type { MCPConfigManager } from "./mcp-config-manager.js";

/**
 * MCPDependencyChecker - Collects and checks MCP server dependencies from skills
 */
export class MCPDependencyChecker {
  /**
   * Collect MCP server dependencies from skills
   * Merges duplicate servers (same name) and combines neededBy arrays
   *
   * @param skills - Array of skills to collect dependencies from
   * @returns Array of McpDependencyInfo with merged dependencies
   */
  collectDependencies(skills: Skill[]): McpDependencyInfo[] {
    const dependencyMap = new Map<string, McpDependencyInfo>();

    for (const skill of skills) {
      const mcpServers = skill.metadata.requiresMcpServers;

      // Skip skills without MCP dependencies
      if (!mcpServers || mcpServers.length === 0) {
        continue;
      }

      for (const server of mcpServers) {
        const serverName = server.name;

        if (dependencyMap.has(serverName)) {
          // Merge: add skill name to neededBy array
          const existing = dependencyMap.get(serverName)!;
          existing.neededBy.push(skill.metadata.name);
        } else {
          // First occurrence: create new entry
          dependencyMap.set(serverName, {
            serverName,
            neededBy: [skill.metadata.name],
            spec: server
          });
        }
      }
    }

    // Convert map to array
    return Array.from(dependencyMap.values());
  }

  /**
   * Check which dependencies are configured and which are missing
   *
   * @param clientType - Type of MCP client (claude-desktop, cline, etc.)
   * @param dependencies - Array of dependencies to check
   * @param configManager - MCPConfigManager instance to check configuration
   * @param projectRoot - Optional project root directory (defaults to process.cwd())
   * @returns McpDependencyCheckResult with configured/missing breakdown
   */
  async checkDependencies(
    clientType: McpClientType,
    dependencies: McpDependencyInfo[],
    configManager: MCPConfigManager,
    projectRoot?: string
  ): Promise<McpDependencyCheckResult> {
    const configured: string[] = [];
    const missing: McpDependencyInfo[] = [];

    for (const dependency of dependencies) {
      const isConfigured = await configManager.isServerConfigured(
        clientType,
        dependency.serverName,
        projectRoot
      );

      if (isConfigured) {
        configured.push(dependency.serverName);
      } else {
        missing.push(dependency);
      }
    }

    return {
      allConfigured: missing.length === 0,
      missing,
      configured
    };
  }
}
