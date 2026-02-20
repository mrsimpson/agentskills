import { describe, it, expect } from "vitest";
import { validateSkill } from "../validator";
import type { Skill, ValidationError, ValidationWarning } from "../types";

describe("SkillValidator", () => {
  describe("Valid Skills", () => {
    it("should validate skills with required and optional fields", () => {
      const basicSkill: Skill = {
        metadata: { name: "test-skill", description: "A test skill" },
        body: "# Test",
      };
      expect(validateSkill(basicSkill).valid).toBe(true);

      const fullSkill: Skill = {
        metadata: {
          name: "full-skill",
          description: "Full skill",
          license: "MIT",
          compatibility: "claude-3.5-sonnet",
          metadata: { author: "Test", version: "1.0.0", tags: ["test"] },
          allowedTools: ["bash"],
        },
        body: "# Full",
      };
      expect(validateSkill(fullSkill).valid).toBe(true);
    });

    it("should validate boundary lengths", () => {
      expect(validateSkill({ metadata: { name: "a".repeat(64), description: "test" }, body: "" }).valid).toBe(true);
      expect(validateSkill({ metadata: { name: "test", description: "a".repeat(1024) }, body: "" }).valid).toBe(true);
      expect(validateSkill({ metadata: { name: "test", description: "test", compatibility: "a".repeat(500) }, body: "" }).valid).toBe(true);
    });
  });

  describe("Name Validation", () => {
    it.each([
      ["missing", { name: undefined as unknown as string, description: "test" }, "MISSING_FIELD"],
      ["empty", { name: "", description: "test" }, "INVALID_NAME_LENGTH"],
      ["null", { name: null as unknown as string, description: "test" }, "MISSING_FIELD"],
      ["too long", { name: "a".repeat(65), description: "test" }, "INVALID_NAME_LENGTH"],
    ])("should fail for %s name", (_, metadata, code) => {
      const result = validateSkill({ metadata: metadata as any, body: "" });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: ValidationError) => e.code === code)).toBe(true);
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
      ["test--skill", "consecutive hyphens"],
    ])("should fail for name with %s", (name, _) => {
      const result = validateSkill({ metadata: { name, description: "test" }, body: "" });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: ValidationError) => e.code === "INVALID_NAME_FORMAT")).toBe(true);
    });
  });

  describe("Description Validation", () => {
    it.each([
      ["missing", { name: "test", description: undefined as unknown as string }, "MISSING_FIELD"],
      ["empty", { name: "test", description: "" }, "INVALID_DESCRIPTION_LENGTH"],
      ["null", { name: "test", description: null as unknown as string }, "MISSING_FIELD"],
      ["too long", { name: "test", description: "a".repeat(1025) }, "INVALID_DESCRIPTION_LENGTH"],
    ])("should fail for %s description", (_, metadata, code) => {
      const result = validateSkill({ metadata: metadata as any, body: "" });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: ValidationError) => e.code === code)).toBe(true);
    });

    it("should allow special characters and newlines", () => {
      expect(validateSkill({ metadata: { name: "test", description: "émojis 🚀, quotes \"nested\", <>&" }, body: "" }).valid).toBe(true);
      expect(validateSkill({ metadata: { name: "test", description: "Line 1\nLine 2" }, body: "" }).valid).toBe(true);
    });
  });

  describe("Optional Field Validation", () => {
    it("should validate compatibility length", () => {
      expect(validateSkill({ metadata: { name: "test", description: "test", compatibility: "a".repeat(501) }, body: "" }).valid).toBe(false);
      expect(validateSkill({ metadata: { name: "test", description: "test", compatibility: "" }, body: "" }).valid).toBe(true);
    });

    it.each([
      ["metadata as string", { metadata: "string" as any }, "INVALID_FIELD_TYPE"],
      ["metadata as array", { metadata: ["array"] as any }, "INVALID_FIELD_TYPE"],
      ["metadata as null", { metadata: null as any }, "INVALID_FIELD_TYPE"],
      ["allowedTools as string", { allowedTools: "string" as any }, "INVALID_FIELD_TYPE"],
      ["allowedTools as object", { allowedTools: {} as any }, "INVALID_FIELD_TYPE"],
      ["allowedTools as null", { allowedTools: null as any }, "INVALID_FIELD_TYPE"],
    ])("should fail for %s", (_, extraFields, code) => {
      const result = validateSkill({ metadata: { name: "test", description: "test", ...extraFields }, body: "" });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: ValidationError) => e.code === code)).toBe(true);
    });

    it("should allow valid optional fields", () => {
      expect(validateSkill({ metadata: { name: "test", description: "test", metadata: { author: "Test" } }, body: "" }).valid).toBe(true);
      expect(validateSkill({ metadata: { name: "test", description: "test", allowedTools: ["bash"] }, body: "" }).valid).toBe(true);
      expect(validateSkill({ metadata: { name: "test", description: "test", license: "MIT" }, body: "" }).valid).toBe(true);
    });
  });

  describe("Multiple Errors and Warnings", () => {
    it("should accumulate all validation errors", () => {
      const skill: Skill = {
        metadata: {
          name: "Test-INVALID",
          description: "",
          compatibility: "a".repeat(600),
          metadata: "invalid" as any,
          allowedTools: "invalid" as any,
        },
        body: "",
      };
      const result = validateSkill(skill);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
    });

    it("should generate warnings for recommended fields and content length", () => {
      const result = validateSkill({ metadata: { name: "test", description: "Short" }, body: "word ".repeat(5000) });
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: ValidationWarning) => w.code === "MISSING_RECOMMENDED_FIELD")).toBe(true);
      expect(result.warnings.some((w: ValidationWarning) => w.code === "SHORT_DESCRIPTION")).toBe(true);
      expect(result.warnings.some((w: ValidationWarning) => w.code === "LONG_CONTENT")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle whitespace and trimming", () => {
      expect(validateSkill({ metadata: { name: "   ", description: "test" }, body: "" }).valid).toBe(false);
      expect(validateSkill({ metadata: { name: "test", description: "   " }, body: "" }).valid).toBe(false);
      expect(validateSkill({ metadata: { name: "  test  ", description: "  desc  " }, body: "" }).valid).toBe(true);
    });

    it("should handle undefined/empty body", () => {
      expect(validateSkill({ metadata: { name: "test", description: "test" }, body: undefined as any }).valid).toBe(true);
      expect(validateSkill({ metadata: { name: "test", description: "test" }, body: "" }).valid).toBe(true);
    });

    it("should handle deeply nested metadata", () => {
      const skill: Skill = {
        metadata: {
          name: "test",
          description: "test",
          metadata: { level1: { level2: { level3: "deep" } } },
        },
        body: "",
      };
      expect(validateSkill(skill).valid).toBe(true);
    });
  });

  describe("ValidationResult Structure", () => {
    it("should return properly structured result", () => {
      const result = validateSkill({ metadata: { name: "INVALID", description: "" }, body: "" });
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
});
