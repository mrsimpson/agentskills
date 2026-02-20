/**
 * SkillRegistry Component
 * 
 * Responsibility: In-memory skill storage with Map-based O(1) lookups.
 * Load skills from multiple source directories with first-source-wins conflict resolution.
 * 
 * This is a stub implementation - tests define the expected behavior.
 * Implementation to be completed following TDD approach.
 */

import { promises as fs } from "fs";
import { join } from "path";
import { parseSkill } from "./parser";
import { validateSkill } from "./validator";
import type { Skill, SkillMetadata, SkillSource, LoadResult, RegistryState } from "./types";

/**
 * In-memory registry for managing agent skills
 * 
 * Features:
 * - O(1) skill lookups using Map
 * - Load skills from multiple directories
 * - First-source-wins conflict resolution
 * - Graceful degradation (individual failures don't crash)
 * - Recursive directory traversal
 * - Immutable skill objects
 */
export class SkillRegistry {
  private skills: Map<string, { skill: Skill; sourcePath: string }> = new Map();
  private sources: string[] = [];
  private lastLoaded?: Date;

  /**
   * Recursively find all .md files in a directory
   */
  private async findSkillFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findSkillFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          // Add .md files
          files.push(fullPath);
        }
      }
    } catch {
      // Silently ignore errors in subdirectories
    }
    
    return files;
  }

  /**
   * Load skills from multiple source directories
   * 
   * @param sources - Array of skill sources to load from
   * @returns Load result with counts and any errors/warnings
   */
  async loadSkills(sources: SkillSource[]): Promise<LoadResult> {
    // Clear existing skills
    this.skills.clear();
    this.sources = [];
    
    const result: LoadResult = {
      loaded: 0,
      failed: 0,
      warnings: [],
      errors: []
    };

    // Sort sources by priority (higher priority first)
    const sortedSources = [...sources].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });

    // Track which skills we've seen (for conflict detection)
    const loadedSkills = new Set<string>();

    // Process each source
    for (const source of sortedSources) {
      this.sources.push(source.path);
      
      // Check if directory exists
      try {
        const stat = await fs.stat(source.path);
        if (!stat.isDirectory()) {
          result.errors.push(`Source path is not a directory: ${source.path}`);
          continue;
        }
      } catch {
        result.errors.push(`Source directory does not exist or is not accessible: ${source.path}`);
        continue;
      }

      // Find all .md files in the directory (recursively)
      const skillFiles = await this.findSkillFiles(source.path);

      // Process each skill file
      for (const filePath of skillFiles) {
        try {
          // Parse the skill
          const parseResult = await parseSkill(filePath);
          
          if (!parseResult.success) {
            // Only count as failed if it looks like it was meant to be a skill
            // (has frontmatter but it's invalid, or is missing required fields)
            // Don't count regular markdown files without frontmatter as failures
            if (parseResult.error.code !== "MISSING_FRONTMATTER") {
              result.failed++;
              result.errors.push(`Failed to parse ${filePath}: ${parseResult.error.message}`);
            }
            continue;
          }

          const { skill } = parseResult;

          // Validate the skill
          const validationResult = validateSkill(skill);

          // Check for validation errors
          if (!validationResult.valid) {
            result.failed++;
            const errorMessages = validationResult.errors.map(e => e.message).join(', ');
            result.errors.push(`Validation failed for ${filePath}: ${errorMessages}`);
            continue;
          }

          // Check for conflicts (first-source-wins)
          const skillName = skill.metadata.name;
          if (loadedSkills.has(skillName)) {
            result.warnings.push(`Skill '${skillName}' from ${filePath} conflicts with previously loaded skill, skipping`);
            continue;
          }

          // Store the skill (validation passed, so we load it even with warnings)
          this.skills.set(skillName, { skill, sourcePath: filePath });
          loadedSkills.add(skillName);
          result.loaded++;

        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error processing ${filePath}: ${errorMessage}`);
        }
      }
    }

    // Update last loaded timestamp
    this.lastLoaded = new Date();

    return result;
  }

  /**
   * Get a skill by name
   * 
   * @param name - The skill name
   * @returns The skill or undefined if not found
   */
  getSkill(name: string): Skill | undefined {
    const entry = this.skills.get(name);
    if (!entry) {
      return undefined;
    }
    
    // Return a deep copy to maintain immutability
    return {
      metadata: { ...entry.skill.metadata },
      body: entry.skill.body
    };
  }

  /**
   * Get all loaded skills
   * 
   * @returns Array of all skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values()).map(entry => ({
      metadata: { ...entry.skill.metadata },
      body: entry.skill.body
    }));
  }

  /**
   * Get skill metadata without body content
   * 
   * @param name - The skill name
   * @returns The skill metadata or undefined if not found
   */
  getSkillMetadata(name: string): SkillMetadata | undefined {
    const entry = this.skills.get(name);
    if (!entry) {
      return undefined;
    }
    
    return { ...entry.skill.metadata };
  }

  /**
   * Get all skill metadata without body content
   * 
   * @returns Array of all skill metadata
   */
  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.skills.values()).map(entry => ({
      ...entry.skill.metadata
    }));
  }

  /**
   * Get current registry state
   * 
   * @returns Current state with counts and source info
   */
  getState(): RegistryState {
    return {
      skillCount: this.skills.size,
      sources: [...this.sources],
      lastLoaded: this.lastLoaded
    };
  }
}
