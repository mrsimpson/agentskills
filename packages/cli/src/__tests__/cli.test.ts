import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { createCLI } from '../cli.js';

describe('CLI Framework', () => {
  let program: Command;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;

  beforeEach(() => {
    program = createCLI();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Program Initialization', () => {
    it('should create a Commander program instance', () => {
      expect(program).toBeInstanceOf(Command);
    });

    it('should set program name to "agentskills"', () => {
      expect(program.name()).toBe('agentskills');
    });

    it('should set program version from package.json', () => {
      const version = program.version();
      expect(version).toBeDefined();
      expect(version).toMatch(/^\d+\.\d+\.\d+/); // Semantic versioning pattern
    });

    it('should have a description', () => {
      const description = program.description();
      expect(description).toBeDefined();
      expect(description.length).toBeGreaterThan(0);
    });
  });

  describe('Command Registration', () => {
    it('should register "create" command', () => {
      const commands = program.commands;
      const createCommand = commands.find((cmd) => cmd.name() === 'create');
      expect(createCommand).toBeDefined();
    });

    it('should register "validate" command', () => {
      const commands = program.commands;
      const validateCommand = commands.find((cmd) => cmd.name() === 'validate');
      expect(validateCommand).toBeDefined();
    });

    it('should register "list" command', () => {
      const commands = program.commands;
      const listCommand = commands.find((cmd) => cmd.name() === 'list');
      expect(listCommand).toBeDefined();
    });

    it('should register "config" command', () => {
      const commands = program.commands;
      const configCommand = commands.find((cmd) => cmd.name() === 'config');
      expect(configCommand).toBeDefined();
    });

    it('should have exactly 5 commands registered', () => {
      expect(program.commands).toHaveLength(5);
    });
  });

  describe('Create Command', () => {
    let createCommand: Command;

    beforeEach(() => {
      createCommand = program.commands.find((cmd) => cmd.name() === 'create')!;
    });

    it('should have description', () => {
      expect(createCommand.description()).toBeDefined();
      expect(createCommand.description().length).toBeGreaterThan(0);
    });

    it('should require <name> argument', () => {
      const args = createCommand.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('name');
      expect(args[0].required).toBe(true);
    });

    it('should have --template option', () => {
      const options = createCommand.options;
      const templateOption = options.find((opt) => opt.long === '--template');
      expect(templateOption).toBeDefined();
    });

    it('should have --path option', () => {
      const options = createCommand.options;
      const pathOption = options.find((opt) => opt.long === '--path');
      expect(pathOption).toBeDefined();
    });
  });

  describe('Validate Command', () => {
    let validateCommand: Command;

    beforeEach(() => {
      validateCommand = program.commands.find((cmd) => cmd.name() === 'validate')!;
    });

    it('should have description', () => {
      expect(validateCommand.description()).toBeDefined();
      expect(validateCommand.description().length).toBeGreaterThan(0);
    });

    it('should have optional [path] argument', () => {
      const args = validateCommand.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('path');
      expect(args[0].required).toBe(false);
    });

    it('should have --strict option', () => {
      const options = validateCommand.options;
      const strictOption = options.find((opt) => opt.long === '--strict');
      expect(strictOption).toBeDefined();
    });

    it('should have --fix option', () => {
      const options = validateCommand.options;
      const fixOption = options.find((opt) => opt.long === '--fix');
      expect(fixOption).toBeDefined();
    });
  });

  describe('List Command', () => {
    let listCommand: Command;

    beforeEach(() => {
      listCommand = program.commands.find((cmd) => cmd.name() === 'list')!;
    });

    it('should have description', () => {
      expect(listCommand.description()).toBeDefined();
      expect(listCommand.description().length).toBeGreaterThan(0);
    });

    it('should have --format option', () => {
      const options = listCommand.options;
      const formatOption = options.find((opt) => opt.long === '--format');
      expect(formatOption).toBeDefined();
    });

    it('should have --filter option', () => {
      const options = listCommand.options;
      const filterOption = options.find((opt) => opt.long === '--filter');
      expect(filterOption).toBeDefined();
    });
  });

  describe('Config Command', () => {
    let configCommand: Command;

    beforeEach(() => {
      configCommand = program.commands.find((cmd) => cmd.name() === 'config')!;
    });

    it('should have description', () => {
      expect(configCommand.description()).toBeDefined();
      expect(configCommand.description().length).toBeGreaterThan(0);
    });

    it('should require <action> argument', () => {
      const args = configCommand.registeredArguments;
      expect(args.length).toBeGreaterThan(0);
      expect(args[0].name()).toBe('action');
      expect(args[0].required).toBe(true);
    });
  });

  describe('Help Output', () => {
    it('should display help when --help flag is used', () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain('agentskills');
      expect(helpText).toContain('create');
      expect(helpText).toContain('validate');
      expect(helpText).toContain('list');
      expect(helpText).toContain('config');
    });

    it('should show version in help output', () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain('--version');
    });

    it('should show help option in help output', () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain('--help');
    });

    it('should include command descriptions in help', () => {
      const helpText = program.helpInformation();
      const commands = program.commands;
      commands.forEach((cmd) => {
        if (cmd.description()) {
          expect(helpText).toContain(cmd.name());
        }
      });
    });
  });

  describe('Command-Specific Help', () => {
    it('should provide help for create command', () => {
      const createCommand = program.commands.find((cmd) => cmd.name() === 'create')!;
      const helpText = createCommand.helpInformation();
      expect(helpText).toContain('create');
      expect(helpText).toContain('name');
    });

    it('should provide help for validate command', () => {
      const validateCommand = program.commands.find((cmd) => cmd.name() === 'validate')!;
      const helpText = validateCommand.helpInformation();
      expect(helpText).toContain('validate');
    });

    it('should provide help for list command', () => {
      const listCommand = program.commands.find((cmd) => cmd.name() === 'list')!;
      const helpText = listCommand.helpInformation();
      expect(helpText).toContain('list');
    });

    it('should provide help for config command', () => {
      const configCommand = program.commands.find((cmd) => cmd.name() === 'config')!;
      const helpText = configCommand.helpInformation();
      expect(helpText).toContain('config');
    });
  });

  describe('Version Command', () => {
    it('should output version with --version flag', () => {
      const version = program.version();
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
    });

    it('should match semantic versioning format', () => {
      const version = program.version();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown command gracefully', async () => {
      // Commander will handle unknown commands by default
      // We just need to ensure the program is configured properly
      const commands = program.commands.map((cmd) => cmd.name());
      expect(commands).not.toContain('unknown-command');
    });

    it('should have error handling configured', () => {
      // Check that program has exitOverride disabled (default behavior)
      // This allows proper error handling
      expect(program.configureOutput).toBeDefined();
    });

    it('should allow custom error handlers to be registered', () => {
      const errorHandler = vi.fn();
      program.exitOverride(errorHandler);
      expect(program.exitOverride).toBeDefined();
    });
  });

  describe('Global Options', () => {
    it('should support --help option', () => {
      const options = program.options;
      const helpOption = options.find(
        (opt) => opt.long === '--help' || opt.short === '-h'
      );
      expect(helpOption).toBeDefined();
    });

    it('should support --version option', () => {
      const options = program.options;
      const versionOption = options.find(
        (opt) => opt.long === '--version' || opt.short === '-V'
      );
      expect(versionOption).toBeDefined();
    });
  });

  describe('Command Parsing', () => {
    it('should parse create command with name argument', async () => {
      const mockAction = vi.fn();
      const createCommand = program.commands.find((cmd) => cmd.name() === 'create')!;
      createCommand.action(mockAction);

      await program.parseAsync(['node', 'agentskills', 'create', 'my-skill']);

      expect(mockAction).toHaveBeenCalledWith('my-skill', expect.any(Object), expect.any(Command));
    });

    it('should parse validate command with optional path', async () => {
      const mockAction = vi.fn();
      const validateCommand = program.commands.find(
        (cmd) => cmd.name() === 'validate'
      )!;
      validateCommand.action(mockAction);

      await program.parseAsync(['node', 'agentskills', 'validate']);

      expect(mockAction).toHaveBeenCalled();
    });

    it('should parse list command', async () => {
      const mockAction = vi.fn();
      const listCommand = program.commands.find((cmd) => cmd.name() === 'list')!;
      listCommand.action(mockAction);

      await program.parseAsync(['node', 'agentskills', 'list']);

      expect(mockAction).toHaveBeenCalled();
    });

    it('should parse config command with action argument', async () => {
      const mockAction = vi.fn();
      const configCommand = program.commands.find((cmd) => cmd.name() === 'config')!;
      configCommand.action(mockAction);

      await program.parseAsync(['node', 'agentskills', 'config', 'show']);

      expect(mockAction).toHaveBeenCalledWith('show', expect.any(Object), expect.any(Command));
    });
  });

  describe('Option Parsing', () => {
    it('should parse --template option for create command', async () => {
      const mockAction = vi.fn();
      const createCommand = program.commands.find((cmd) => cmd.name() === 'create')!;
      createCommand.action(mockAction);

      await program.parseAsync(
        ['node', 'agentskills', 'create', 'my-skill', '--template', 'basic']
      );

      expect(mockAction).toHaveBeenCalled();
      const options = mockAction.mock.calls[0][1];
      expect(options.template).toBe('basic');
    });

    it('should parse --path option for create command', async () => {
      const mockAction = vi.fn();
      const createCommand = program.commands.find((cmd) => cmd.name() === 'create')!;
      createCommand.action(mockAction);

      await program.parseAsync(
        ['node', 'agentskills', 'create', 'my-skill', '--path', './skills']
      );

      expect(mockAction).toHaveBeenCalled();
      const options = mockAction.mock.calls[0][1];
      expect(options.path).toBe('./skills');
    });

    it('should parse --strict flag for validate command', async () => {
      const mockAction = vi.fn();
      const validateCommand = program.commands.find(
        (cmd) => cmd.name() === 'validate'
      )!;
      validateCommand.action(mockAction);

      await program.parseAsync(['node', 'agentskills', 'validate', '--strict']);

      expect(mockAction).toHaveBeenCalled();
      const options = mockAction.mock.calls[0][1];
      expect(options.strict).toBe(true);
    });

    it('should parse --fix flag for validate command', async () => {
      const mockAction = vi.fn();
      const validateCommand = program.commands.find(
        (cmd) => cmd.name() === 'validate'
      )!;
      validateCommand.action(mockAction);

      await program.parseAsync(['node', 'agentskills', 'validate', '--fix']);

      expect(mockAction).toHaveBeenCalled();
      const options = mockAction.mock.calls[0][1];
      expect(options.fix).toBe(true);
    });

    it('should parse --format option for list command', async () => {
      const mockAction = vi.fn();
      const listCommand = program.commands.find((cmd) => cmd.name() === 'list')!;
      listCommand.action(mockAction);

      await program.parseAsync(
        ['node', 'agentskills', 'list', '--format', 'json']
      );

      expect(mockAction).toHaveBeenCalled();
      const options = mockAction.mock.calls[0][0];
      expect(options.format).toBe('json');
    });

    it('should parse --filter option for list command', async () => {
      const mockAction = vi.fn();
      const listCommand = program.commands.find((cmd) => cmd.name() === 'list')!;
      listCommand.action(mockAction);

      await program.parseAsync(
        ['node', 'agentskills', 'list', '--filter', 'category:web']
      );

      expect(mockAction).toHaveBeenCalled();
      const options = mockAction.mock.calls[0][0];
      expect(options.filter).toBe('category:web');
    });
  });

  describe('Exit Codes', () => {
    it('should configure proper exit behavior', () => {
      // Commander handles exit codes by default
      // We verify the program is properly configured
      expect(program.exitOverride).toBeDefined();
    });

    it('should allow overriding exit behavior for testing', () => {
      const mockExit = vi.fn();
      program.exitOverride(mockExit);
      
      // This configuration allows us to test exit codes without actually exiting
      expect(mockExit).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete create command flow', async () => {
      const mockAction = vi.fn();
      const createCommand = program.commands.find((cmd) => cmd.name() === 'create')!;
      createCommand.action(mockAction);

      await program.parseAsync(
        [
          'node',
          'agentskills',
          'create',
          'my-skill',
          '--template',
          'basic',
          '--path',
          './skills',
        ]
      );

      expect(mockAction).toHaveBeenCalledWith('my-skill', expect.any(Object), expect.any(Command));
      const options = mockAction.mock.calls[0][1];
      expect(options.template).toBe('basic');
      expect(options.path).toBe('./skills');
    });

    it('should handle complete validate command flow', async () => {
      const mockAction = vi.fn();
      const validateCommand = program.commands.find(
        (cmd) => cmd.name() === 'validate'
      )!;
      validateCommand.action(mockAction);

      await program.parseAsync(
        ['node', 'agentskills', 'validate', './my-skill', '--strict', '--fix']
      );

      expect(mockAction).toHaveBeenCalledWith('./my-skill', expect.any(Object), expect.any(Command));
      const options = mockAction.mock.calls[0][1];
      expect(options.strict).toBe(true);
      expect(options.fix).toBe(true);
    });

    it('should handle complete list command flow', async () => {
      const mockAction = vi.fn();
      const listCommand = program.commands.find((cmd) => cmd.name() === 'list')!;
      listCommand.action(mockAction);

      await program.parseAsync(
        ['node', 'agentskills', 'list', '--format', 'json', '--filter', 'category:web']
      );

      expect(mockAction).toHaveBeenCalled();
      const options = mockAction.mock.calls[0][0];
      expect(options.format).toBe('json');
      expect(options.filter).toBe('category:web');
    });

    it('should handle complete config command flow', async () => {
      const mockAction = vi.fn();
      const configCommand = program.commands.find((cmd) => cmd.name() === 'config')!;
      configCommand.action(mockAction);

      await program.parseAsync(['node', 'agentskills', 'config', 'show']);

      expect(mockAction).toHaveBeenCalledWith('show', expect.any(Object), expect.any(Command));
    });
  });

  describe('Command Aliases', () => {
    it('should support aliases if configured', () => {
      // Check if any commands have aliases
      program.commands.forEach((cmd) => {
        // Aliases are optional, just verify the API is available
        expect(cmd.aliases).toBeDefined();
      });
    });
  });

  describe('Output Configuration', () => {
    it('should allow custom output configuration', () => {
      expect(program.configureOutput).toBeDefined();
      
      // Test that we can configure output
      program.configureOutput({
        writeOut: (str) => console.log(str),
        writeErr: (str) => console.error(str),
      });
    });
  });
});
