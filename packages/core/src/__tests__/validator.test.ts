import { describe, it, expect } from "vitest";
import { validateSkill } from "../validator";
import type { Skill, ValidationError, ValidationWarning } from "../types";

/**
 * Comprehensive test suite for SkillValidator component
 * 
 * Following TDD approach:
 * - Write tests first to define the validation interface and behavior
 * - Tests define validation rules before implementation
 * - Clear test structure with arrange-act-assert
 * 
 * Coverage:
 * 1. Valid skills - Should pass validation
 * 2. Name validation - Format, length, character restrictions
 * 3. Description validation - Required, length limits
 * 4. Optional field validation - Type checking, length limits
 * 5. Multiple errors - Should accumulate all validation errors
 * 6. Warnings - Non-blocking issues that should be flagged
 */

describe("SkillValidator", () => {
  describe("Valid Skills", () => {
    it("should validate a basic skill with required fields only", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "A simple test skill for basic validation",
        },
        body: "# Test Skill\n\nThis is a valid skill.",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a skill with all optional fields", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "full-feature-skill",
          description: "A skill with all optional fields populated",
          license: "MIT",
          compatibility: "claude-3.5-sonnet",
          metadata: {
            author: "Test Author",
            version: "1.0.0",
            tags: ["testing", "example"],
          },
          allowedTools: ["bash", "read_file", "write_file"],
        },
        body: "# Full Feature Skill\n\nComplete skill with all fields.",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a skill at maximum name length boundary (64 chars)", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "a".repeat(64), // Exactly 64 characters
          description: "Testing maximum name length boundary",
        },
        body: "# Long Name Skill",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a skill at maximum description length boundary (1024 chars)", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "long-description-skill",
          description: "a".repeat(1024), // Exactly 1024 characters
        },
        body: "# Long Description Skill",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a skill with hyphenated name", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "multi-word-skill-name",
          description: "Testing hyphenated skill names",
        },
        body: "# Hyphenated Skill",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a skill with numbers in name", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "skill-v2-test123",
          description: "Testing skill names with numbers",
        },
        body: "# Numbered Skill",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a skill at maximum compatibility length (500 chars)", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "compat-test",
          description: "Testing compatibility field length",
          compatibility: "a".repeat(500), // Exactly 500 characters
        },
        body: "# Compatibility Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Name Validation - Missing/Empty", () => {
    it("should fail validation when name is missing", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: undefined as unknown as string,
          description: "A skill with missing name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "MISSING_FIELD",
          field: "name",
          message: expect.stringContaining("name"),
        })
      );
    });

    it("should fail validation when name is empty string", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "",
          description: "A skill with empty name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_LENGTH",
          field: "name",
          message: expect.stringMatching(/1.*64/),
        })
      );
    });

    it("should fail validation when name is null", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: null as unknown as string,
          description: "A skill with null name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "MISSING_FIELD",
          field: "name",
        })
      );
    });
  });

  describe("Name Validation - Length", () => {
    it("should fail validation when name exceeds 64 characters", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "a".repeat(65), // 65 characters (1 over limit)
          description: "Testing name length validation",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_LENGTH",
          field: "name",
          message: expect.stringMatching(/64/),
        })
      );
    });

    it("should fail validation when name is much too long (100+ chars)", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "a".repeat(200),
          description: "Testing extremely long name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_LENGTH",
          field: "name",
        })
      );
    });
  });

  describe("Name Validation - Format", () => {
    it("should fail validation when name contains uppercase letters", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "Test-Skill",
          description: "Testing uppercase in name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message: expect.stringMatching(/lowercase/i),
        })
      );
    });

    it("should fail validation when name contains spaces", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test skill",
          description: "Testing spaces in name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message: expect.stringMatching(/lowercase|letters|numbers|hyphens/i),
        })
      );
    });

    it("should fail validation when name contains underscores", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test_skill",
          description: "Testing underscores in name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
        })
      );
    });

    it("should fail validation when name contains special characters", () => {
      // Arrange
      const specialChars = ["@", "#", "$", "%", "^", "&", "*", "(", ")", "+", "=", "[", "]", "{", "}", ";", ":", "'", '"', "<", ">", "?", "/", "\\", "|"];
      
      specialChars.forEach((char) => {
        const skill: Skill = {
          metadata: {
            name: `test${char}skill`,
            description: `Testing ${char} in name`,
          },
          body: "# Test",
        };

        // Act
        const result = validateSkill(skill);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: "INVALID_NAME_FORMAT",
            field: "name",
          })
        );
      });
    });

    it("should fail validation when name starts with hyphen", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "-test-skill",
          description: "Testing leading hyphen",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message: expect.stringMatching(/leading.*hyphen/i),
        })
      );
    });

    it("should fail validation when name ends with hyphen", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill-",
          description: "Testing trailing hyphen",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message: expect.stringMatching(/trailing.*hyphen/i),
        })
      );
    });

    it("should fail validation when name contains consecutive hyphens", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test--skill",
          description: "Testing consecutive hyphens",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message: expect.stringMatching(/consecutive.*hyphen/i),
        })
      );
    });

    it("should fail validation when name contains multiple consecutive hyphens", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test---skill",
          description: "Testing multiple consecutive hyphens",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message: expect.stringMatching(/consecutive.*hyphen/i),
        })
      );
    });

    it("should fail validation when name is only hyphens", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "---",
          description: "Testing only hyphens",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should trigger multiple format errors
    });

    it("should fail validation when name contains dots", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test.skill",
          description: "Testing dots in name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
        })
      );
    });

    it("should fail validation when name contains unicode characters", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill-日本語",
          description: "Testing unicode in name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
        })
      );
    });

    it("should fail validation when name contains emojis", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill-🚀",
          description: "Testing emojis in name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_NAME_FORMAT",
          field: "name",
        })
      );
    });
  });

  describe("Description Validation", () => {
    it("should fail validation when description is missing", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: undefined as unknown as string,
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "MISSING_FIELD",
          field: "description",
          message: expect.stringContaining("description"),
        })
      );
    });

    it("should fail validation when description is empty string", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_DESCRIPTION_LENGTH",
          field: "description",
          message: expect.stringMatching(/1.*1024/),
        })
      );
    });

    it("should fail validation when description is null", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: null as unknown as string,
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "MISSING_FIELD",
          field: "description",
        })
      );
    });

    it("should fail validation when description exceeds 1024 characters", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "a".repeat(1025), // 1025 characters (1 over limit)
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_DESCRIPTION_LENGTH",
          field: "description",
          message: expect.stringMatching(/1024/),
        })
      );
    });

    it("should fail validation when description is much too long (2000+ chars)", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "a".repeat(5000),
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_DESCRIPTION_LENGTH",
          field: "description",
        })
      );
    });

    it("should allow description with special characters", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "A description with émojis 🚀, quotes \"nested\", and symbols <>&",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should allow description with newlines", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "First line\nSecond line\nThird line",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Optional Field Validation - Compatibility", () => {
    it("should allow valid compatibility field", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing compatibility field",
          compatibility: "claude-3.5-sonnet",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation when compatibility exceeds 500 characters", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing compatibility length",
          compatibility: "a".repeat(501), // 501 characters (1 over limit)
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_COMPATIBILITY_LENGTH",
          field: "compatibility",
          message: expect.stringMatching(/500/),
        })
      );
    });

    it("should allow empty compatibility string", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing empty compatibility",
          compatibility: "",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Optional Field Validation - Metadata", () => {
    it("should allow valid metadata object", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing metadata field",
          metadata: {
            author: "Test Author",
            version: "1.0.0",
            tags: ["test", "example"],
          },
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should allow empty metadata object", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing empty metadata",
          metadata: {},
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation when metadata is not an object", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing invalid metadata type",
          metadata: "string value" as unknown as Record<string, unknown>,
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_FIELD_TYPE",
          field: "metadata",
          message: expect.stringMatching(/object/i),
        })
      );
    });

    it("should fail validation when metadata is an array", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing metadata as array",
          metadata: ["not", "an", "object"] as unknown as Record<string, unknown>,
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_FIELD_TYPE",
          field: "metadata",
          message: expect.stringMatching(/object/i),
        })
      );
    });

    it("should fail validation when metadata is null", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing null metadata",
          metadata: null as unknown as Record<string, unknown>,
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_FIELD_TYPE",
          field: "metadata",
        })
      );
    });
  });

  describe("Optional Field Validation - AllowedTools", () => {
    it("should allow valid allowedTools array", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing allowedTools field",
          allowedTools: ["bash", "read_file", "write_file"],
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should allow empty allowedTools array", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing empty allowedTools",
          allowedTools: [],
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation when allowedTools is not an array", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing invalid allowedTools type",
          allowedTools: "bash, read_file" as unknown as string[],
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_FIELD_TYPE",
          field: "allowedTools",
          message: expect.stringMatching(/array/i),
        })
      );
    });

    it("should fail validation when allowedTools is an object", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing allowedTools as object",
          allowedTools: { bash: true } as unknown as string[],
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_FIELD_TYPE",
          field: "allowedTools",
          message: expect.stringMatching(/array/i),
        })
      );
    });

    it("should fail validation when allowedTools is null", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing null allowedTools",
          allowedTools: null as unknown as string[],
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_FIELD_TYPE",
          field: "allowedTools",
        })
      );
    });
  });

  describe("Multiple Errors", () => {
    it("should return all validation errors when multiple fields are invalid", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "Test-Skill-With-UPPERCASE", // Invalid format
          description: "", // Empty description
          compatibility: "a".repeat(600), // Too long
          metadata: "invalid" as unknown as Record<string, unknown>, // Wrong type
          allowedTools: "invalid" as unknown as string[], // Wrong type
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
      
      // Should contain errors for each invalid field
      const errorCodes = result.errors.map((e: ValidationError) => e.code);
      expect(errorCodes).toContain("INVALID_NAME_FORMAT");
      expect(errorCodes).toContain("INVALID_DESCRIPTION_LENGTH");
      expect(errorCodes).toContain("INVALID_COMPATIBILITY_LENGTH");
      expect(errorCodes).toContain("INVALID_FIELD_TYPE");
    });

    it("should return multiple name format errors", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "-Test--Skill-", // Leading hyphen, uppercase, consecutive hyphens, trailing hyphen
          description: "Testing multiple name errors",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.every((e: ValidationError) => e.code === "INVALID_NAME_FORMAT")).toBe(true);
    });

    it("should accumulate all errors across all fields", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "", // Empty
          description: undefined as unknown as string, // Missing
          compatibility: "a".repeat(1000), // Too long
          license: "a".repeat(2000), // If license has length limit, test it
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Warnings - Non-blocking Issues", () => {
    it("should warn when license field is missing", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "A skill without license field",
          // license is intentionally omitted
        },
        body: "# Test Skill",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true); // Should still be valid
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: "MISSING_RECOMMENDED_FIELD",
          field: "license",
          message: expect.stringMatching(/license.*recommended/i),
        })
      );
    });

    it("should warn when description is too short (< 50 chars)", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Short description", // Less than 50 chars
        },
        body: "# Test Skill",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true); // Should still be valid
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: "SHORT_DESCRIPTION",
          field: "description",
          message: expect.stringMatching(/50.*character/i),
        })
      );
    });

    it("should warn when body content is too long (> 5000 tokens estimate)", () => {
      // Arrange
      // Approximate: ~4 chars per token, so 20000+ chars ≈ 5000+ tokens
      const longBody = "word ".repeat(5000); // ~25000 chars
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "A skill with very long body content for testing",
        },
        body: longBody,
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true); // Should still be valid
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: "LONG_CONTENT",
          message: expect.stringMatching(/5000.*token/i),
        })
      );
    });

    it("should accumulate multiple warnings", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Short", // Too short - warning
          // license missing - warning
        },
        body: "word ".repeat(5000), // Too long - warning
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true); // Should still be valid
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(3);
      
      const warningCodes = result.warnings.map((w: ValidationWarning) => w.code);
      expect(warningCodes).toContain("MISSING_RECOMMENDED_FIELD");
      expect(warningCodes).toContain("SHORT_DESCRIPTION");
      expect(warningCodes).toContain("LONG_CONTENT");
    });

    it("should not warn when license is present", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "A skill with license field present for validation testing",
          license: "MIT",
        },
        body: "# Test Skill",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          code: "MISSING_RECOMMENDED_FIELD",
          field: "license",
        })
      );
    });

    it("should not warn when description is 50 chars or longer", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "A".repeat(50), // Exactly 50 characters
        },
        body: "# Test Skill",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          code: "SHORT_DESCRIPTION",
        })
      );
    });

    it("should warn even when there are errors", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "INVALID-NAME", // Error: uppercase
          description: "Short", // Warning: too short
          // No license - Warning
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false); // Invalid due to errors
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0); // Warnings still present
    });
  });

  describe("ValidationResult Interface", () => {
    it("should return ValidationResult with correct structure", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing validation result structure",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(typeof result.valid).toBe("boolean");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it("should have properly structured ValidationError objects", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "INVALID",
          description: "",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.errors.length).toBeGreaterThan(0);
      result.errors.forEach((error: ValidationError) => {
        expect(error).toHaveProperty("code");
        expect(error).toHaveProperty("message");
        expect(typeof error.code).toBe("string");
        expect(typeof error.message).toBe("string");
        
        // field is optional
        if (error.field !== undefined) {
          expect(typeof error.field).toBe("string");
        }
      });
    });

    it("should have properly structured ValidationWarning objects", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Short",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.warnings.length).toBeGreaterThan(0);
      result.warnings.forEach((warning: ValidationWarning) => {
        expect(warning).toHaveProperty("code");
        expect(warning).toHaveProperty("message");
        expect(typeof warning.code).toBe("string");
        expect(typeof warning.message).toBe("string");
        
        // field is optional
        if (warning.field !== undefined) {
          expect(typeof warning.field).toBe("string");
        }
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle skill with only whitespace in name", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "   ",
          description: "Testing whitespace name",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle skill with only whitespace in description", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "   ",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: "INVALID_DESCRIPTION_LENGTH",
          field: "description",
        })
      );
    });

    it("should trim whitespace when validating name", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "  test-skill  ",
          description: "Testing name with surrounding whitespace",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      // Should validate based on trimmed value
      expect(result.valid).toBe(true);
    });

    it("should trim whitespace when validating description", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "  Valid description  ",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
    });

    it("should handle skill with undefined body", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing undefined body",
        },
        body: undefined as unknown as string,
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      // Body is not validated, so should still pass other validation
      expect(result.valid).toBe(true);
    });

    it("should handle skill with empty body", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing empty body",
        },
        body: "",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
    });

    it("should handle skill with very deeply nested metadata", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing deeply nested metadata",
          metadata: {
            level1: {
              level2: {
                level3: {
                  level4: {
                    level5: "deep value",
                  },
                },
              },
            },
          },
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("License Field Validation", () => {
    it("should allow any string value for license", () => {
      // Arrange
      const licenses = ["MIT", "Apache-2.0", "GPL-3.0", "BSD-3-Clause", "Proprietary", "Custom License"];
      
      licenses.forEach((license) => {
        const skill: Skill = {
          metadata: {
            name: "test-skill",
            description: "Testing license values",
            license,
          },
          body: "# Test",
        };

        // Act
        const result = validateSkill(skill);

        // Assert
        expect(result.valid).toBe(true);
      });
    });

    it("should allow empty license string", () => {
      // Arrange
      const skill: Skill = {
        metadata: {
          name: "test-skill",
          description: "Testing empty license",
          license: "",
        },
        body: "# Test",
      };

      // Act
      const result = validateSkill(skill);

      // Assert
      expect(result.valid).toBe(true);
    });
  });
});
