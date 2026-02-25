/**
 * Install command - Install agent skills from package.json
 *
 * Reads agentskills field from package.json and installs all declared skills
 * using SkillInstaller. Generates a lock file after successful installation.
 */

import { promises as fs } from "fs";
import { join } from "path";
import {
  PackageConfigManager,
  SkillInstaller,
  MCPConfigManager,
  MCPDependencyChecker,
  substituteParameters
} from "@codemcp/agentskills-core";
import type {
  InstallResult,
  McpClientType,
  McpDependencyInfo,
  McpParameterSpec,
  ParameterValues
} from "@codemcp/agentskills-core";
import ora from "ora";
import chalk from "chalk";
import inquirer from "inquirer";

/**
 * Install all skills declared in package.json
 *
 * @param options - Options for the install command
 * @param options.cwd - Working directory (default: process.cwd())
 * @param options.withMcp - Skip MCP validation (will be handled by auto-install)
 * @param options.agent - Explicit MCP agent/client specification
 * @param options.global - Install only global skills instead of merged local + global (default: false)
 */
export async function installCommand(options?: {
  cwd?: string;
  withMcp?: boolean;
  agent?: string;
  global?: boolean;
}): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();
  const withMcp = options?.withMcp ?? false;
  const scope = options?.global ? "global" : "merged";

  // Agent name mapping to client types
  const AGENT_MAP: Record<string, McpClientType> = {
    claude: "claude-desktop",
    "claude-desktop": "claude-desktop",
    cline: "cline",
    continue: "continue",
    cursor: "cursor",
    junie: "junie",
    kiro: "kiro",
    opencode: "opencode",
    zed: "zed",
    vscode: "cline" // cline runs in vscode
  };

  // Determine client type from explicit --agent parameter
  let clientType: McpClientType | null = null;
  const mcpConfigManager = new MCPConfigManager();

  if (options?.agent) {
    const normalizedAgent = options.agent.toLowerCase();
    clientType = AGENT_MAP[normalizedAgent];
    if (!clientType) {
      console.error(chalk.red(`✗ Unknown agent: ${options.agent}`));
      console.error(
        chalk.yellow(`Supported agents: ${Object.keys(AGENT_MAP).join(", ")}`)
      );
      process.exit(1);
      return;
    }
    console.log(chalk.dim(`🎯 Configuring for agent: ${clientType}`));
  } else {
    // No agent specified - skip MCP configuration
    if (withMcp) {
      console.error(chalk.red("✗ --with-mcp requires --agent parameter"));
      console.error(
        chalk.yellow("  Example: agentskills install --with-mcp --agent claude")
      );
      process.exit(1);
      return;
    }
    // Will skip MCP validation and auto-install
  }

  try {
    // 1. Load package.json config
    const configManager = new PackageConfigManager(cwd, scope);
    const config = await configManager.loadConfig();

    // Check if package.json exists (if source is defaults, it means no package.json was found)
    if (config.source.type === "defaults") {
      throw new Error("package.json not found");
    }

    // 2. Auto-install agentskills-mcp server (only if agent specified/detected)
    if (clientType) {
      await ensureAgentskillsMCPServer(mcpConfigManager, clientType, cwd);
    }

    // 3. Check if any skills to install
    const skillEntries = Object.entries(config.skills);
    if (skillEntries.length === 0) {
      console.log(
        chalk.yellow(
          '⚠ No skills to install. Add skills to the "agentskills" field in package.json or the agentskills field is empty.'
        )
      );
      process.exit(0);
      return;
    }

    // 4. Create skills directory
    const skillsDir = join(cwd, config.config.skillsDirectory);
    try {
      await fs.mkdir(skillsDir, { recursive: true });

      // Create .gitignore in .agentskills directory to ignore skills subdirectory
      const agentskillsDir = join(cwd, ".agentskills");
      const gitignorePath = join(agentskillsDir, ".gitignore");

      // Only create .gitignore if it doesn't exist
      try {
        await fs.access(gitignorePath);
      } catch {
        // .gitignore doesn't exist, create it
        const gitignoreContent = `# Ignore installed skills - they should be installed via package.json
skills/
`;
        await fs.writeFile(gitignorePath, gitignoreContent, "utf-8");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red(`✗ Failed to create directory: ${errorMessage}`));
      process.exit(1);
      return;
    }

    // 5. Create installer
    const installer = new SkillInstaller(skillsDir);

    // 6. Install each skill with spinner
    const spinner = ora("Installing skills...").start();
    const results = new Map<string, InstallResult>();

    // Install all skills in parallel
    await Promise.all(
      skillEntries.map(async ([name, spec]) => {
        const result = await installer.install(name, spec);
        results.set(name, result);
      })
    );

    spinner.stop();

    // 7. Categorize results
    const successfulInstalls: Record<string, InstallResult> = {};
    const failedInstalls: Array<{ name: string; result: InstallResult }> = [];

    for (const [name, result] of results.entries()) {
      if (result.success) {
        successfulInstalls[name] = result;
      } else {
        failedInstalls.push({ name, result });
      }
    }

    // 8. Show individual skill results
    for (const [name, result] of results.entries()) {
      if (result.success) {
        console.log(chalk.green(`✓ ${name}`));
      }
    }

    // 9. Show errors for failed installs
    for (const { name, result } of failedInstalls) {
      if (!result.success && result.error) {
        console.error(chalk.red(`✗ ${name} failed: ${result.error.message}`));
      }
    }

    // 10. Generate lock file if any succeeded
    const successCount = Object.keys(successfulInstalls).length;
    const failCount = failedInstalls.length;

    if (successCount > 0) {
      await installer.generateLockFile(successfulInstalls);

      console.log(
        chalk.green(
          `\n✅ Successfully installed ${successCount} skill${successCount !== 1 ? "s" : ""}`
        )
      );
      console.log(
        chalk.green(
          `📁 ${successCount} skill${successCount !== 1 ? "s" : ""} installed to ${config.config.skillsDirectory}`
        )
      );

      if (failCount > 0) {
        console.log(
          chalk.yellow(
            `⚠ ${failCount} skill${failCount !== 1 ? "s" : ""} failed`
          )
        );
      }

      // 10. MCP Dependency handling
      // Only process skills that are currently configured in package.json.
      // Skills left on disk from previous installations must not influence
      // the MCP configuration of the current project.
      const configuredSkillNames = Object.keys(config.skills);

      if (withMcp) {
        // Auto-install MCP servers with parameter prompting
        const hasError = await installMCPServers(
          installer,
          clientType,
          mcpConfigManager,
          cwd,
          configuredSkillNames
        );
        if (hasError) {
          process.exit(1);
          return;
        }
      } else {
        // Just validate and show errors
        const hasError = await validateMCPDependencies(
          installer,
          clientType,
          mcpConfigManager,
          cwd,
          configuredSkillNames
        );
        if (hasError) {
          process.exit(1);
          return;
        }
      }

      process.exit(0);
    } else {
      // All installs failed
      console.error(chalk.red(`\n✗ All skill installations failed`));
      process.exit(1);
    }
  } catch (error: unknown) {
    // Handle configuration errors
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? error.code
        : undefined;

    if (
      errorMessage.includes("package.json not found") ||
      errorCode === "ENOENT"
    ) {
      console.error(chalk.red(`✗ Error: package.json not found in ${cwd}`));
      process.exit(1);
      return;
    }

    if (errorMessage.includes("Failed to parse")) {
      console.error(
        chalk.red(`✗ Error: Failed to parse package.json - Invalid JSON`)
      );
      process.exit(1);
      return;
    }

    if (errorMessage.includes("Permission denied") || errorCode === "EACCES") {
      console.error(chalk.red(`✗ Error: Permission error - ${errorMessage}`));
      process.exit(1);
      return;
    }

    // Unknown error
    console.error(chalk.red(`✗ Error: ${errorMessage}`));
    process.exit(1);
  }
}

