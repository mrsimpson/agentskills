/**
 * StringInterpolator - Replaces placeholders in skill content with actual values
 * 
 * Supported placeholders:
 * - $ARGUMENTS: entire arguments array joined with spaces
 * - $ARGUMENTS[N]: specific argument by index (0-based)
 * - $N: shorthand for $ARGUMENTS[N]
 * - ${CLAUDE_SESSION_ID}: session identifier
 * 
 * @example
 * StringInterpolator.interpolate("Run $0 with $ARGUMENTS", ["test", "arg1", "arg2"])
 * // Returns: "Run test with test arg1 arg2"
 */
export class StringInterpolator {
  /**
   * Interpolate placeholders in content with actual values
   * 
   * @param content - The content string containing placeholders
   * @param args - Array of argument values
   * @param sessionId - Optional session identifier
   * @returns The content with placeholders replaced
   */
  static interpolate(
    content: string,
    args: string[] = [],
    sessionId?: string
  ): string {
    // Handle empty content
    if (!content) {
      return content;
    }

    // Ensure args is an array
    const safeArgs = args || [];

    let result = content;

    // Step 0: Handle escaped $$ FIRST by temporarily replacing with a placeholder
    // This prevents escaped dollars from being processed by other replacements
    const ESCAPED_DOLLAR_PLACEHOLDER = "\x00ESCAPED_DOLLAR\x00";
    result = result.replace(/\$\$/g, ESCAPED_DOLLAR_PLACEHOLDER);

    // Step 1: Replace ${CLAUDE_SESSION_ID} (curly braces - most specific)
    result = result.replace(/\$\{CLAUDE_SESSION_ID\}/g, sessionId || "");

    // Step 2: Replace $ARGUMENTS (but not $ARGUMENTS[N])
    // Use negative lookahead to avoid matching $ARGUMENTS[N]
    // Also need to ensure proper word boundary (not preceded by alphanumeric)
    result = result.replace(/(?<![A-Za-z0-9])\$ARGUMENTS(?!\[)/g, safeArgs.join(" "));

    // Step 3: Replace $ARGUMENTS[N] (longer pattern before $N)
    result = result.replace(/\$ARGUMENTS\[(\d+)\]/g, (_match, index) => {
      const idx = parseInt(index, 10);
      return safeArgs[idx] || "";
    });

    // Step 4: Replace $N shorthand (with proper boundary detection)
    // Match $ followed by digits, but ensure it's a complete number
    result = result.replace(/\$(\d+)(?!\d)/g, (_match, index) => {
      const idx = parseInt(index, 10);
      return safeArgs[idx] || "";
    });

    // Step 5: Restore escaped dollars (convert placeholder back to single $)
    result = result.replace(new RegExp(ESCAPED_DOLLAR_PLACEHOLDER, "g"), "$");

    return result;
  }
}
