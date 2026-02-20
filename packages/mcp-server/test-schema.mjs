import { SkillRegistry } from "@agentskills/core";
import { MCPServer } from "./dist/server.js";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function test() {
  const tempDir = await fs.mkdtemp(join(tmpdir(), "agentskills-test-"));
  const skillsDir = join(tempDir, ".agentskills", "skills");
  await fs.mkdir(skillsDir, { recursive: true });

  const exampleSkillDir = join(skillsDir, "example-skill");
  await fs.mkdir(exampleSkillDir);
  await fs.writeFile(
    join(exampleSkillDir, "SKILL.md"),
    `---
name: example-skill
description: An example skill
---

# Example Skill`
  );

  const registry = new SkillRegistry();
  await registry.loadSkills(skillsDir);

  const server = new MCPServer(registry);
  const tools = server.getTools();
  console.log("Tools from getTools():", JSON.stringify(tools, null, 2));

  await fs.rm(tempDir, { recursive: true, force: true });
}

test().catch(console.error);