/**
 * Validate MCP server dependencies for installed skills
 *
 * @param installer - SkillInstaller instance
 * @param clientType - The MCP client type (can be null if no agent specified)
 * @param mcpConfigManager - MCP config manager
 * @param projectRoot - Project root directory
 * @param configuredSkillNames - Names of skills currently declared in package.json
 * @returns True if there are missing dependencies (error), false otherwise
 */
async function validateMCPDependencies(
  installer: SkillInstaller,
  clientType: McpClientType | null,
  mcpConfigManager: MCPConfigManager,
  projectRoot: string,
  configuredSkillNames: string[]
): Promise<boolean> {
  try {
    // 1. Load installed skills, restricted to those declared in package.json.
    // Stale skills left on disk from previous installations are ignored so they
    // cannot silently inject MCP server requirements into the current project.
    const allInstalledSkills = await installer.loadInstalledSkills();
    const installedSkills = allInstalledSkills.filter((skill) =>
      configuredSkillNames.includes(skill.metadata.name)
    );

    // 2. Collect MCP dependencies
    const mcpChecker = new MCPDependencyChecker();
    const dependencies: McpDependencyInfo[] =
      mcpChecker.collectDependencies(installedSkills);

    // If no dependencies, nothing to validate
    if (dependencies.length === 0) {
      return false;
    }

    // If no MCP client specified, show warning
    if (!clientType) {
      console.log(
        chalk.yellow(
          "\n⚠ This skill requires MCP servers. Run with --agent <name> to configure."
        )
      );
      return false;
    }

    // 3. Check which dependencies are configured
    const checkResult = await mcpChecker.checkDependencies(
      clientType,
      dependencies,
      mcpConfigManager,
      projectRoot
    );

    // 4. If all configured, we're done
    if (checkResult.allConfigured) {
      return false;
    }

    // 5. Display error message for missing dependencies
    console.error(chalk.red.bold("\n❌ Missing MCP server dependencies"));
    console.error(
      chalk.red(
        `\nThe following MCP servers are required but not configured in your ${clientType} settings:\n`
      )
    );

    // Display each missing server
    for (const dep of checkResult.missing) {
      console.error(chalk.yellow(`  • ${dep.serverName}`));
      if (dep.spec.description) {
        console.error(chalk.gray(`    ${dep.spec.description}`));
      }
      console.error(chalk.cyan(`    Needed by: ${dep.neededBy.join(", ")}`));
      console.error(""); // Empty line for spacing
    }

    // Suggest using --with-mcp flag
    console.error(
      chalk.blue(
        "💡 Tip: Run with --with-mcp --agent <name> to automatically configure these servers"
      )
    );
    console.error("");

    // Return true to indicate error
    return true;
  } catch (error: unknown) {
    // Handle errors during validation
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(chalk.red(`\n✗ MCP validation error: ${errorMessage}`));
    return true;
  }
}

