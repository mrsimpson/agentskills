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

  // Validate requiresMcpServers - optional field
  if (skill.metadata.requiresMcpServers !== undefined) {
    const mcpServers = skill.metadata.requiresMcpServers;

    // Must be an array
    if (!Array.isArray(mcpServers)) {
      errors.push({
        code: "INVALID_FIELD_TYPE",
        field: "requiresMcpServers",
        message: "RequiresMcpServers must be an array"
      });
    } else {
      // Validate each server in the array
      mcpServers.forEach((server, index) => {
        const serverPrefix = `requiresMcpServers[${index}]`;

        // Check if server is an object
        if (!server || typeof server !== "object" || Array.isArray(server)) {
          errors.push({
            code: "INVALID_FIELD_TYPE",
            field: serverPrefix,
            message: `Server at index ${index} must be an object`
          });
          return;
        }

        // Validate required fields: name, command, description
        if (!server.name) {
          errors.push({
            code: "MISSING_FIELD",
            field: `${serverPrefix}.name`,
            message: "Server name is required"
          });
        } else if (typeof server.name === "string") {
          // Validate server name format (lowercase-hyphens, no leading/trailing/consecutive hyphens)
          const hasConsecutiveHyphens = server.name.includes("--");
          const serverNamePattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

          if (hasConsecutiveHyphens || !serverNamePattern.test(server.name)) {
            errors.push({
              code: "INVALID_NAME_FORMAT",
              field: `${serverPrefix}.name`,
              message:
                "Server name must contain only lowercase letters, numbers, and hyphens; must start and end with alphanumeric; no consecutive hyphens"
            });
          }
        }

        if (!server.command) {
          errors.push({
            code: "MISSING_FIELD",
            field: `${serverPrefix}.command`,
            message: "Server command is required"
          });
        }

        if (!server.description) {
          errors.push({
            code: "MISSING_FIELD",
            field: `${serverPrefix}.description`,
            message: "Server description is required"
          });
        }

        // Validate optional fields
        if (server.args !== undefined) {
          if (!Array.isArray(server.args)) {
            errors.push({
              code: "INVALID_FIELD_TYPE",
              field: `${serverPrefix}.args`,
              message: "Server args must be an array"
            });
          }
        }

        if (server.env !== undefined) {
          if (
            !server.env ||
            typeof server.env !== "object" ||
            Array.isArray(server.env)
          ) {
            errors.push({
              code: "INVALID_FIELD_TYPE",
              field: `${serverPrefix}.env`,
              message: "Server env must be an object"
            });
          }
        }

        if (server.parameters !== undefined) {
          if (
            !server.parameters ||
            typeof server.parameters !== "object" ||
            Array.isArray(server.parameters)
          ) {
            errors.push({
              code: "INVALID_FIELD_TYPE",
              field: `${serverPrefix}.parameters`,
              message: "Server parameters must be an object"
            });
          } else {
            // Validate each parameter
            Object.entries(server.parameters).forEach(
              ([paramName, paramSpec]) => {
                const paramPrefix = `${serverPrefix}.parameters.${paramName}`;

                // Validate parameter name format (lowercase-hyphens, no consecutive hyphens)
                const hasConsecutiveHyphens = paramName.includes("--");
                const paramNamePattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

                if (
                  hasConsecutiveHyphens ||
                  !paramNamePattern.test(paramName)
                ) {
                  errors.push({
                    code: "INVALID_NAME_FORMAT",
                    field: paramPrefix,
                    message:
                      "Parameter name must contain only lowercase letters, numbers, and hyphens; must start and end with alphanumeric; no consecutive hyphens"
                  });
                }

                // Validate parameter spec
                if (!paramSpec || typeof paramSpec !== "object") {
                  errors.push({
                    code: "INVALID_FIELD_TYPE",
                    field: paramPrefix,
                    message: "Parameter spec must be an object"
                  });
                  return;
                }

                // Required fields: description, required
                if (paramSpec.description === undefined) {
                  errors.push({
                    code: "MISSING_FIELD",
                    field: `${paramPrefix}.description`,
                    message: "Parameter description is required"
                  });
                }

                if (paramSpec.required === undefined) {
                  errors.push({
                    code: "MISSING_FIELD",
                    field: `${paramPrefix}.required`,
                    message: "Parameter required field is required"
                  });
                }

                // Validate optional fields
                if (
                  paramSpec.default !== undefined &&
                  typeof paramSpec.default !== "string"
                ) {
                  errors.push({
                    code: "INVALID_FIELD_TYPE",
                    field: `${paramPrefix}.default`,
                    message: "Parameter default must be a string"
                  });
                }

                if (
                  paramSpec.example !== undefined &&
                  typeof paramSpec.example !== "string"
                ) {
                  errors.push({
                    code: "INVALID_FIELD_TYPE",
                    field: `${paramPrefix}.example`,
                    message: "Parameter example must be a string"
                  });
                }

                if (
                  paramSpec.sensitive !== undefined &&
                  typeof paramSpec.sensitive !== "boolean"
                ) {
                  errors.push({
                    code: "INVALID_FIELD_TYPE",
                    field: `${paramPrefix}.sensitive`,
                    message: "Parameter sensitive must be a boolean"
                  });
                }

                // Check for additional properties
                const allowedKeys = [
                  "description",
                  "required",
                  "default",
                  "example",
                  "sensitive"
                ];
                const extraKeys = Object.keys(paramSpec).filter(
                  (key) => !allowedKeys.includes(key)
                );
                if (extraKeys.length > 0) {
                  errors.push({
                    code: "INVALID_FIELD_TYPE",
                    field: paramPrefix,
                    message: `Parameter has unexpected fields: ${extraKeys.join(", ")}`
                  });
                }
              }
            );
          }
        }

        // Check for additional properties on server
        const allowedServerKeys = [
          "name",
          "package",
          "description",
          "command",
          "args",
          "env",
          "cwd",
          "parameters"
        ];
        const extraServerKeys = Object.keys(server).filter(
          (key) => !allowedServerKeys.includes(key)
        );
        if (extraServerKeys.length > 0) {
          errors.push({
            code: "INVALID_FIELD_TYPE",
            field: serverPrefix,
            message: `Server has unexpected fields: ${extraServerKeys.join(", ")}`
          });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
