import { PackageConfigManager } from "@codemcp/agentskills-core";
import type { PackageConfigScope } from "@codemcp/agentskills-core";
import { Command } from "commander";
import { existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

export async function listCommand(options?: {
  global?: boolean;
}): Promise<string> {
  const scope: PackageConfigScope = options?.global ? "global" : "merged";
  const configManager = new PackageConfigManager(process.cwd(), scope);
  const config = await configManager.loadConfig();

  if (Object.keys(config.skills).length === 0) {
    const location = options?.global
      ? "global configuration"
      : "package.json (local or global)";
    return chalk.yellow(`No skills configured in ${location}`);
  }

  const titleSuffix = options?.global
    ? " (Global)"
    : " (Merged: Local + Global)";
  const lines: string[] = [chalk.bold(`\nConfigured Skills${titleSuffix}:\n`)];
  const skillsDir = join(process.cwd(), ".agentskills", "skills");

  // When showing merged config, we need to load both local and global to determine source
  let localSkills: Record<string, string> = {};
  let globalSkills: Record<string, string> = {};

  if (!options?.global) {
    // Load local and global separately to determine source
    const localManager = new PackageConfigManager(process.cwd(), "local");
    const globalManager = new PackageConfigManager(process.cwd(), "global");

    try {
      const localConfig = await localManager.loadConfig();
      localSkills = localConfig.skills;
    } catch {
      // No local config is fine
    }

    try {
      const globalConfig = await globalManager.loadConfig();
      globalSkills = globalConfig.skills;
    } catch {
      // No global config is fine
    }
  }

  for (const [name, spec] of Object.entries(config.skills)) {
    const skillPath = join(skillsDir, name, "SKILL.md");
    const isInstalled = existsSync(skillPath);
    const status = isInstalled ? chalk.green("✓") : chalk.gray("○");

    // Determine source indicator for merged view
    let sourceIndicator = "";
    if (!options?.global) {
      const inLocal = name in localSkills;
      const inGlobal = name in globalSkills;

      if (inLocal && inGlobal) {
        sourceIndicator = chalk.dim(" [local]");
      } else if (inLocal) {
        sourceIndicator = chalk.dim(" [local]");
      } else if (inGlobal) {
        sourceIndicator = chalk.dim(" [global]");
      }
    }

    lines.push(`${status} ${chalk.cyan(name)}${sourceIndicator}`);
    lines.push(`  ${chalk.gray(spec)}`);
  }

  return lines.join("\n");
}

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List configured skills")
    .action(async () => {
      try {
        const output = await listCommand();
        console.log(output);
      } catch (error) {
        console.error(chalk.red("Error listing skills:"), error);
        process.exit(1);
      }
    });
}