/**
 * Install and configure MCP servers with parameter prompting
 *
 * @param installer - SkillInstaller instance
 * @param clientType - The MCP client type (already validated to not be null)
 * @param mcpConfigManager - MCP config manager
 * @param projectRoot - Project root directory
 * @param configuredSkillNames - Names of skills currently declared in package.json
 * @returns True if there are errors, false otherwise
 */
async function installMCPServers(
  installer: SkillInstaller,
  clientType: McpClientType | null,
  mcpConfigManager: MCPConfigManager,
  projectRoot: string,
  configuredSkillNames: string[]
): Promise<boolean> {
  try {
    // clientType should never be null here as we validate earlier
    if (!clientType) {
      console.error(
        chalk.red(
          `✗ --with-mcp requires --agent parameter to specify which MCP client to configure`
        )
      );
      console.error(
        chalk.yellow(`  Example: agentskills install --with-mcp --agent claude`)
      );
      return true;
    }

    // 1. Load installed skills, restricted to those declared in package.json.
    // Stale skills left on disk from previous installations are ignored so they
    // cannot silently inject MCP server requirements into the current project.
    const allInstalledSkills = await installer.loadInstalledSkills();
    const installedSkills = allInstalledSkills.filter((skill) =>
      configuredSkillNames.includes(skill.metadata.name)
    );

    // 2. Collect MCP dependencies
    const mcpChecker = new MCPDependencyChecker();
    const dependencies: McpDependencyInfo[] =
      mcpChecker.collectDependencies(installedSkills);

    // If no dependencies, nothing to do
    if (dependencies.length === 0) {
      return false;
    }

    // 3. Check which dependencies are configured
    const checkResult = await mcpChecker.checkDependencies(
      clientType,
      dependencies,
      mcpConfigManager,
      projectRoot
    );

    // 4. If all configured, we're done
    if (checkResult.allConfigured) {
      return false;
    }

    // 5. Process each missing dependency
    for (const dep of checkResult.missing) {
      try {
        console.log(
          chalk.blue(
            `\n⚙️  Configuring MCP server: ${chalk.bold(dep.serverName)}`
          )
        );
        console.log(chalk.gray(`   ${dep.spec.description}`));
        console.log(chalk.cyan(`   Needed by: ${dep.neededBy.join(", ")}\n`));

        // Prompt for parameters
        const parameters = await promptForParameters(dep);

        // Install the server
        await installMCPServer(
          clientType,
          dep,
          parameters,
          mcpConfigManager,
          projectRoot
        );

        console.log(
          chalk.green(`✓ ${dep.serverName} configured successfully\n`)
        );
      } catch (error: unknown) {
        // Handle user cancellation or errors
        if (
          error instanceof Error &&
          (error.message.includes("cancelled") ||
            error.message.includes("User cancelled"))
        ) {
          console.error(
            chalk.yellow(
              `\n⚠ MCP server configuration cancelled by user. You can configure manually or run install --with-mcp --agent ${clientType} again.`
            )
          );
          return true;
        }

        // Other errors
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          chalk.red(`✗ Failed to configure ${dep.serverName}: ${errorMessage}`)
        );
        return true;
      }
    }

    console.log(
      chalk.green(
        `\n✅ All MCP servers configured successfully for ${clientType}`
      )
    );
    return false;
  } catch (error: unknown) {
    // Handle errors during installation
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      chalk.red(`\n✗ MCP server configuration error: ${errorMessage}`)
    );
    return true;
  }
}

