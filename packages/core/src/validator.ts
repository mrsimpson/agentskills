import Ajv from "ajv";
import schema from "./skill-frontmatter.schema.json" with { type: "json" };
import type { Skill, ValidationResult } from "./types.js";

// AJV v8 lacks an exports field, so moduleResolution:NodeNext sees the full CJS
// module namespace rather than the default export — cast once at construction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ajv = new (Ajv as any)({ validateSchema: false });
const validateFrontmatter = ajv.compile(schema) as {
  (data: unknown): boolean;
  errors: Array<{ message?: string }> | null;
};

export function validateSkill(skill: Skill): ValidationResult {
  const valid = validateFrontmatter(skill.metadata);
  return {
    valid,
    errors: valid
      ? []
      : (validateFrontmatter.errors ?? []).map((e) => ({
          message: e.message ?? "Validation error"
        })),
    warnings: []
  };
}
