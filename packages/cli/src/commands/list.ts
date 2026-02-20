import { PackageConfigManager } from '@agentskills/core';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export async function listCommand(): Promise<string> {
  const packageJsonPath = join(process.cwd(), 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    return chalk.yellow('No package.json found in current directory');
  }

  const configManager = new PackageConfigManager(process.cwd());
  const config = await configManager.loadConfig();

  if (Object.keys(config.skills).length === 0) {
    return chalk.yellow('No skills configured in package.json');
  }

  const lines: string[] = [chalk.bold('\nConfigured Skills:\n')];
  const skillsDir = join(process.cwd(), '.agentskills', 'skills');

  for (const [name, spec] of Object.entries(config.skills)) {
    const skillPath = join(skillsDir, name, 'SKILL.md');
    const isInstalled = existsSync(skillPath);
    const status = isInstalled ? chalk.green('✓') : chalk.gray('○');
    
    lines.push(`${status} ${chalk.cyan(name)}`);
    lines.push(`  ${chalk.gray(spec)}`);
  }

  return lines.join('\n');
}

export function registerListCommand(program: any): void {
  program
    .command('list')
    .description('List configured skills')
    .action(async () => {
      try {
        const output = await listCommand();
        console.log(output);
      } catch (error) {
        console.error(chalk.red('Error listing skills:'), error);
        process.exit(1);
      }
    });
}
