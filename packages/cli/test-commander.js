import { Command } from "commander";

const program = new Command();
program.name("agentskills").version("1.0.0");

const createCmd = new Command("create");
createCmd.argument("<name>", "Name").action((name, opts) => {
  console.log("Create action:", name, opts);
});

program.addCommand(createCmd);

// Default (no options)
console.log("Test with default options (no from):");
try {
  await program.parseAsync(["node", "agentskills", "create", "my-skill"]);
  console.log("Success!");
} catch (e) {
  console.log("Error:", e.message);
}
