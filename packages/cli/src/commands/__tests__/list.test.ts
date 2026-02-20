import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { listCommand } from '../list.js';

describe('list command', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `agentskills-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should show message when no skills configured', async () => {
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test' }, null, 2)
    );

    const output = await listCommand();
    expect(output).toContain('No skills configured');
  });

  it('should list skills from package.json', async () => {
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        agentskills: {
          'skill-one': 'github:user/repo#v1.0.0',
          'skill-two': 'file:./local/skill',
          'skill-three': 'git+https://github.com/org/skill.git'
        }
      }, null, 2)
    );

    const output = await listCommand();
    expect(output).toContain('skill-one');
    expect(output).toContain('github:user/repo#v1.0.0');
    expect(output).toContain('skill-two');
    expect(output).toContain('file:./local/skill');
    expect(output).toContain('skill-three');
    expect(output).toContain('git+https://github.com/org/skill.git');
  });

  it('should show installation status for installed skills', async () => {
    // Setup package.json with skills
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        agentskills: {
          'installed-skill': 'github:user/repo',
          'not-installed': 'file:./somewhere'
        }
      }, null, 2)
    );

    // Create installed skill
    const skillsDir = join(testDir, '.agentskills', 'skills', 'installed-skill');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(
      join(skillsDir, 'SKILL.md'),
      `---
name: Installed Skill
description: Test
arguments: []
---
Test`
    );

    const output = await listCommand();
    expect(output).toContain('installed-skill');
    expect(output).toContain('✓'); // or some indicator that it's installed
    expect(output).toContain('not-installed');
  });

  it('should handle missing package.json', async () => {
    const output = await listCommand();
    expect(output).toContain('No package.json found');
  });
});
