/**
 * Add command - Validate a skill and add it to package.json
 *
 * This command:
 * 1. Validates inputs (name, spec)
 * 2. Performs a dry-run validation of the skill (download to temp dir, verify SKILL.md, parse)
 * 3. Adds the skill to package.json only if validation succeeds
 * 4. Prints info that the skill was added and can be installed via the install command
 *
 * Usage:
 *   agentskills add api-integration github:anthropic/api-integration#v1.0.0
 *   agentskills add local-skill file:./skills/my-skill
 */

import { tmpdir } from "os";
import { join } from "path";
import { promises as fs } from "fs";
import {
  PackageConfigManager,
  SkillInstaller
} from "@codemcp/agentskills-core";
import ora from "ora";
import chalk from "chalk";

/**
 * Validate a skill and add it to package.json
 *
 * Performs a dry-run validation (download to temp dir, verify SKILL.md, parse metadata)
 * before writing anything to package.json. If validation fails the package.json is
 * left untouched. On success the skill is added to package.json and the user is
 * instructed to run `agentskills install` to actually install it.
 *
 * @param name - Name of the skill
 * @param spec - Spec/source of the skill (e.g., github:user/repo#v1.0.0)
 * @param options - Options for the add command
 * @param options.cwd - Working directory (default: process.cwd())
 * @param options.global - Add to global config instead of local (default: false)
 */
export async function addCommand(
  name: string,
  spec: string,
  options?: {
    cwd?: string;
    global?: boolean;
  }
): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();
  const scope = options?.global ? "global" : "local";

  // 1. Validate inputs
  if (!name || name.trim() === "") {
    throw new Error("Skill name cannot be empty");
  }
  if (!spec || spec.trim() === "") {
    throw new Error("Skill spec cannot be empty");
  }

  // 2. Validate the skill via a dry-run (download to temp dir, verify SKILL.md, parse)
  const tempDir = join(
    tmpdir(),
    `agentskills-validate-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const spinner = ora(`Validating ${name}...`).start();

  let validationResult;
  try {
    const tempInstaller = new SkillInstaller(tempDir);
    validationResult = await tempInstaller.install(name, spec);
  } finally {
    // Always clean up the temp dir, whether validation passed or failed
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    spinner.stop();
  }

  if (!validationResult.success) {
    const errorMessage =
      typeof validationResult.error === "string"
        ? validationResult.error
        : validationResult.error?.message || "Validation failed";
    throw new Error(errorMessage);
  }

  // 3. Add to package.json only after successful validation
  const configManager = new PackageConfigManager(cwd, scope);
  await configManager.addSkill(name, spec);

  // 4. Inform the user
  const location = options?.global ? "global package.json" : "package.json";
  console.log(chalk.green(`✓ Added ${name} to ${location}`));
  console.log(chalk.gray(`   Spec: ${spec}`));
  console.log(
    chalk.blue(`\nRun 'agentskills install' to install all configured skills.`)
  );
}
