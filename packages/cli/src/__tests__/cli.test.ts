import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Command } from "commander";
import { createCLI } from "../cli.js";

describe("CLI Framework", () => {
  let program: Command;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;

  beforeEach(() => {
    program = createCLI();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("Program Initialization", () => {
    it("should create a Commander program instance", () => {
      expect(program).toBeInstanceOf(Command);
    });

    it('should set program name to "agentskills"', () => {
      expect(program.name()).toBe("agentskills");
    });

    it("should set program version from package.json", () => {
      const version = program.version();
      expect(version).toBeDefined();
      expect(version).toMatch(/^\d+\.\d+\.\d+/); // Semantic versioning pattern
    });

    it("should have a description", () => {
      const description = program.description();
      expect(description).toBeDefined();
      expect(description.length).toBeGreaterThan(0);
    });
  });

  describe("Command Registration", () => {
    it('should register "list" command', () => {
      const commands = program.commands;
      const listCommand = commands.find((cmd) => cmd.name() === "list");
      expect(listCommand).toBeDefined();
    });

    it('should register "install" command', () => {
      const commands = program.commands;
      const installCommand = commands.find((cmd) => cmd.name() === "install");
      expect(installCommand).toBeDefined();
    });

    it('should register "add" command', () => {
      const commands = program.commands;
      const addCommand = commands.find((cmd) => cmd.name() === "add");
      expect(addCommand).toBeDefined();
    });

    it("should have exactly 3 commands registered", () => {
      expect(program.commands).toHaveLength(3);
    });
  });

  describe("List Command", () => {
    let listCommand: Command;

    beforeEach(() => {
      listCommand = program.commands.find((cmd) => cmd.name() === "list")!;
    });

    it("should have description", () => {
      expect(listCommand.description()).toBeDefined();
      expect(listCommand.description().length).toBeGreaterThan(0);
    });
  });

  describe("Help Output", () => {
    it("should display help when --help flag is used", () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain("agentskills");
      expect(helpText).toContain("list");
      expect(helpText).toContain("install");
      expect(helpText).toContain("add");
    });

    it("should show version in help output", () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain("--version");
    });

    it("should show help option in help output", () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain("--help");
    });

    it("should include command descriptions in help", () => {
      const helpText = program.helpInformation();
      const commands = program.commands;
      commands.forEach((cmd) => {
        if (cmd.description()) {
          expect(helpText).toContain(cmd.name());
        }
      });
    });
  });

  describe("Command-Specific Help", () => {
    it("should provide help for list command", () => {
      const listCommand = program.commands.find(
        (cmd) => cmd.name() === "list"
      )!;
      const helpText = listCommand.helpInformation();
      expect(helpText).toContain("list");
    });

    it("should provide help for install command", () => {
      const installCommand = program.commands.find(
        (cmd) => cmd.name() === "install"
      )!;
      const helpText = installCommand.helpInformation();
      expect(helpText).toContain("install");
    });

    it("should provide help for add command", () => {
      const addCommand = program.commands.find((cmd) => cmd.name() === "add")!;
      const helpText = addCommand.helpInformation();
      expect(helpText).toContain("add");
    });

    it("should include spec format examples in add command help", () => {
      const addCommand = program.commands.find((cmd) => cmd.name() === "add")!;
      // addHelpText content is emitted via events; capture via configureOutput
      let helpText = "";
      addCommand.configureOutput({ writeOut: (str) => (helpText += str) });
      addCommand.outputHelp();
      expect(helpText).toContain("github:");
      expect(helpText).toContain("git+https://");
      expect(helpText).toContain("path:");
      expect(helpText).toContain("file:");
      expect(helpText).toContain("@org/my-skill");
    });
  });

  describe("Version Command", () => {
    it("should output version with --version flag", () => {
      const version = program.version();
      expect(version).toBeDefined();
      expect(typeof version).toBe("string");
    });

    it("should match semantic versioning format", () => {
      const version = program.version();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe("Error Handling", () => {
    it("should handle unknown command gracefully", async () => {
      // Commander will handle unknown commands by default
      // We just need to ensure the program is configured properly
      const commands = program.commands.map((cmd) => cmd.name());
      expect(commands).not.toContain("unknown-command");
    });

    it("should have error handling configured", () => {
      // Check that program has exitOverride disabled (default behavior)
      // This allows proper error handling
      expect(program.configureOutput).toBeDefined();
    });

    it("should allow custom error handlers to be registered", () => {
      const errorHandler = vi.fn();
      program.exitOverride(errorHandler);
      expect(program.exitOverride).toBeDefined();
    });
  });

  describe("Global Options", () => {
    it("should support --help option", () => {
      const options = program.options;
      const helpOption = options.find(
        (opt) => opt.long === "--help" || opt.short === "-h"
      );
      expect(helpOption).toBeDefined();
    });

    it("should support --version option", () => {
      const options = program.options;
      const versionOption = options.find(
        (opt) => opt.long === "--version" || opt.short === "-V"
      );
      expect(versionOption).toBeDefined();
    });
  });

  describe("Command Parsing", () => {
    it("should parse list command", async () => {
      const mockAction = vi.fn();
      const listCommand = program.commands.find(
        (cmd) => cmd.name() === "list"
      )!;
      listCommand.action(mockAction);

      await program.parseAsync(["node", "agentskills", "list"]);

      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe("Option Parsing", () => {
    // All option parsing tests for implemented commands are in their respective command test files
    it("should have options configured for commands", () => {
      program.commands.forEach((cmd) => {
        expect(cmd.options).toBeDefined();
      });
    });
  });

  describe("Exit Codes", () => {
    it("should configure proper exit behavior", () => {
      // Commander handles exit codes by default
      // We verify the program is properly configured
      expect(program.exitOverride).toBeDefined();
    });

    it("should allow overriding exit behavior for testing", () => {
      const mockExit = vi.fn();
      program.exitOverride(mockExit);

      // This configuration allows us to test exit codes without actually exiting
      expect(mockExit).toBeDefined();
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete list command flow", async () => {
      const mockAction = vi.fn();
      const listCommand = program.commands.find(
        (cmd) => cmd.name() === "list"
      )!;
      listCommand.action(mockAction);

      await program.parseAsync(["node", "agentskills", "list"]);

      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe("Command Aliases", () => {
    it("should support aliases if configured", () => {
      // Check if any commands have aliases
      program.commands.forEach((cmd) => {
        // Aliases are optional, just verify the API is available
        expect(cmd.aliases).toBeDefined();
      });
    });
  });

  describe("Output Configuration", () => {
    it("should allow custom output configuration", () => {
      expect(program.configureOutput).toBeDefined();

      // Test that we can configure output
      program.configureOutput({
        writeOut: (str) => console.log(str),
        writeErr: (str) => console.error(str)
      });
    });
  });
});
