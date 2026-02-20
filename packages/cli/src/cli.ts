import { Command } from 'commander';
import { installCommand } from './commands/install.js';
import { addCommand } from './commands/add.js';

/**
 * Creates the main CLI program
 */
export function createCLI(): Command {
  // Create main program
  const program = new Command();

  // Set program metadata
  program
    .name('agentskills')
    .version('0.1.0')
    .description('Agent Skills CLI for managing skills')
    .option('-h, --help', 'Display help for command');

  // Create "create" command
  const createCommand = new Command('create')
    .description('Create a new skill from a template')
    .argument('<name>', 'Name of the skill to create')
    .option('-t, --template <name>', 'Template to use', 'basic')
    .option('-p, --path <path>', 'Path where to create the skill', '.')
    .action((name, options, command) => {
      // Stub action handler
    });

  // Create "validate" command
  const validateCommand = new Command('validate')
    .description('Validate a skill definition')
    .argument('[path]', 'Path to the skill to validate')
    .option('--strict', 'Enable strict validation mode')
    .option('--fix', 'Automatically fix validation issues')
    .action((path, options, command) => {
      // Stub action handler
    });

  // Create "list" command
  const listCommand = new Command('list')
    .description('List all available skills')
    .option('-f, --format <type>', 'Output format', 'table')
    .option('--filter <query>', 'Filter skills by query')
    .action((options, command) => {
      // Stub action handler
    });

  // Create "config" command
  const configCommand = new Command('config')
    .description('Manage CLI configuration')
    .argument('<action>', 'Configuration action to perform')
    .action((action, options, command) => {
      // Stub action handler
    });

  // Create "install" command
  const installCommandDef = new Command('install')
    .description('Install skills from package.json')
    .option('--cwd <path>', 'Working directory', process.cwd())
    .action(async (options) => {
      try {
        await installCommand({ cwd: options.cwd });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Create "add" command
  const addCommandDef = new Command('add')
    .description('Add a skill to package.json and install it')
    .argument('<name>', 'Skill name')
    .argument('<spec>', 'Skill spec (github:user/repo, git+https://..., file:...)')
    .option('--cwd <path>', 'Working directory', process.cwd())
    .option('--skip-install', 'Only update package.json without installing', false)
    .action(async (name, spec, options) => {
      try {
        await addCommand(name, spec, { cwd: options.cwd, skipInstall: options.skipInstall });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Register all commands
  program.addCommand(createCommand);
  program.addCommand(validateCommand);
  program.addCommand(listCommand);
  program.addCommand(configCommand);
  program.addCommand(installCommandDef);
  program.addCommand(addCommandDef);

  return program;
}
