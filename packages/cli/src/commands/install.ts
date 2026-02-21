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
  MCPDependencyChecker
} from "@codemcp/agentskills-core";
import type {
  InstallResult,
  McpClientType,
  McpDependencyInfo
} from "@codemcp/agentskills-core";
import ora from "ora";
import chalk from "chalk";

/**
 * Install all skills declared in package.json
 *
 * @param options - Options for the install command
 * @param options.cwd - Working directory (default: process.cwd())
 * @param options.withMcp - Skip MCP validation (will be handled by auto-install)
 */
export async function installCommand(options?: {
  cwd?: string;
  withMcp?: boolean;
}): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();
  const withMcp = options?.withMcp ?? false;

  try {
    // 1. Load package.json config
    const configManager = new PackageConfigManager(cwd);
    const config = await configManager.loadConfig();

    // Check if package.json exists (if source is defaults, it means no package.json was found)
    if (config.source.type === "defaults") {
      throw new Error("package.json not found");
    }

    // 2. Check if any skills to install
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

    // 3. Create skills directory
    const skillsDir = join(cwd, config.config.skillsDirectory);
    try {
      await fs.mkdir(skillsDir, { recursive: true });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red(`✗ Failed to create directory: ${errorMessage}`));
      process.exit(1);
      return;
    }

    // 4. Create installer
    const installer = new SkillInstaller(skillsDir);

    // 5. Install each skill with spinner
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

    // 6. Categorize results
    const successfulInstalls: Record<string, InstallResult> = {};
    const failedInstalls: Array<{ name: string; result: InstallResult }> = [];

    for (const [name, result] of results.entries()) {
      if (result.success) {
        successfulInstalls[name] = result;
      } else {
        failedInstalls.push({ name, result });
      }
    }

    // 7. Show individual skill results
    for (const [name, result] of results.entries()) {
      if (result.success) {
        console.log(chalk.green(`✓ ${name}`));
      }
    }

    // 8. Show errors for failed installs
    for (const { name, result } of failedInstalls) {
      if (!result.success && result.error) {
        console.error(chalk.red(`✗ ${name} failed: ${result.error.message}`));
      }
    }

    // 9. Generate lock file if any succeeded
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

      // 10. MCP Dependency Validation (only if not using --with-mcp)
      if (!withMcp) {
        const hasError = await validateMCPDependencies(installer);
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
 * @returns True if there are missing dependencies (error), false otherwise
 */
async function validateMCPDependencies(
  installer: SkillInstaller
): Promise<boolean> {
  try {
    // 1. Detect MCP client
    const mcpConfigManager = new MCPConfigManager();
    const clientType: McpClientType | null = mcpConfigManager.detectClient();

    // If no MCP client detected, skip validation
    if (!clientType) {
      return false;
    }

    // 2. Load installed skills
    const installedSkills = await installer.loadInstalledSkills();

    // 3. Collect MCP dependencies
    const mcpChecker = new MCPDependencyChecker();
    const dependencies: McpDependencyInfo[] =
      mcpChecker.collectDependencies(installedSkills);

    // If no dependencies, nothing to validate
    if (dependencies.length === 0) {
      return false;
    }

    // 4. Check which dependencies are configured
    const checkResult = await mcpChecker.checkDependencies(
      clientType,
      dependencies,
      mcpConfigManager
    );

    // 5. If all configured, we're done
    if (checkResult.allConfigured) {
      return false;
    }

    // 6. Display error message for missing dependencies
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
        "💡 Tip: Run with --with-mcp flag to automatically configure these servers"
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
