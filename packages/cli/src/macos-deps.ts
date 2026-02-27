import { execFileSync, execSync } from 'child_process';
import { platform } from 'os';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { Skill } from './types.ts';

/**
 * Collect all unique macOS Homebrew dependencies from a list of skills.
 */
export function collectMacosDependencies(skills: Skill[]): string[] {
  const deps = new Set<string>();
  for (const skill of skills) {
    for (const dep of skill.macosDependencies ?? []) {
      deps.add(dep);
    }
  }
  return [...deps];
}

/**
 * Install macOS Homebrew dependencies for installed skills.
 *
 * - Silently no-ops on non-macOS platforms.
 * - Warns if Homebrew is not found.
 * - Skips packages that are already installed.
 */
export async function installMacosDependencies(packages: string[]): Promise<void> {
  if (packages.length === 0) return;
  if (platform() !== 'darwin') return;

  // Check if brew is available
  let brewPath: string;
  try {
    brewPath = execFileSync('which', ['brew'], { encoding: 'utf-8' }).trim();
  } catch {
    p.log.warn(
      pc.yellow(
        `This skill requires macOS packages (${packages.join(', ')}) but Homebrew is not installed.`
      )
    );
    p.log.message(
      pc.dim(
        `Install Homebrew from ${pc.cyan('https://brew.sh')}, then run: brew install ${packages.join(' ')}`
      )
    );
    return;
  }

  const toInstall: string[] = [];
  for (const pkg of packages) {
    try {
      execFileSync(brewPath, ['list', '--formula', pkg], { stdio: 'ignore' });
      // Already installed — skip silently
    } catch {
      toInstall.push(pkg);
    }
  }

  if (toInstall.length === 0) return;

  p.log.step(
    `Installing macOS ${toInstall.length === 1 ? 'dependency' : 'dependencies'}: ${toInstall.map((d) => pc.cyan(d)).join(', ')}`
  );

  for (const pkg of toInstall) {
    try {
      execFileSync(brewPath, ['install', pkg], { stdio: 'inherit' });
      p.log.success(`${pc.green('✓')} Installed ${pc.cyan(pkg)}`);
    } catch {
      p.log.warn(
        pc.yellow(
          `Could not install ${pc.cyan(pkg)} — run ${pc.dim(`brew install ${pkg}`)} manually`
        )
      );
    }
  }
}
