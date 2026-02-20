/**
 * Add command - Add a skill to package.json and install it
 *
 * This command:
 * 1. Reads package.json using PackageConfigManager
 * 2. Adds the skill to the agentskills field using configManager.addSkill()
 * 3. Installs the skill using SkillInstaller
 * 4. Displays success message
 *
 * Usage:
 *   agentskills add api-integration github:anthropic/api-integration#v1.0.0
 *   agentskills add local-skill file:./skills/my-skill
 *   agentskills add --skip-install my-skill git+https://...
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { PackageConfigManager, SkillInstaller } from '@agentskills/core';
import type { InstallResult } from '@agentskills/core';
import ora from 'ora';
import chalk from 'chalk';

/**
 * Add a skill to package.json and install it
 *
 * @param name - Name of the skill
 * @param spec - Spec/source of the skill (e.g., github:user/repo#v1.0.0)
 * @param options - Options for the add command
 * @param options.cwd - Working directory (default: process.cwd())
 * @param options.skipInstall - Skip installation, only update package.json
 */
export async function addCommand(
  name: string,
  spec: string,
  options?: {
    cwd?: string;
    skipInstall?: boolean;
  }
): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();
  
  // 1. Validate inputs
  if (!name || name.trim() === '') {
    throw new Error('Skill name cannot be empty');
  }
  if (!spec || spec.trim() === '') {
    throw new Error('Skill spec cannot be empty');
  }
  
  // 2. Add to package.json
  const configManager = new PackageConfigManager(cwd);
  await configManager.addSkill(name, spec);
  console.log(chalk.green(`✓ Added ${name} to package.json`));
  
  // 3. Install if not skipped
  if (!options?.skipInstall) {
    const spinner = ora(`Installing ${name}...`).start();
    
    try {
      const config = await configManager.loadConfig();
      const installer = new SkillInstaller(config.config.skillsDirectory);
      
      const result = await installer.install(name, spec);
      spinner.stop();
      
      if (!result.success) {
        // Handle both string error (from tests) and InstallError object
        const errorMessage = typeof result.error === 'string' 
          ? result.error 
          : result.error?.message || 'Installation failed';
        throw new Error(errorMessage);
      }
      
      console.log(chalk.green(`✓ ${name} installed successfully`));
    } catch (error) {
      spinner.stop();
      throw error;
    }
  }
  
  console.log(chalk.blue(`\n✅ Successfully added ${name}`));
  console.log(chalk.gray(`   Spec: ${spec}`));
}
