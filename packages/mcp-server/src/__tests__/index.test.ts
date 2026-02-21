import { describe, it, expect } from "vitest";
import { AgentSkillsServer } from "../index.js";

/**
 * Smoke test for MCP server package setup
 *
 * This test verifies that the basic package structure is in place
 * and exports are working correctly.
 *
 * Following TDD approach:
 * - RED: This test will fail initially because AgentSkillsServer doesn't exist
 * - GREEN: Minimal implementation to make it pass
 * - REFACTOR: Add more functionality as needed
 */

describe("MCP Server Package", () => {
  describe("Smoke Test", () => {
    it("should export AgentSkillsServer class", () => {
      // Assert
      expect(AgentSkillsServer).toBeDefined();
      expect(typeof AgentSkillsServer).toBe("function");
    });

    it("should create an instance of AgentSkillsServer", () => {
      // Act
      const server = new AgentSkillsServer();

      // Assert
      expect(server).toBeInstanceOf(AgentSkillsServer);
    });
  });
});
