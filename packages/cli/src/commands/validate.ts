/**
 * Validate command implementation
 * 
 * This command validates Agent Skills definitions either individually or in bulk.
 * It uses @codemcp/agentskills-core's SkillParser and SkillValidator to check skills
 * for correctness and compliance with the Agent Skills standard.
 * 
 * Usage:
 *   agentskills validate [path] [options]
 * 
 * Options:
 *   --strict    Enable strict validation (treat warnings as errors)
 *   --fix       Auto-fix issues if possible (not yet implemented)
 */

import { parseSkill, validateSkill } from '@codemcp/agentskills-core';
import type { ValidationError, ValidationWarning } from '@codemcp/agentskills-core';
import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export interface ValidateOptions {
  strict?: boolean;
  fix?: boolean;
}

interface ValidationResultDetails {
  success: boolean;
  name?: string;
  errors: string[];
  warnings: string[];
}

/**
 * Validate command entry point
 * 
 * @param path - Optional path to skill or directory to validate
 * @param options - Command options
 */
export async function validateCommand(
  path: string | undefined,
  options: ValidateOptions
): Promise<void> {
  try {
    // Show --fix message if flag is present
    if (options.fix) {
      console.log(chalk.yellow('Auto-fix is not implemented yet'));
      console.log('');
    }

    // Resolve paths to validate
    const skillPaths = await resolvePaths(path);

    if (skillPaths.length === 0) {
      console.log('No skills found');
      process.exit(0);
      return;
    }

    // Validate all skills
    const results: ValidationResultDetails[] = [];
    for (const skillPath of skillPaths) {
      const result = await validateSingleSkill(skillPath, options);
      results.push(result);
    }

    // Display results
    let hasErrors = false;
    for (const result of results) {
      if (result.success) {
        formatSuccess(result.name!, result.warnings);
      } else {
        formatError(result.name, result.errors);
        hasErrors = true;
      }
    }

    // Display summary if multiple skills
    if (skillPaths.length > 1) {
      const valid = results.filter(r => r.success).length;
      const invalid = results.length - valid;
      formatSummary(results.length, valid, invalid);
    }

    // Exit with appropriate code
    process.exit(hasErrors ? 1 : 0);

  } catch (error: any) {
    // Handle unexpected errors
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Resolve paths to validate based on input
 */
async function resolvePaths(path: string | undefined): Promise<string[]> {
  if (!path) {
    // No path provided - would normally load from config
    // For now, return empty array
    return [];
  }

  try {
    const stat = await fs.stat(path);

    if (stat.isFile()) {
      // Direct SKILL.md file
      if (path.endsWith('SKILL.md')) {
        return [path];
      } else {
        throw new Error(`Path not found: ${path}`);
      }
    } else if (stat.isDirectory()) {
      // Check if directory contains SKILL.md
      const skillPath = join(path, 'SKILL.md');
      try {
        await fs.access(skillPath);
        // Single skill directory
        return [skillPath];
      } catch {
        // Not a single skill dir, search for all skills
        const skills = await findAllSkills(path);
        if (skills.length === 0) {
          // Check if this looks like it should have been a single skill directory
          const entries = await fs.readdir(path);
          // If directory has exactly 1 file and it's a markdown file, likely meant to be a skill dir
          if (entries.length === 1 && entries[0].endsWith('.md')) {
            // Single markdown file that's not SKILL.md - probably meant to be a skill
            throw new Error(`No SKILL.md found in ${path}`);
          }
          // Otherwise, just no skills found (return empty array, will show message)
        }
        return skills;
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Path not found: ${path}`);
    } else if (error.code === 'EACCES') {
      throw new Error(`Permission denied: ${path}`);
    }
    throw error;
  }

  return [];
}

/**
 * Recursively find all SKILL.md files in a directory
 */
async function findAllSkills(dir: string): Promise<string[]> {
  const skills: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Recurse into subdirectories
          await walk(fullPath);
        } else if (entry.name === 'SKILL.md') {
          skills.push(fullPath);
        }
      }
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${currentDir}`);
      }
      throw error;
    }
  }

  await walk(dir);
  return skills;
}

/**
 * Validate a single skill file
 */
async function validateSingleSkill(
  skillPath: string,
  options: ValidateOptions
): Promise<ValidationResultDetails> {
  try {
    // Check if file exists and has SKILL.md
    if (!skillPath.endsWith('SKILL.md')) {
      return {
        success: false,
        errors: [`No SKILL.md found in ${skillPath}`],
        warnings: []
      };
    }

    // Parse the skill
    const parseResult = await parseSkill(skillPath);

    if (!parseResult.success) {
      // Parse error
      return {
        success: false,
        errors: [parseResult.error.message],
        warnings: []
      };
    }

    // Validate the skill
    const validationResult = validateSkill(parseResult.skill);
    const errors = validationResult.errors.map((e: ValidationError) => e.message);
    const warnings = validationResult.warnings.map((w: ValidationWarning) => w.message);
    
    // In strict mode, warnings become errors
    if (options.strict && warnings.length > 0) {
      return {
        success: false,
        name: parseResult.skill.metadata.name,
        errors: [...errors, ...warnings],
        warnings: []
      };
    }

    return {
      success: validationResult.valid,
      name: parseResult.skill.metadata.name,
      errors,
      warnings
    };

  } catch (error: any) {
    return {
      success: false,
      errors: [error.message],
      warnings: []
    };
  }
}

/**
 * Format success message with optional warnings
 */
function formatSuccess(skillName: string, warnings: string[]): void {
  console.log(chalk.green(`✓ Skill '${skillName}' is valid`));

  if (warnings.length > 0) {
    warnings.forEach(warning => {
      console.log(chalk.yellow(`  ⚠ Warning: ${warning}`));
    });
  }
}

/**
 * Format error message with details
 */
function formatError(skillName: string | undefined, errors: string[]): void {
  const name = skillName || 'unknown';
  console.error(chalk.red(`✗ Skill '${name}' failed validation:`));

  errors.forEach(error => {
    console.error(chalk.red(`  - ${error}`));
  });
}

/**
 * Format summary statistics
 */
function formatSummary(total: number, valid: number, invalid: number): void {
  const skillWord = total === 1 ? 'skill' : 'skills';
  
  console.log('');
  console.log(
    `Validated ${total} ${skillWord}: ${valid} valid, ${invalid} invalid`
  );
}
