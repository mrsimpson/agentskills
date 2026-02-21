/**
 * JSON Schema for Agent Skills validation
 *
 * This module provides access to the skill JSON Schema and
 * utilities for schema-based validation using Ajv.
 */

import Ajv from "ajv";
import type { ValidateFunction, ErrorObject } from "ajv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load and parse the skill JSON Schema
 */
function loadSkillSchema(): object {
  const schemaPath = join(__dirname, "skill-schema.json");
  const schemaContent = readFileSync(schemaPath, "utf-8");
  return JSON.parse(schemaContent);
}

/**
 * Cached schema instance
 */
let cachedSchema: object | null = null;

/**
 * Get the skill JSON Schema
 * @returns The skill JSON Schema object
 */
export function getSkillSchema(): object {
  if (!cachedSchema) {
    cachedSchema = loadSkillSchema();
  }
  return cachedSchema;
}

/**
 * Cached Ajv validator instance
 */
let cachedValidator: ValidateFunction | null = null;

/**
 * Get or create an Ajv validator for the skill schema
 * @returns Ajv validator function
 */
export function getSkillValidator(): ValidateFunction {
  if (!cachedValidator) {
    const ajv = new Ajv.default({
      allErrors: true,
      verbose: true,
      strict: true
    });

    const schema = getSkillSchema();
    cachedValidator = ajv.compile(schema);
  }

  return cachedValidator as ValidateFunction;
}

/**
 * Validate skill metadata against the JSON Schema
 * @param metadata - Skill metadata object to validate
 * @returns true if valid, false otherwise (errors available via validator.errors)
 */
export function validateWithSchema(metadata: unknown): boolean {
  const validator = getSkillValidator();
  return validator(metadata);
}

/**
 * Get validation errors from the last validation
 * @returns Array of Ajv error objects
 */
export function getValidationErrors(): ErrorObject[] | null | undefined {
  const validator = getSkillValidator();
  return validator.errors;
}

/**
 * Export types for use in other modules
 */
export type { ValidateFunction, ErrorObject } from "ajv";
