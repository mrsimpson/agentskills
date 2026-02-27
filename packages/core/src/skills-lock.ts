/**
 * Skills Lock Manager
 *
 * Manages skills-lock.json file that specifies which skills are verified
 * and available for use. Provides filtering logic to only include skills
 * that are listed in the lock file.
 */

import { promises as fs } from "fs";
import { join } from "path";

/**
 * Structure of skills-lock.json
 */
interface SkillsLock {
  version: number;
  skills: Record<
    string,
    {
      source: string;
      sourceType: string;
      computedHash: string;
    }
  >;
}

/**
 * Load and parse skills-lock.json
 *
 * @param lockFilePath - Path to skills-lock.json
 * @returns Parsed lock file or null if file doesn't exist
 */
export async function loadSkillsLock(
  lockFilePath: string
): Promise<SkillsLock | null> {
  try {
    const content = await fs.readFile(lockFilePath, "utf-8");
    const lock = JSON.parse(content) as SkillsLock;
    return lock;
  } catch (error) {
    // If file doesn't exist, return null (skills lock is optional)
    if ((error as { code?: string }).code === "ENOENT") {
      return null;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get allowed skill names from skills-lock.json
 *
 * Returns a Set of skill names that are listed in the lock file.
 * If lock file doesn't exist, returns undefined (allowing all skills).
 *
 * @param lockFilePath - Path to skills-lock.json
 * @returns Set of allowed skill names, or undefined if no lock file
 */
export async function getAllowedSkills(
  lockFilePath: string
): Promise<Set<string> | undefined> {
  const lock = await loadSkillsLock(lockFilePath);

  if (!lock) {
    // No lock file means all skills are allowed
    return undefined;
  }

  return new Set(Object.keys(lock.skills));
}

/**
 * Get allowed skill names from skills-lock.json in project directory
 *
 * @param projectDir - Project directory containing skills-lock.json
 * @returns Set of allowed skill names, or undefined if no lock file
 */
export async function getAllowedSkillsFromProject(
  projectDir: string
): Promise<Set<string> | undefined> {
  const lockFilePath = join(projectDir, "skills-lock.json");
  return getAllowedSkills(lockFilePath);
}

/**
 * Get allowed skill names from skills-lock.json in .agentskills directory
 *
 * @param projectDir - Project directory
 * @returns Set of allowed skill names, or undefined if no lock file
 */
export async function getAllowedSkillsFromAgentskills(
  projectDir: string
): Promise<Set<string> | undefined> {
  const lockFilePath = join(projectDir, ".agentskills", "skills-lock.json");
  return getAllowedSkills(lockFilePath);
}
