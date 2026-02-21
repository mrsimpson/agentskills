/**
 * SkillRegistry Component
 *
 * Responsibility: In-memory skill storage with Map-based O(1) lookups.
 * Load skills from a single directory with strict fail-fast behavior.
 *
 * Expected structure: <skillsDir>/<skill-name>/SKILL.md (exactly 2 levels deep)
 * Throws errors on any misconfiguration (no partial failures).
 */

import { promises as fs } from "fs";
import { join, basename } from "path";
import { parseSkill } from "./parser.js";
import { validateSkill } from "./validator.js";
import type {
  Skill,
  SkillMetadata,
  LoadResult,
  RegistryState
} from "./types.js";

/**
 * In-memory registry for managing agent skills
 *
 * Features:
 * - O(1) skill lookups using Map
 * - Load skills from single directory (strict fail-fast)
 * - Expected structure: <skillsDir>/<skill-name>/SKILL.md
 * - Validates directory name matches skill name
 * - Immutable skill objects
 */
export class SkillRegistry {
  private skills: Map<string, { skill: Skill; sourcePath: string }> = new Map();
  private skillsDir: string = "";
  private lastLoaded?: Date;

  /**
   * Load skills from a single directory with strict error handling
   *
   * Expected structure: <skillsDir>/<skill-name>/SKILL.md (exactly 2 levels deep)
   * - Throws on any error (fail fast)
   * - Ignores hidden directories (.git/, etc.)
   * - Ignores non-directory files
   * - Validates directory name matches skill name in SKILL.md
   *
   * @param skillsDir - Directory containing skill subdirectories
   * @returns Load result with count, directory, and timestamp
   * @throws Error if directory doesn't exist, isn't a directory, or any skill is invalid
   */
  async loadSkills(skillsDir: string): Promise<LoadResult> {
    // Clear existing skills
    this.skills.clear();
    this.skillsDir = "";

    // 1. Check if skillsDir exists
    let stat;
    try {
      stat = await fs.stat(skillsDir);
    } catch {
      throw new Error(`Skills directory does not exist: ${skillsDir}`);
    }

    // 2. Check if it's a directory
    if (!stat.isDirectory()) {
      throw new Error(`Skills directory is not a directory: ${skillsDir}`);
    }

    // 3. Read immediate subdirectories (depth 1 only)
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });

    let loadedCount = 0;

    // 4. Process each subdirectory
    for (const entry of entries) {
      // Skip non-directories
      if (!entry.isDirectory()) {
        continue;
      }

      // Skip hidden directories
      if (entry.name.startsWith(".")) {
        continue;
      }

      const skillDir = join(skillsDir, entry.name);
      const skillPath = join(skillDir, "SKILL.md");

      // Check for SKILL.md
      let skillStat;
      try {
        skillStat = await fs.stat(skillPath);
      } catch {
        throw new Error(`Missing SKILL.md in: ${skillDir}`);
      }

      // Verify SKILL.md is a file
      if (!skillStat.isFile()) {
        throw new Error(`Missing SKILL.md in: ${skillDir}`);
      }

      // Parse SKILL.md
      const parseResult = await parseSkill(skillPath);

      if (!parseResult.success) {
        throw new Error(
          `Failed to parse SKILL.md in ${skillDir}: ${parseResult.error.message}`
        );
      }

      const { skill } = parseResult;

      // Validate the skill
      const validationResult = validateSkill(skill);

      if (!validationResult.valid) {
        const errorMessages = validationResult.errors
          .map((e) => e.message)
          .join(", ");
        throw new Error(`Validation failed for ${skillDir}: ${errorMessages}`);
      }

      // Verify directory name matches skill name
      const dirName = basename(skillDir);
      if (skill.metadata.name !== dirName) {
        throw new Error(
          `Directory name '${dirName}' does not match skill name '${skill.metadata.name}' in ${skillPath}`
        );
      }

      // Store the skill
      this.skills.set(skill.metadata.name, { skill, sourcePath: skillPath });
      loadedCount++;
    }

    // Update state
    this.skillsDir = skillsDir;
    this.lastLoaded = new Date();

    return {
      loaded: loadedCount,
      skillsDir: skillsDir,
      timestamp: this.lastLoaded
    };
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
    return Array.from(this.skills.values()).map((entry) => ({
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
    return Array.from(this.skills.values()).map((entry) => ({
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
      skillsDir: this.skillsDir,
      lastLoaded: this.lastLoaded
    };
  }
}
