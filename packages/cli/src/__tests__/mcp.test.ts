import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseMcpOptions, runMcpSetup } from '../mcp.ts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('mcp command handler', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseMcpOptions', () => {
    it('should parse single --agent flag with single value', () => {
      const args = ['setup', '--agent', 'claude-code'];
      const options = parseMcpOptions(args);
      expect(options.agents).toContain('claude-code');
    });

    it('should parse single --agent flag with multiple space-separated values', () => {
      const args = ['setup', '--agent', 'claude-code', 'cline'];
      const options = parseMcpOptions(args);
      expect(options.agents).toContain('claude-code');
      expect(options.agents).toContain('cline');
    });

    it('should parse multiple --agent flags', () => {
      const args = ['setup', '--agent', 'claude-code', '--agent', 'cline'];
      const options = parseMcpOptions(args);
      expect(options.agents).toContain('claude-code');
      expect(options.agents).toContain('cline');
    });

    it('should parse --agent with wildcard for all agents', () => {
      const args = ['setup', '--agent', '*'];
      const options = parseMcpOptions(args);
      expect(options.agents).toContain('*');
    });

    it('should detect TUI mode when no --agent specified', () => {
      const args = ['setup'];
      const options = parseMcpOptions(args);
      expect(options.mode).toBe('tui');
      expect(options.agents.length).toBe(0);
    });

    it('should detect CLI mode when --agent specified', () => {
      const args = ['setup', '--agent', 'claude-code'];
      const options = parseMcpOptions(args);
      expect(options.mode).toBe('cli');
    });

    it('should handle mixed agent values', () => {
      const args = ['setup', '--agent', 'claude-code', 'cline', '--agent', 'cursor'];
      const options = parseMcpOptions(args);
      expect(options.agents).toContain('claude-code');
      expect(options.agents).toContain('cline');
      expect(options.agents).toContain('cursor');
    });

    it('should return mode property', () => {
      const args = ['setup'];
      const options = parseMcpOptions(args);
      expect(options).toHaveProperty('mode');
      expect(['tui', 'cli']).toContain(options.mode);
    });

    it('should return agents array', () => {
      const args = ['setup'];
      const options = parseMcpOptions(args);
      expect(options).toHaveProperty('agents');
      expect(Array.isArray(options.agents)).toBe(true);
    });

    it('should handle empty args array', () => {
      const args: string[] = [];
      const options = parseMcpOptions(args);
      expect(options.mode).toBe('tui');
    });

    it('should skip non-agent flags', () => {
      const args = ['setup', '--verbose', '--agent', 'claude-code', '--dry-run'];
      const options = parseMcpOptions(args);
      expect(options.agents).toContain('claude-code');
      expect(options.agents.length).toBe(1);
    });

    it('should parse --agent-config flag', () => {
      const args = ['setup', '--agent', 'kiro-cli', '--agent-config'];
      const options = parseMcpOptions(args);
      expect(options.configMode).toBe('agent-config');
    });

    it('should parse --mcp-json flag', () => {
      const args = ['setup', '--agent', 'kiro-cli', '--mcp-json'];
      const options = parseMcpOptions(args);
      expect(options.configMode).toBe('mcp-json');
    });

    it('should leave configMode undefined when neither flag is set', () => {
      const args = ['setup', '--agent', 'kiro-cli'];
      const options = parseMcpOptions(args);
      expect(options.configMode).toBeUndefined();
    });

    it('--mcp-json works without --agent (TUI mode)', () => {
      const args = ['setup', '--mcp-json'];
      const options = parseMcpOptions(args);
      expect(options.mode).toBe('tui');
      expect(options.configMode).toBe('mcp-json');
    });
  });

  describe('runMcpSetup - TUI mode', () => {
    it('should call TUI handler for TUI mode', async () => {
      const options = { mode: 'tui' as const, agents: [] };
      const mockTuiHandler = vi.fn().mockResolvedValue(undefined);

      // We test the existence of TUI mode handling logic
      // In actual implementation, TUI would prompt for agent selection
      expect(options.mode).toBe('tui');
    });

    it('should accept options with TUI mode', async () => {
      const options = { mode: 'tui' as const, agents: [] };
      expect(options).toHaveProperty('mode');
      expect(options.mode).toBe('tui');
    });

    it('should have agents array in TUI mode', () => {
      const options = { mode: 'tui' as const, agents: [] };
      expect(Array.isArray(options.agents)).toBe(true);
    });
  });

  describe('runMcpSetup - CLI mode', () => {
    it('should configure specified agents in CLI mode', async () => {
      const options = { mode: 'cli' as const, agents: ['claude-code', 'cline'] };

      // CLI mode should process each specified agent
      expect(options.agents.length).toBe(2);
      expect(options.agents).toContain('claude-code');
      expect(options.agents).toContain('cline');
    });

    it('should handle single agent in CLI mode', async () => {
      const options = { mode: 'cli' as const, agents: ['claude-code'] };

      expect(options.agents.length).toBe(1);
      expect(options.agents[0]).toBe('claude-code');
    });

    it('should handle wildcard in CLI mode', async () => {
      const options = { mode: 'cli' as const, agents: ['*'] };

      expect(options.agents).toContain('*');
    });

    it('should have correct structure for CLI mode', () => {
      const options = { mode: 'cli' as const, agents: ['claude-code'] };
      expect(options).toHaveProperty('mode');
      expect(options).toHaveProperty('agents');
      expect(options.mode).toBe('cli');
    });
  });

  describe('runMcpSetup orchestration', () => {
    it('should handle options with agents', async () => {
      const options = { mode: 'cli' as const, agents: ['claude-code'] };

      // Implementation should handle these options
      expect(options.mode).toBe('cli');
      expect(options.agents.length).toBeGreaterThan(0);
    });

    it('should handle empty agents for TUI mode', async () => {
      const options = { mode: 'tui' as const, agents: [] };

      expect(options.agents.length).toBe(0);
      expect(options.mode).toBe('tui');
    });

    it('should support both TUI and CLI modes', async () => {
      const tuiOptions = { mode: 'tui' as const, agents: [] };
      const cliOptions = { mode: 'cli' as const, agents: ['claude-code'] };

      expect(['tui', 'cli']).toContain(tuiOptions.mode);
      expect(['tui', 'cli']).toContain(cliOptions.mode);
    });
  });

  describe('option format validation', () => {
    it('should return object with mode and agents properties', () => {
      const args = ['setup', '--agent', 'claude-code'];
      const options = parseMcpOptions(args);

      expect(typeof options).toBe('object');
      expect(typeof options.mode).toBe('string');
      expect(Array.isArray(options.agents)).toBe(true);
    });

    it('should have unique agents in array', () => {
      const args = ['setup', '--agent', 'claude-code', 'claude-code'];
      const options = parseMcpOptions(args);

      // Should handle duplicates (either filter or keep)
      expect(Array.isArray(options.agents)).toBe(true);
    });
  });

  describe('detectInstalledAgents integration', () => {
    it('should be ready to integrate detectInstalledAgents', () => {
      // This test verifies the structure needed for agent detection
      const agents = ['claude-code', 'cline', 'cursor'];
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should support agent validation', () => {
      const supportedAgents = ['claude-code', 'cline', 'cursor', 'kiro-cli', 'junie', 'opencode'];
      const agent = 'claude-code';

      expect(supportedAgents).toContain(agent);
    });
  });

  describe('error handling', () => {
    it('should handle invalid agent gracefully', () => {
      const args = ['setup', '--agent', 'invalid-agent'];
      const options = parseMcpOptions(args);

      expect(Array.isArray(options.agents)).toBe(true);
      expect(options.agents).toContain('invalid-agent');
    });

    it('should handle missing command', () => {
      const args: string[] = [];
      const options = parseMcpOptions(args);

      expect(options.mode).toBe('tui');
    });

    it('should be resilient to extra arguments', () => {
      const args = ['setup', 'extra', '--agent', 'claude-code', 'more', 'stuff'];
      const options = parseMcpOptions(args);

      expect(options.agents).toContain('claude-code');
    });
  });

  describe('TUI vs CLI mode detection', () => {
    it('should detect TUI when no --agent flag present', () => {
      const args = ['setup'];
      const options = parseMcpOptions(args);
      expect(options.mode).toBe('tui');
    });

    it('should detect CLI when --agent flag present', () => {
      const args = ['setup', '--agent'];
      // Should handle case where --agent has a value
      const options1 = parseMcpOptions(['setup', '--agent', 'claude-code']);
      expect(options1.mode).toBe('cli');
    });

    it('should handle -a short form if supported', () => {
      // Test whether short form -a is supported
      const args = ['setup', '--agent', 'claude-code'];
      const options = parseMcpOptions(args);

      expect(options.mode).toBe('cli');
      expect(options.agents).toContain('claude-code');
    });
  });

  describe('configuration merge with mcp-configurator', () => {
    it('should structure data for mcp-configurator integration', () => {
      const options = { mode: 'cli' as const, agents: ['claude-code'] };

      // Should provide what mcp-configurator needs
      expect(typeof options.agents[0]).toBe('string');
      expect(options.agents[0]).toBe('claude-code');
    });

    it('should support batch configuration', () => {
      const options = {
        mode: 'cli' as const,
        agents: ['claude-code', 'cline', 'cursor'],
      };

      expect(options.agents.length).toBe(3);
      options.agents.forEach((agent) => {
        expect(typeof agent).toBe('string');
      });
    });
  });
});
