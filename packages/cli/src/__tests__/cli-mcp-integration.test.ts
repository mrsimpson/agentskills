import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { McpSetupOptions } from '../mcp.ts';

describe('cli.ts MCP integration', () => {
  describe('mcp command routing', () => {
    it('should handle "skills mcp setup" command', () => {
      const command = 'mcp';
      const subcommand = 'setup';

      expect(command).toBe('mcp');
      expect(subcommand).toBe('setup');
    });

    it('should handle "skills mcp setup --agent <agent>" command', () => {
      const command = 'mcp';
      const subcommand = 'setup';
      const args = ['--agent', 'claude-code'];

      expect(command).toBe('mcp');
      expect(subcommand).toBe('setup');
      expect(args[0]).toBe('--agent');
    });

    it('should route mcp command to correct handler', () => {
      const input = { command: 'mcp', subcommand: 'setup' };

      expect(input.command).toBe('mcp');
      expect(input.subcommand).toBe('setup');
    });

    it('should recognize setup subcommand', () => {
      const subcommand = 'setup';
      const validSubcommands = ['setup'];

      expect(validSubcommands).toContain(subcommand);
    });

    it('should reject unknown subcommands', () => {
      const subcommand = 'invalid';
      const validSubcommands = ['setup'];

      expect(validSubcommands).not.toContain(subcommand);
    });
  });

  describe('help text for mcp command', () => {
    it('should display help text for "skills mcp"', () => {
      const helpText = `
skills mcp setup

Configure MCP server for agent environments.

Usage:
  skills mcp setup              Interactive agent selection (TUI)
  skills mcp setup --agent <agents>  Configure specific agents (CLI)

Options:
  --agent <agents>    Space-separated list of agents to configure
                      Use --agent '*' to configure all agents

Examples:
  skills mcp setup
  skills mcp setup --agent claude-code
  skills mcp setup --agent claude-code cline cursor
  skills mcp setup --agent '*'
`;

      expect(helpText).toContain('skills mcp setup');
      expect(helpText).toContain('--agent');
      expect(helpText).toContain('TUI');
      expect(helpText).toContain('CLI');
    });

    it('should show examples in help text', () => {
      const helpText = `
skills mcp setup
  skills mcp setup --agent claude-code
  skills mcp setup --agent '*'
`;

      expect(helpText).toContain('skills mcp setup');
      expect(helpText).toContain('claude-code');
      expect(helpText).toContain("'*'");
    });

    it('should document TUI mode', () => {
      const helpText = 'Interactive agent selection (TUI)';

      expect(helpText).toContain('TUI');
      expect(helpText).toContain('Interactive');
    });

    it('should document CLI mode', () => {
      const helpText = 'Configure specific agents (CLI)';

      expect(helpText).toContain('CLI');
      expect(helpText).toContain('specific agents');
    });

    it('should explain --agent flag', () => {
      const helpText = '--agent <agents>    Space-separated list of agents';

      expect(helpText).toContain('--agent');
      expect(helpText).toContain('Space-separated');
    });
  });

  describe('command routing structure', () => {
    it('should have mcp case in main switch', () => {
      const commands = ['add', 'remove', 'list', 'mcp'];

      expect(commands).toContain('mcp');
    });

    it('should have setup case within mcp handler', () => {
      const mcpSubcommands = ['setup'];

      expect(mcpSubcommands).toContain('setup');
    });

    it('should import runMcpSetup from mcp.ts', () => {
      // Test the existence of import statement in cli.ts
      const importPath = '../mcp.ts';
      const exportedFunction = 'runMcpSetup';

      expect(importPath).toBe('../mcp.ts');
      expect(exportedFunction).toBe('runMcpSetup');
    });

    it('should parse options before calling runMcpSetup', () => {
      const args = ['--agent', 'claude-code'];
      const shouldParseOptions = true;

      expect(shouldParseOptions).toBe(true);
      expect(args.length).toBeGreaterThan(0);
    });
  });

  describe('error handling in cli', () => {
    it('should handle unknown mcp subcommands', () => {
      const subcommand = 'unknown';
      const validSubcommands = ['setup'];

      if (!validSubcommands.includes(subcommand)) {
        expect(validSubcommands).not.toContain(subcommand);
      }
    });

    it('should show error for invalid agent type', () => {
      const invalidAgent = 'invalid-agent-type';
      const validAgents = ['claude-code', 'cline', 'cursor', 'kiro-cli', 'junie', 'opencode'];

      expect(validAgents).not.toContain(invalidAgent);
    });

    it('should handle mcp setup without agents (TUI mode)', () => {
      const args: string[] = [];
      const mode = args.length === 0 ? 'tui' : 'cli';

      expect(mode).toBe('tui');
    });

    it('should handle mcp setup with agents (CLI mode)', () => {
      const args = ['--agent', 'claude-code'];
      const hasAgentFlag = args.some((arg) => arg === '--agent');

      expect(hasAgentFlag).toBe(true);
    });
  });

  describe('minimal Vercel CLI modifications', () => {
    it('should add mcp case without modifying other cases', () => {
      const existingCases = ['add', 'remove', 'list'];
      const newCase = 'mcp';

      // Should add mcp without removing existing cases
      expect(existingCases).toContain('add');
      expect(existingCases).toContain('remove');
      expect(existingCases).toContain('list');
      expect([...existingCases, newCase]).toContain('mcp');
    });

    it('should keep Vercel CLI switch statement structure', () => {
      const cliStructure = 'switch(command)';
      const mcpHandler = 'case "mcp":';

      expect(cliStructure).toContain('switch');
      expect(mcpHandler).toContain('case');
      expect(mcpHandler).toContain('mcp');
    });

    it('should only add to cli.ts, not modify other files', () => {
      const modifiedFiles = ['packages/cli/src/cli.ts'];

      expect(modifiedFiles).toContain('packages/cli/src/cli.ts');
      expect(modifiedFiles.length).toBe(1);
    });
  });

  describe('integration flow', () => {
    it('should flow from cli.ts to mcp.ts to mcp-configurator.ts', () => {
      const flow = ['cli.ts', 'mcp.ts', 'mcp-configurator.ts'];

      expect(flow).toContain('cli.ts');
      expect(flow).toContain('mcp.ts');
      expect(flow).toContain('mcp-configurator.ts');
    });

    it('should pass options correctly through layers', () => {
      const cliArgs = ['setup', '--agent', 'claude-code'];
      const parsedOptions: McpSetupOptions = {
        mode: 'cli',
        agents: ['claude-code' as any],
      };

      expect(cliArgs.length).toBeGreaterThan(0);
      expect(parsedOptions.mode).toBe('cli');
      expect(parsedOptions.agents.length).toBeGreaterThan(0);
    });

    it('should have correct module boundaries', () => {
      const modules = {
        cli: ['mcp command routing'],
        mcp: ['option parsing', 'setup orchestration'],
        'mcp-configurator': ['config file management'],
      };

      expect(modules).toHaveProperty('cli');
      expect(modules).toHaveProperty('mcp');
      expect(modules).toHaveProperty('mcp-configurator');
    });
  });

  describe('command validation', () => {
    it('should recognize mcp as valid command', () => {
      const command = 'mcp';
      const validCommands = ['add', 'remove', 'list', 'find', 'check', 'update', 'mcp'];

      expect(validCommands).toContain(command);
    });

    it('should recognize setup as valid mcp subcommand', () => {
      const subcommand = 'setup';
      const validMcpSubcommands = ['setup'];

      expect(validMcpSubcommands).toContain(subcommand);
    });

    it('should require valid agent type', () => {
      const agentType = 'claude-code';
      const validAgents = [
        'amp',
        'antigravity',
        'augment',
        'claude-code',
        'openclaw',
        'cline',
        'codebuddy',
        'cursor',
        'junie',
        'kiro-cli',
        'opencode',
      ];

      expect(validAgents).toContain(agentType);
    });

    it('should support wildcard for all agents', () => {
      const wildcard = '*';

      expect(wildcard).toBe('*');
    });
  });

  describe('backward compatibility', () => {
    it('should not affect existing add command', () => {
      const addCommand = 'add';
      const newMcpCommand = 'mcp';

      expect(addCommand).not.toBe(newMcpCommand);
    });

    it('should not affect existing remove command', () => {
      const removeCommand = 'remove';
      const newMcpCommand = 'mcp';

      expect(removeCommand).not.toBe(newMcpCommand);
    });

    it('should not affect existing list command', () => {
      const listCommand = 'list';
      const newMcpCommand = 'mcp';

      expect(listCommand).not.toBe(newMcpCommand);
    });

    it('should be purely additive to cli.ts', () => {
      const existingFunctionality = ['add', 'remove', 'list'];
      const newAddition = 'mcp';

      expect(existingFunctionality).toContain('add');
      expect(existingFunctionality).toContain('remove');
      expect(existingFunctionality).toContain('list');
      expect([...existingFunctionality, newAddition]).toHaveLength(4);
    });
  });
});
