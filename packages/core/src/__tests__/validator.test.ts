import { describe, it, expect } from "vitest";
import { validateSkill } from "../validator.js";
import type {
  Skill,
  ValidationError,
  ValidationWarning,
  McpParameterSpec
} from "../types.js";

describe("SkillValidator", () => {
  describe("Valid Skills", () => {
    it("should validate skills with required and optional fields", () => {
      const basicSkill: Skill = {
        metadata: { name: "test-skill", description: "A test skill" },
        body: "# Test"
      };
      expect(validateSkill(basicSkill).valid).toBe(true);

      const fullSkill: Skill = {
        metadata: {
          name: "full-skill",
          description: "Full skill",
          license: "MIT",
          compatibility: "claude-3.5-sonnet",
          metadata: { author: "Test", version: "1.0.0", tags: ["test"] },
          allowedTools: ["bash"]
        },
        body: "# Full"
      };
      expect(validateSkill(fullSkill).valid).toBe(true);
    });

    it("should validate boundary lengths", () => {
      expect(
        validateSkill({
          metadata: { name: "a".repeat(64), description: "test" },
          body: ""
        }).valid
      ).toBe(true);
      expect(
        validateSkill({
          metadata: { name: "test", description: "a".repeat(1024) },
          body: ""
        }).valid
      ).toBe(true);
      expect(
        validateSkill({
          metadata: {
            name: "test",
            description: "test",
            compatibility: "a".repeat(500)
          },
          body: ""
        }).valid
      ).toBe(true);
    });
  });

  describe("Name Validation", () => {
    it.each([
      [
        "missing",
        { name: undefined as unknown as string, description: "test" },
        "MISSING_FIELD"
      ],
      ["empty", { name: "", description: "test" }, "INVALID_NAME_LENGTH"],
      [
        "null",
        { name: null as unknown as string, description: "test" },
        "MISSING_FIELD"
      ],
      [
        "too long",
        { name: "a".repeat(65), description: "test" },
        "INVALID_NAME_LENGTH"
      ]
    ])("should fail for %s name", (_description, metadata, code) => {
      const result = validateSkill({
        metadata: metadata as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: ValidationError) => e.code === code)).toBe(
        true
      );
    });

    it.each([
      ["Test-Skill", "uppercase"],
      ["test skill", "spaces"],
      ["test_skill", "underscores"],
      ["test.skill", "dots"],
      ["test@skill", "special chars"],
      ["test-skill-日本語", "unicode"],
      ["test-skill-🚀", "emojis"],
      ["-test", "leading hyphen"],
      ["test-", "trailing hyphen"],
      ["test--skill", "consecutive hyphens"]
    ])("should fail for name with %s", (name) => {
      const result = validateSkill({
        metadata: { name, description: "test" },
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e: ValidationError) => e.code === "INVALID_NAME_FORMAT"
        )
      ).toBe(true);
    });
  });

  describe("Description Validation", () => {
    it.each([
      [
        "missing",
        { name: "test", description: undefined as unknown as string },
        "MISSING_FIELD"
      ],
      [
        "empty",
        { name: "test", description: "" },
        "INVALID_DESCRIPTION_LENGTH"
      ],
      [
        "null",
        { name: "test", description: null as unknown as string },
        "MISSING_FIELD"
      ],
      [
        "too long",
        { name: "test", description: "a".repeat(1025) },
        "INVALID_DESCRIPTION_LENGTH"
      ]
    ])("should fail for %s description", (_description, metadata, code) => {
      const result = validateSkill({
        metadata: metadata as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: ValidationError) => e.code === code)).toBe(
        true
      );
    });

    it("should allow special characters and newlines", () => {
      expect(
        validateSkill({
          metadata: {
            name: "test",
            description: 'émojis 🚀, quotes "nested", <>&'
          },
          body: ""
        }).valid
      ).toBe(true);
      expect(
        validateSkill({
          metadata: { name: "test", description: "Line 1\nLine 2" },
          body: ""
        }).valid
      ).toBe(true);
    });
  });

  describe("Optional Field Validation", () => {
    it("should validate compatibility length", () => {
      expect(
        validateSkill({
          metadata: {
            name: "test",
            description: "test",
            compatibility: "a".repeat(501)
          },
          body: ""
        }).valid
      ).toBe(false);
      expect(
        validateSkill({
          metadata: { name: "test", description: "test", compatibility: "" },
          body: ""
        }).valid
      ).toBe(true);
    });

    it.each([
      [
        "metadata as string",
        { metadata: "string" as unknown },
        "INVALID_FIELD_TYPE"
      ],
      [
        "metadata as array",
        { metadata: ["array"] as unknown },
        "INVALID_FIELD_TYPE"
      ],
      ["metadata as null", { metadata: null as unknown }, "INVALID_FIELD_TYPE"],
      [
        "allowedTools as string",
        { allowedTools: "string" as unknown },
        "INVALID_FIELD_TYPE"
      ],
      [
        "allowedTools as object",
        { allowedTools: {} as unknown },
        "INVALID_FIELD_TYPE"
      ],
      [
        "allowedTools as null",
        { allowedTools: null as unknown },
        "INVALID_FIELD_TYPE"
      ]
    ])("should fail for %s", (_description, extraFields, code) => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          ...extraFields
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: ValidationError) => e.code === code)).toBe(
        true
      );
    });

    it("should allow valid optional fields", () => {
      expect(
        validateSkill({
          metadata: {
            name: "test",
            description: "test",
            metadata: { author: "Test" }
          },
          body: ""
        }).valid
      ).toBe(true);
      expect(
        validateSkill({
          metadata: {
            name: "test",
            description: "test",
            allowedTools: ["bash"]
          },
          body: ""
        }).valid
      ).toBe(true);
      expect(
        validateSkill({
          metadata: { name: "test", description: "test", license: "MIT" },
          body: ""
        }).valid
      ).toBe(true);
    });
  });

  describe("Multiple Errors and Warnings", () => {
    it("should accumulate all validation errors", () => {
      const skill: Skill = {
        metadata: {
          name: "Test-INVALID",
          description: "",
          compatibility: "a".repeat(600),
          metadata: "invalid" as unknown as Record<string, unknown>,
          allowedTools: "invalid" as unknown as string[]
        },
        body: ""
      };
      const result = validateSkill(skill);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
    });

    it("should generate warnings for recommended fields and content length", () => {
      const result = validateSkill({
        metadata: { name: "test", description: "Short" },
        body: "word ".repeat(5000)
      });
      expect(result.valid).toBe(true);
      expect(
        result.warnings.some(
          (w: ValidationWarning) => w.code === "MISSING_RECOMMENDED_FIELD"
        )
      ).toBe(true);
      expect(
        result.warnings.some(
          (w: ValidationWarning) => w.code === "SHORT_DESCRIPTION"
        )
      ).toBe(true);
      expect(
        result.warnings.some(
          (w: ValidationWarning) => w.code === "LONG_CONTENT"
        )
      ).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle whitespace and trimming", () => {
      expect(
        validateSkill({
          metadata: { name: "   ", description: "test" },
          body: ""
        }).valid
      ).toBe(false);
      expect(
        validateSkill({
          metadata: { name: "test", description: "   " },
          body: ""
        }).valid
      ).toBe(false);
      expect(
        validateSkill({
          metadata: { name: "  test  ", description: "  desc  " },
          body: ""
        }).valid
      ).toBe(true);
    });

    it("should handle undefined/empty body", () => {
      expect(
        validateSkill({
          metadata: { name: "test", description: "test" },
          body: undefined as unknown as string
        }).valid
      ).toBe(true);
      expect(
        validateSkill({
          metadata: { name: "test", description: "test" },
          body: ""
        }).valid
      ).toBe(true);
    });

    it("should handle deeply nested metadata", () => {
      const skill: Skill = {
        metadata: {
          name: "test",
          description: "test",
          metadata: { level1: { level2: { level3: "deep" } } }
        },
        body: ""
      };
      expect(validateSkill(skill).valid).toBe(true);
    });
  });

  describe("ValidationResult Structure", () => {
    it("should return properly structured result", () => {
      const result = validateSkill({
        metadata: { name: "INVALID", description: "" },
        body: ""
      });
      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      result.errors.forEach((e: ValidationError) => {
        expect(e).toHaveProperty("code");
        expect(e).toHaveProperty("message");
        expect(typeof e.code).toBe("string");
        expect(typeof e.message).toBe("string");
      });
    });
  });

  describe("requiresMcpServers Validation", () => {
    it("should pass validation when requires-mcp-servers is not present", () => {
      const result = validateSkill({
        metadata: {
          name: "test-skill",
          description: "A test skill without MCP server dependencies"
        },
        body: "# Skill content"
      });
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should validate empty requiresMcpServers array", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: []
        },
        body: ""
      });
      expect(result.valid).toBe(true);
    });

    it("should fail when server is missing required field: name", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              command: "npx",
              description: "A test server"
            } as unknown as Skill["metadata"]["requiresMcpServers"]
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e: ValidationError) => e.code === "MISSING_FIELD")
      ).toBe(true);
    });

    it("should fail when server is missing required field: command", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              description: "A test server"
            } as unknown as Skill["metadata"]["requiresMcpServers"]
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e: ValidationError) => e.code === "MISSING_FIELD")
      ).toBe(true);
    });

    it("should fail when server is missing required field: description", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx"
            } as unknown as Skill["metadata"]["requiresMcpServers"]
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e: ValidationError) => e.code === "MISSING_FIELD")
      ).toBe(true);
    });

    it.each([
      ["spaces", "test server"],
      ["special chars", "test@server"],
      ["consecutive hyphens", "test--server"],
      ["uppercase", "Test-Server"],
      ["leading hyphen", "-test-server"],
      ["trailing hyphen", "test-server-"],
      ["underscores", "test_server"],
      ["dots", "test.server"]
    ])("should fail for server name with %s", (_, name) => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name,
              command: "npx",
              description: "A test server"
            }
          ]
        },
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e: ValidationError) => e.code === "INVALID_NAME_FORMAT"
        )
      ).toBe(true);
    });

    it("should fail when server parameter is missing required field: description", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx",
              description: "A test server",
              args: ["{{API_KEY}}"],
              parameters: {
                "api-key": {
                  required: true
                } as unknown as McpParameterSpec
              }
            }
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e: ValidationError) => e.code === "MISSING_FIELD")
      ).toBe(true);
    });

    it("should fail when server parameter is missing required field: required", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx",
              description: "A test server",
              args: ["{{API_KEY}}"],
              parameters: {
                "api-key": {
                  description: "API key for authentication"
                } as unknown as McpParameterSpec
              }
            }
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e: ValidationError) => e.code === "MISSING_FIELD")
      ).toBe(true);
    });

    it("should fail when server parameter has invalid default value type", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx",
              description: "A test server",
              parameters: {
                "api-key": {
                  description: "API key",
                  required: false,
                  default: 12345 as unknown as string
                }
              }
            }
          ]
        },
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e: ValidationError) => e.code === "INVALID_FIELD_TYPE"
        )
      ).toBe(true);
    });

    it("should validate a complete valid MCP server specification", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "github-server",
              package: "@modelcontextprotocol/server-github",
              command: "npx",
              description: "GitHub MCP server for repository access",
              args: ["-y", "@modelcontextprotocol/server-github"],
              env: {
                GITHUB_TOKEN: "{{GITHUB_TOKEN}}"
              },
              parameters: {
                "github-token": {
                  description: "GitHub personal access token",
                  required: true,
                  sensitive: true,
                  example: "ghp_xxxxxxxxxxxx"
                }
              }
            }
          ]
        },
        body: ""
      });
      expect(result.valid).toBe(true);
    });

    it("should validate multiple servers in array", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "server-one",
              command: "npx",
              description: "First server"
            },
            {
              name: "server-two",
              command: "node",
              description: "Second server",
              args: ["server.js"]
            },
            {
              name: "server-three",
              command: "python",
              description: "Third server",
              args: ["-m", "server"]
            }
          ]
        },
        body: ""
      });
      expect(result.valid).toBe(true);
    });

    it.each([
      ["camelCase", "apiKey"],
      ["PascalCase", "ApiKey"],
      ["snake_case", "api_key"],
      ["spaces", "api key"],
      ["uppercase", "API-KEY"],
      ["consecutive hyphens", "api--key"]
    ])("should fail for parameter name with %s", (_, paramName) => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx",
              description: "A test server",
              parameters: {
                [paramName]: {
                  description: "Test parameter",
                  required: true
                }
              }
            }
          ]
        },
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e: ValidationError) => e.code === "INVALID_NAME_FORMAT"
        )
      ).toBe(true);
    });

    it("should fail when args is not an array", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx",
              description: "A test server",
              args: "not-an-array" as unknown as string[]
            }
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e: ValidationError) => e.code === "INVALID_FIELD_TYPE"
        )
      ).toBe(true);
    });

    it("should fail when env is not an object", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx",
              description: "A test server",
              env: "not-an-object" as unknown as Record<string, string>
            }
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e: ValidationError) => e.code === "INVALID_FIELD_TYPE"
        )
      ).toBe(true);
    });

    it("should fail when parameters is not an object", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx",
              description: "A test server",
              parameters: ["not", "an", "object"] as unknown as Record<
                string,
                McpParameterSpec
              >
            }
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e: ValidationError) => e.code === "INVALID_FIELD_TYPE"
        )
      ).toBe(true);
    });

    it("should fail when server has additional properties", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx",
              description: "A test server",
              unexpectedField: "should not be here"
            } as unknown as Skill["metadata"]["requiresMcpServers"]
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should fail when parameter has additional properties", () => {
      const result = validateSkill({
        metadata: {
          name: "test",
          description: "test",
          requiresMcpServers: [
            {
              name: "test-server",
              command: "npx",
              description: "A test server",
              parameters: {
                "api-key": {
                  description: "API key",
                  required: true,
                  unexpectedField: "should not be here"
                } as unknown as McpParameterSpec
              }
            }
          ]
        } as unknown as Skill["metadata"],
        body: ""
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
