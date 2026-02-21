/**
 * Skill Validator
 *
 * Validates Agent Skills format against specification.
 * This is a stub implementation - tests define the expected behavior.
 *
 * Implementation to be completed following TDD approach.
 */

import type { Skill, ValidationResult } from "./types.js";

/**
 * Validate a skill against Agent Skills specification
 *
 * Validates:
 * - Required fields: name (1-64 chars, lowercase-hyphens), description (1-1024 chars)
 * - Optional fields: license, compatibility (1-500 chars), metadata, allowedTools
 * - Name format: lowercase letters, numbers, hyphens only, no leading/trailing/consecutive hyphens
 *
 * Returns ValidationResult with:
 * - valid: boolean indicating if skill passes validation
 * - errors: array of blocking validation errors
 * - warnings: array of non-blocking issues
 *
 * @param skill - The skill to validate
 * @returns ValidationResult with validation status, errors, and warnings
 */
export function validateSkill(skill: Skill): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  // Extract metadata for validation
  const { name, description, compatibility, metadata, allowedTools, license } =
    skill.metadata;

  // Validate name - required field
  if (name === undefined || name === null) {
    errors.push({
      code: "MISSING_FIELD",
      field: "name",
      message: "Field 'name' is required"
    });
  } else {
    const trimmedName = name.trim();

    // Check name length (after trimming)
    if (trimmedName.length < 1 || trimmedName.length > 64) {
      errors.push({
        code: "INVALID_NAME_LENGTH",
        field: "name",
        message: "Name must be between 1 and 64 characters"
      });
    }

    // Check name format if not empty
    if (trimmedName.length > 0) {
      // Check for leading hyphen
      if (trimmedName.startsWith("-")) {
        errors.push({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message: "Name must not start with a leading hyphen"
        });
      }

      // Check for trailing hyphen
      if (trimmedName.endsWith("-")) {
        errors.push({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message: "Name must not end with a trailing hyphen"
        });
      }

      // Check for consecutive hyphens
      if (trimmedName.includes("--")) {
        errors.push({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message: "Name must not contain consecutive hyphens"
        });
      }

      // Check for valid characters (lowercase letters, numbers, hyphens only)
      const validNamePattern = /^[a-z0-9-]+$/;
      if (!validNamePattern.test(trimmedName)) {
        errors.push({
          code: "INVALID_NAME_FORMAT",
          field: "name",
          message:
            "Name must contain only lowercase letters, numbers, and hyphens"
        });
      }
    }
  }

  // Validate description - required field
  if (description === undefined || description === null) {
    errors.push({
      code: "MISSING_FIELD",
      field: "description",
      message: "Field 'description' is required"
    });
  } else {
    const trimmedDescription = description.trim();

    // Check description length (after trimming)
    if (trimmedDescription.length < 1 || trimmedDescription.length > 1024) {
      errors.push({
        code: "INVALID_DESCRIPTION_LENGTH",
        field: "description",
        message: "Description must be between 1 and 1024 characters"
      });
    }

    // Warning: short description
    if (trimmedDescription.length > 0 && trimmedDescription.length < 50) {
      warnings.push({
        code: "SHORT_DESCRIPTION",
        field: "description",
        message: "Description should be at least 50 characters for clarity"
      });
    }
  }

  // Validate compatibility - optional field
  if (compatibility !== undefined) {
    if (compatibility.length > 500) {
      errors.push({
        code: "INVALID_COMPATIBILITY_LENGTH",
        field: "compatibility",
        message: "Compatibility must not exceed 500 characters"
      });
    }
  }

  // Validate metadata - optional field, must be object if present
  if (metadata !== undefined) {
    if (
      metadata === null ||
      Array.isArray(metadata) ||
      typeof metadata !== "object"
    ) {
      errors.push({
        code: "INVALID_FIELD_TYPE",
        field: "metadata",
        message: "Metadata must be an object"
      });
    }
  }

  // Validate allowedTools - optional field, must be array if present
  if (allowedTools !== undefined) {
    if (allowedTools === null || !Array.isArray(allowedTools)) {
      errors.push({
        code: "INVALID_FIELD_TYPE",
        field: "allowedTools",
        message: "AllowedTools must be an array"
      });
    }
  }

  // Warning: missing license (recommended field)
  if (license === undefined) {
    warnings.push({
      code: "MISSING_RECOMMENDED_FIELD",
      field: "license",
      message: "License field is recommended for skills"
    });
  }

  // Warning: long body content (> 20000 chars ≈ 5000 tokens)
  if (skill.body && skill.body.length > 20000) {
    warnings.push({
      code: "LONG_CONTENT",
      message:
        "Body content exceeds 5000 tokens estimate, which may impact performance"
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
