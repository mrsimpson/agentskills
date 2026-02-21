/**
 * Type for parameter values that can be substituted into templates
 */
export type ParameterValues = Record<string, string | number | boolean>;

/**
 * Substitutes parameters in a template structure.
 *
 * Supports:
 * - {{VAR}} - substitutes from parameters object
 * - {{ENV:VAR_NAME}} - substitutes from environment variables
 * - Recursive processing of arrays and objects
 * - Non-string primitives pass through unchanged
 *
 * @param template - The template to process (string, array, object, or primitive)
 * @param parameters - Object containing parameter values
 * @returns The template with all parameters substituted
 * @throws Error if a required parameter is missing
 */
export function substituteParameters(
  template: unknown,
  parameters: ParameterValues
): unknown {
  // Handle null and undefined
  if (template === null || template === undefined) {
    return template;
  }

  // Handle strings - perform substitution
  if (typeof template === "string") {
    return substituteString(template, parameters);
  }

  // Handle arrays - recursively process each element
  if (Array.isArray(template)) {
    return template.map((item) => substituteParameters(item, parameters));
  }

  // Handle objects - recursively process each value (but not keys)
  if (typeof template === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = substituteParameters(value, parameters);
    }
    return result;
  }

  // Pass through primitives (numbers, booleans) unchanged
  return template;
}

/**
 * Substitutes parameters in a string template.
 *
 * @param str - The string template
 * @param parameters - Object containing parameter values
 * @returns The string with all parameters substituted
 * @throws Error if a required parameter is missing
 */
function substituteString(str: string, parameters: ParameterValues): string {
  // First, check for malformed placeholders with whitespace
  const whitespaceRegex = /\{\{\s+[A-Za-z0-9_-]+\s+\}\}/;
  if (whitespaceRegex.test(str)) {
    throw new Error("Placeholder contains whitespace");
  }

  // Regular expression to match {{VAR}} or {{ENV:VAR_NAME}}
  // Variable names can contain letters, numbers, underscores, and hyphens
  const regex = /\{\{(ENV:)?([A-Za-z0-9_-]+)\}\}/g;

  return str.replace(regex, (match, envPrefix, varName) => {
    // Check if it's an ENV variable
    if (envPrefix === "ENV:") {
      const envValue = process.env[varName];

      if (envValue === undefined) {
        throw new Error(
          `Required environment variable ${varName} not found in environment`
        );
      }

      return envValue;
    }

    // Regular parameter substitution
    const paramName = varName;

    // Check if parameter exists
    if (!(paramName in parameters)) {
      throw new Error(
        `Required parameter ${paramName} is required but missing`
      );
    }

    const value = parameters[paramName];

    // Convert value to string
    if (typeof value === "string") {
      return value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return match;
  });
}
