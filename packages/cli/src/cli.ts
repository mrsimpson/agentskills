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

  // Set program metadata and configure help behavior
  program
    .name("agentskills")
    .version("0.1.0")
    .description("Agent Skills CLI for managing skills")
    .configureHelp({
      sortSubcommands: true,
      sortOptions: true
    });

  // Create "list" command
  const listCommandDef = new Command("list")
    .description("List all configured skills")
    .option(
      "-g, --global",
      "List only global skills (default: show merged local + global)"
    )
    .action(async (options) => {
      try {
        const output = await listCommand({ global: options.global });
        console.log(output);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Create "install" command
  const installCommandDef = new Command("install")
    .description("Install skills from package.json")
    .option(
      "--with-mcp",
      "Automatically install missing MCP server dependencies"
    )
    .option(
      "--agent <name>",
      "Specify MCP agent to configure (claude, cline, cursor, continue, junie, kiro, opencode, zed, vscode)"
    )
    .option(
      "-g, --global",
      "Install only global skills (default: install merged local + global)"
    )
    .action(async (options) => {
      try {
        await installCommand({
          cwd: process.cwd(),
          withMcp: options.withMcp,
          agent: options.agent,
          global: options.global
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Create "add" command
  const addCommandDef = new Command("add")
    .description(
      "Validate a skill and add it to package.json (run 'install' to install)"
    )
    .argument("<name>", "Skill name (used as the install directory)")
    .argument("<spec>", "Skill source specifier (see supported formats below)")
    .option(
      "-g, --global",
      "Add to global config instead of local package.json"
    )
    .showHelpAfterError("(add --help for additional information)")
    .addHelpText(
      "after",
      `
Validates the skill configuration (spec format, SKILL.md presence, metadata) and
adds it to package.json only if validation succeeds. Run 'agentskills install'
afterwards to download and install all configured skills.

Supported spec formats:

  GitHub shorthand (subdirectory):
    github:user/repo/path/to/skill           install from subdirectory
    github:user/repo/path/to/skill#v1.0.0    with tag or branch

  GitHub with path: attribute (npm standard):
    github:user/repo#path:skills/my-skill
    github:user/repo#v1.0.0::path:skills/my-skill

  Git URL:
    git+https://github.com/org/repo.git#v1.0.0
    git+https://github.com/org/repo.git#v1.0.0::path:skills/my-skill
    git+ssh://git@github.com/org/repo.git#v1.0.0

  npm package:
    @org/my-skill
    my-skill@1.2.0

  npm package with subdirectory path:
    @org/monorepo::path:skills/my-skill
    @org/monorepo@1.0.0::path:skills/my-skill
    my-package::path:skills/my-skill

  Local path:
    file:./skills/custom-skill
    file:/absolute/path/to/skill

  Tarball URL:
    https://example.com/skill.tgz

Examples:
  $ agentskills add git-workflow github:anthropics/agent-skills/skills/git-workflow
  $ agentskills add my-skill git+https://github.com/org/repo.git#v2.0.0::path:skills/my-skill
  $ agentskills add local file:./team-skills/custom
  $ agentskills add --global common-skill github:org/skills/common`
    )
    .action(async (name, spec, options) => {
      try {
        await addCommand(name, spec, {
          cwd: process.cwd(),
          global: options.global
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
