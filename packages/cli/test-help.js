import { Command, Option } from "commander";

const program = new Command();
program
  .name("agentskills")
  .version("1.0.0")
  .addOption(new Option("-h, --help", "Display help"));

console.log("Options:", program.options);
