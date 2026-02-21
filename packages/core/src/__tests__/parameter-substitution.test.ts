import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { substituteParameters } from "../parameter-substitution.js";

describe("Parameter Substitution", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Set up test environment variables
    process.env.HOME = "/home/testuser";
    process.env.TEST_VAR = "test-value";
    process.env.API_KEY = "secret-key";
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Simple String Substitution", () => {
    it("should replace a single variable placeholder", () => {
      const result = substituteParameters("{{VAR}}", { VAR: "value" });
      expect(result).toBe("value");
    });

    it("should replace multiple variables in one string", () => {
      const result = substituteParameters("{{A}}/{{B}}/{{C}}", {
        A: "path",
        B: "to",
        C: "file"
      });
      expect(result).toBe("path/to/file");
    });

    it("should leave unmatched text as-is", () => {
      const result = substituteParameters("static text", { VAR: "value" });
      expect(result).toBe("static text");
    });

    it("should handle mixed static text and variables", () => {
      const result = substituteParameters("prefix-{{VAR}}-suffix", {
        VAR: "middle"
      });
      expect(result).toBe("prefix-middle-suffix");
    });

    it("should handle empty string", () => {
      const result = substituteParameters("", { VAR: "value" });
      expect(result).toBe("");
    });

    it("should throw error for missing required parameter", () => {
      expect(() => {
        substituteParameters("{{MISSING}}", {});
      }).toThrow(/MISSING/);
    });

    it("should throw error with helpful message for missing parameter", () => {
      expect(() => {
        substituteParameters("{{API_KEY}}", { OTHER: "value" });
      }).toThrow(/API_KEY.*required/i);
    });
  });

  describe("Variable Name Patterns", () => {
    it("should handle underscores in variable names", () => {
      const result = substituteParameters("{{WORKSPACE_PATH}}", {
        WORKSPACE_PATH: "/home/user/workspace"
      });
      expect(result).toBe("/home/user/workspace");
    });

    it("should handle hyphens in variable names", () => {
      const result = substituteParameters("{{API-KEY}}", {
        "API-KEY": "secret"
      });
      expect(result).toBe("secret");
    });

    it("should be case sensitive", () => {
      const result = substituteParameters("{{VAR}} {{var}}", {
        VAR: "upper",
        var: "lower"
      });
      expect(result).toBe("upper lower");
    });

    it("should not partially match variable names", () => {
      expect(() => {
        substituteParameters("{{VARIABLE}}", { VARIABLE_NAME: "value" });
      }).toThrow(/VARIABLE/);
    });

    it("should not replace if only part of variable name matches", () => {
      expect(() => {
        substituteParameters("{{VAR}}", { VARIABLE: "value" });
      }).toThrow(/VAR/);
    });
  });

  describe("Array Substitution", () => {
    it("should substitute variables in array elements", () => {
      const result = substituteParameters(["{{VAR}}", "static"], {
        VAR: "value"
      });
      expect(result).toEqual(["value", "static"]);
    });

    it("should handle multiple variables in array", () => {
      const result = substituteParameters(["{{A}}", "{{B}}", "{{C}}"], {
        A: "a",
        B: "b",
        C: "c"
      });
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should handle mixed variables and static values in array", () => {
      const result = substituteParameters(
        ["-y", "{{PACKAGE}}", "--path={{PATH}}"],
        { PACKAGE: "my-package", PATH: "/usr/local" }
      );
      expect(result).toEqual(["-y", "my-package", "--path=/usr/local"]);
    });

    it("should handle empty array", () => {
      const result = substituteParameters([], { VAR: "value" });
      expect(result).toEqual([]);
    });

    it("should throw error for missing parameter in array", () => {
      expect(() => {
        substituteParameters(["{{MISSING}}"], {});
      }).toThrow(/MISSING/);
    });
  });

  describe("Object Substitution", () => {
    it("should substitute variables in object values", () => {
      const result = substituteParameters({ key: "{{VAR}}" }, { VAR: "value" });
      expect(result).toEqual({ key: "value" });
    });

    it("should handle multiple variables in object", () => {
      const result = substituteParameters(
        { key1: "{{A}}", key2: "{{B}}" },
        { A: "a", B: "b" }
      );
      expect(result).toEqual({ key1: "a", key2: "b" });
    });

    it("should leave static object values as-is", () => {
      const result = substituteParameters(
        { key1: "static", key2: "{{VAR}}" },
        { VAR: "value" }
      );
      expect(result).toEqual({ key1: "static", key2: "value" });
    });

    it("should handle empty object", () => {
      const result = substituteParameters({}, { VAR: "value" });
      expect(result).toEqual({});
    });

    it("should throw error for missing parameter in object", () => {
      expect(() => {
        substituteParameters({ key: "{{MISSING}}" }, {});
      }).toThrow(/MISSING/);
    });

    it("should not modify object keys, only values", () => {
      const result = substituteParameters(
        { "{{KEY}}": "{{VALUE}}" },
        { KEY: "new-key", VALUE: "new-value" }
      );
      // Keys should remain as-is, only values are substituted
      expect(result).toEqual({ "{{KEY}}": "new-value" });
    });
  });

  describe("Nested Structure Substitution", () => {
    it("should handle nested objects", () => {
      const result = substituteParameters(
        { outer: { inner: "{{VAR}}" } },
        { VAR: "value" }
      );
      expect(result).toEqual({ outer: { inner: "value" } });
    });

    it("should handle nested arrays", () => {
      const result = substituteParameters([["{{A}}", "{{B}}"], ["{{C}}"]], {
        A: "a",
        B: "b",
        C: "c"
      });
      expect(result).toEqual([["a", "b"], ["c"]]);
    });

    it("should handle arrays inside objects", () => {
      const result = substituteParameters(
        { args: ["{{A}}", "{{B}}"] },
        { A: "a", B: "b" }
      );
      expect(result).toEqual({ args: ["a", "b"] });
    });

    it("should handle objects inside arrays", () => {
      const result = substituteParameters([{ key: "{{VAR}}" }], {
        VAR: "value"
      });
      expect(result).toEqual([{ key: "value" }]);
    });

    it("should handle deeply nested structures", () => {
      const result = substituteParameters(
        {
          level1: {
            level2: {
              level3: ["{{A}}", { key: "{{B}}" }]
            }
          }
        },
        { A: "a", B: "b" }
      );
      expect(result).toEqual({
        level1: {
          level2: {
            level3: ["a", { key: "b" }]
          }
        }
      });
    });
  });

  describe("MCP Server Config Shape", () => {
    it("should handle typical MCP server config structure", () => {
      const config = {
        command: "npx",
        args: ["-y", "{{PACKAGE}}", "{{WORKSPACE_PATH}}"],
        env: {
          API_KEY: "{{API_KEY}}",
          DEBUG: "true"
        }
      };

      const result = substituteParameters(config, {
        PACKAGE: "@modelcontextprotocol/server-filesystem",
        WORKSPACE_PATH: "/home/user",
        API_KEY: "secret-123"
      });

      expect(result).toEqual({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"],
        env: {
          API_KEY: "secret-123",
          DEBUG: "true"
        }
      });
    });

    it("should handle MCP config with missing optional cwd", () => {
      const config = {
        command: "node",
        args: ["{{SCRIPT}}"]
      };

      const result = substituteParameters(config, {
        SCRIPT: "server.js"
      });

      expect(result).toEqual({
        command: "node",
        args: ["server.js"]
      });
    });

    it("should throw error for missing required MCP parameter", () => {
      const config = {
        command: "npx",
        args: ["{{MISSING_PACKAGE}}"]
      };

      expect(() => {
        substituteParameters(config, {});
      }).toThrow(/MISSING_PACKAGE/);
    });
  });

  describe("Environment Variable Substitution", () => {
    it("should substitute environment variables with ENV: prefix", () => {
      const result = substituteParameters("{{ENV:HOME}}", {});
      expect(result).toBe("/home/testuser");
    });

    it("should substitute multiple environment variables", () => {
      const result = substituteParameters("{{ENV:HOME}}/{{ENV:TEST_VAR}}", {});
      expect(result).toBe("/home/testuser/test-value");
    });

    it("should handle ENV variables in arrays", () => {
      const result = substituteParameters(["--api-key", "{{ENV:API_KEY}}"], {});
      expect(result).toEqual(["--api-key", "secret-key"]);
    });

    it("should handle ENV variables in objects", () => {
      const result = substituteParameters({ API_KEY: "{{ENV:API_KEY}}" }, {});
      expect(result).toEqual({ API_KEY: "secret-key" });
    });

    it("should throw error for missing environment variable", () => {
      expect(() => {
        substituteParameters("{{ENV:NONEXISTENT_VAR}}", {});
      }).toThrow(/NONEXISTENT_VAR.*environment/i);
    });

    it("should prefer parameters over environment variables", () => {
      const result = substituteParameters("{{HOME}}", { HOME: "override" });
      expect(result).toBe("override");
    });

    it("should handle mix of ENV and regular parameters", () => {
      const result = substituteParameters("{{PARAM}}/{{ENV:HOME}}", {
        PARAM: "value"
      });
      expect(result).toBe("value//home/testuser");
    });
  });

  describe("Non-String Values", () => {
    it("should pass through numbers unchanged", () => {
      const result = substituteParameters(42, { VAR: "value" });
      expect(result).toBe(42);
    });

    it("should pass through booleans unchanged", () => {
      const result = substituteParameters(true, { VAR: "value" });
      expect(result).toBe(true);
    });

    it("should pass through null unchanged", () => {
      const result = substituteParameters(null, { VAR: "value" });
      expect(result).toBe(null);
    });

    it("should pass through undefined unchanged", () => {
      const result = substituteParameters(undefined, { VAR: "value" });
      expect(result).toBe(undefined);
    });

    it("should handle mixed types in arrays", () => {
      const result = substituteParameters(["{{VAR}}", 42, true, null], {
        VAR: "value"
      });
      expect(result).toEqual(["value", 42, true, null]);
    });

    it("should handle mixed types in objects", () => {
      const result = substituteParameters(
        { str: "{{VAR}}", num: 42, bool: true, nil: null },
        { VAR: "value" }
      );
      expect(result).toEqual({ str: "value", num: 42, bool: true, nil: null });
    });

    it("should handle number as parameter value", () => {
      const result = substituteParameters("{{PORT}}", { PORT: 3000 });
      expect(result).toBe("3000");
    });

    it("should handle boolean as parameter value", () => {
      const result = substituteParameters("{{FLAG}}", { FLAG: true });
      expect(result).toBe("true");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty parameters object", () => {
      const result = substituteParameters("static text", {});
      expect(result).toBe("static text");
    });

    it("should handle template with no placeholders", () => {
      const result = substituteParameters(
        { command: "node", args: ["script.js"] },
        { VAR: "unused" }
      );
      expect(result).toEqual({ command: "node", args: ["script.js"] });
    });

    it("should handle multiple occurrences of same variable", () => {
      const result = substituteParameters("{{VAR}}-{{VAR}}-{{VAR}}", {
        VAR: "x"
      });
      expect(result).toBe("x-x-x");
    });

    it("should handle adjacent placeholders without separator", () => {
      const result = substituteParameters("{{A}}{{B}}", { A: "a", B: "b" });
      expect(result).toBe("ab");
    });

    it("should not replace malformed placeholders", () => {
      const result = substituteParameters("{VAR}", { VAR: "value" });
      expect(result).toBe("{VAR}");
    });

    it("should not replace single brace placeholders", () => {
      const result = substituteParameters("{{VAR}", { VAR: "value" });
      expect(result).toBe("{{VAR}");
    });

    it("should handle nested braces", () => {
      const result = substituteParameters("{{{VAR}}}", { VAR: "value" });
      expect(result).toBe("{value}");
    });

    it("should handle whitespace in placeholder", () => {
      expect(() => {
        substituteParameters("{{ VAR }}", { VAR: "value" });
      }).toThrow();
    });

    it("should handle special characters in values", () => {
      const result = substituteParameters("{{VAR}}", {
        VAR: "value-with-special!@#$%^&*()"
      });
      expect(result).toBe("value-with-special!@#$%^&*()");
    });

    it("should handle unicode in values", () => {
      const result = substituteParameters("{{VAR}}", { VAR: "hello-世界-🌍" });
      expect(result).toBe("hello-世界-🌍");
    });

    it("should handle very long strings", () => {
      const longValue = "x".repeat(10000);
      const result = substituteParameters("{{VAR}}", { VAR: longValue });
      expect(result).toBe(longValue);
    });

    it("should preserve empty strings in parameter values", () => {
      const result = substituteParameters("{{VAR}}", { VAR: "" });
      expect(result).toBe("");
    });

    it("should handle circular reference prevention", () => {
      // Parameter value should not be recursively substituted
      const result = substituteParameters("{{VAR}}", { VAR: "{{OTHER}}" });
      expect(result).toBe("{{OTHER}}");
    });
  });

  describe("Type Preservation", () => {
    it("should return string when template is string", () => {
      const result = substituteParameters("{{VAR}}", { VAR: "value" });
      expect(typeof result).toBe("string");
    });

    it("should return array when template is array", () => {
      const result = substituteParameters(["{{VAR}}"], { VAR: "value" });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return object when template is object", () => {
      const result = substituteParameters({ key: "{{VAR}}" }, { VAR: "value" });
      expect(typeof result).toBe("object");
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(false);
    });

    it("should preserve array vs object distinction", () => {
      const arrayResult = substituteParameters([], {});
      const objectResult = substituteParameters({}, {});
      expect(Array.isArray(arrayResult)).toBe(true);
      expect(Array.isArray(objectResult)).toBe(false);
    });
  });
});