/**
 * Prompt user for parameters needed by an MCP server
 *
 * @param dependency - MCP dependency info
 * @returns Parameter values provided by user
 */
async function promptForParameters(
  dependency: McpDependencyInfo
): Promise<ParameterValues> {
  const parameters = dependency.spec.parameters;

  // If no parameters, return empty
  if (!parameters || Object.keys(parameters).length === 0) {
    return {};
  }

  // Build inquirer questions for each parameter
  const questions = Object.entries(parameters).map(
    ([paramName, paramSpec]: [string, McpParameterSpec]) => {
      // Resolve default value (handle {{ENV:VAR}} syntax)
      let defaultValue = paramSpec.default;
      if (defaultValue && defaultValue.startsWith("{{ENV:")) {
        const envVarMatch = defaultValue.match(/\{\{ENV:([A-Za-z0-9_-]+)\}\}/);
        if (envVarMatch) {
          const envVarName = envVarMatch[1];
          const envValue = process.env[envVarName];
          if (envValue !== undefined) {
            defaultValue = envValue;
          } else {
            // If env var doesn't exist, don't show default
            defaultValue = undefined;
          }
        }
      }

      return {
        type: paramSpec.sensitive ? "password" : "input",
        name: paramName,
        message: paramSpec.description,
        default: defaultValue,
        validate: (input: string) => {
          // Required parameters must have a value
          if (paramSpec.required && !input) {
            return "This parameter is required";
          }
          return true;
        }
      };
    }
  );

  // Prompt user
  const answers = await inquirer.prompt(questions);
  return answers as ParameterValues;
}

/**
 * Install an MCP server to the config
 *
 * @param clientType - MCP client type
 * @param dependency - MCP dependency info
 * @param parameters - Parameter values from user
 * @param configManager - MCP config manager
 * @param projectRoot - Project root directory
 */
async function installMCPServer(
  clientType: McpClientType,
  dependency: McpDependencyInfo,
  parameters: ParameterValues,
  configManager: MCPConfigManager,
  projectRoot: string
): Promise<void> {
  const spec = dependency.spec;

  // Substitute parameters in args
  const substitutedArgs = spec.args
    ? (substituteParameters(spec.args, parameters) as string[])
    : undefined;

  // Substitute parameters in env
  const substitutedEnv = spec.env
    ? (substituteParameters(spec.env, parameters) as Record<string, string>)
    : undefined;

  // Build server config
  const serverConfig = {
    command: spec.command,
    args: substitutedArgs,
    env: substitutedEnv
  };

  // Add server to config
  await configManager.addServer(
    clientType,
    dependency.serverName,
    serverConfig,
    projectRoot
  );
}

/**
 * Ensure agentskills-mcp server is configured in MCP client
 *
 * This function automatically adds the @codemcp/agentskills-mcp server
 * to the specified MCP client configuration if it's not already configured.
 * This provides seamless integration with the agentskills ecosystem.
 *
 * @param configManager - MCP config manager
 * @param clientType - The MCP client type to configure
 * @param projectRoot - Project root directory
 */
async function ensureAgentskillsMCPServer(
  configManager: MCPConfigManager,
  clientType: McpClientType,
  projectRoot: string
): Promise<void> {
  try {
    // 1. Check if agentskills server is already configured
    const isConfigured = await configManager.isServerConfigured(
      clientType,
      "agentskills",
      projectRoot
    );

    // If already configured, skip silently
    if (isConfigured) {
      return;
    }

    // 2. Add agentskills server to configuration
    const serverConfig = {
      command: "npx",
      args: ["-y", "@codemcp/agentskills-mcp"],
      env: {}
    };

    await configManager.addServer(
      clientType,
      "agentskills",
      serverConfig,
      projectRoot
    );

    // 3. Show success message
    console.log(
      chalk.green(
        `✓ Added agentskills MCP server to ${clientType} configuration`
      )
    );
  } catch (error: unknown) {
    // Handle errors gracefully - don't fail the installation
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(
      chalk.yellow(
        `⚠ Warning: Could not add agentskills MCP server: ${errorMessage}`
      )
    );
  }
}
