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

/**
 * The schema uses kebab-case property names (matching actual YAML frontmatter).
 * The parser converts these to camelCase for TypeScript usage, so we need to
 * reverse that mapping before validating against the schema.
 */
const CAMEL_TO_KEBAB: Record<string, string> = {
  allowedTools: "allowed-tools",
  disableModelInvocation: "disable-model-invocation",
  userInvocable: "user-invocable",
  argumentHint: "argument-hint",
  requiresMcpServers: "requires-mcp-servers"
};

function toRawYamlKeys(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const yamlKey = CAMEL_TO_KEBAB[key] ?? key;
    if (key === "allowedTools" && Array.isArray(value)) {
      result[yamlKey] = (value as string[]).join(" ");
    } else {
      result[yamlKey] = value;
    }
  }
  return result;
}

export function validateSkill(skill: Skill): ValidationResult {
  // Convert camelCase keys back to kebab-case so they match the schema's
  // property names (which mirror the actual YAML frontmatter format).
  const rawData = toRawYamlKeys(
    skill.metadata as unknown as Record<string, unknown>
  );
  const valid = validateFrontmatter(rawData);
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
