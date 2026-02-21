import { Command } from "commander";
import { installCommand } from "./commands/install.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";

/**
 * Creates the main CLI program
 */
export function createCLI(): Command {
  // Create main program
  const program = new Command();

  // Set program metadata
  program
    .name("agentskills")
    .version("0.1.0")
    .description("Agent Skills CLI for managing skills")
    .option("-h, --help", "Display help for command");

  // Create "list" command
  const listCommandDef = new Command("list")
    .description("List all configured skills")
    .action(async () => {
      try {
        const output = await listCommand();
        console.log(output);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Create "install" command
  const installCommandDef = new Command("install")
    .description("Install skills from package.json")
    .action(async () => {
      try {
        await installCommand({ cwd: process.cwd() });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Create "add" command
  const addCommandDef = new Command("add")
    .description("Add a skill to package.json and install it")
    .argument("<name>", "Skill name")
    .argument(
      "<spec>",
      "Skill spec (github:user/repo, git+https://..., file:...)"
    )
    .option(
      "--skip-install",
      "Only update package.json without installing",
      false
    )
    .action(async (name, spec, options) => {
      try {
        await addCommand(name, spec, {
          cwd: process.cwd(),
          skipInstall: options.skipInstall
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Register all commands
  program.addCommand(listCommandDef);
  program.addCommand(installCommandDef);
  program.addCommand(addCommandDef);

  return program;
}
