import { describe, it, expect } from "vitest";
import { StringInterpolator } from "../interpolator";

/**
 * Comprehensive test suite for StringInterpolator component
 * 
 * Following TDD approach:
 * - Test-driven interface design
 * - Clear test structure with arrange-act-assert
 * - Comprehensive edge case coverage
 * 
 * Coverage:
 * 1. $ARGUMENTS placeholder (full arguments array)
 * 2. $ARGUMENTS[N] placeholder (specific argument by index)
 * 3. $N shorthand placeholder (specific argument)
 * 4. ${CLAUDE_SESSION_ID} placeholder (session identifier)
 * 5. Multiple placeholders (mixed types)
 * 6. Edge cases (escaping, partial matches, empty values)
 * 7. Error handling (null/undefined inputs)
 */

describe("StringInterpolator", () => {
  describe("$ARGUMENTS placeholder", () => {
    it("should replace $ARGUMENTS with all arguments joined by spaces", () => {
      // Arrange
      const content = "Running command with: $ARGUMENTS";
      const args = ["arg1", "arg2", "arg3"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Running command with: arg1 arg2 arg3");
    });

    it("should handle empty arguments array", () => {
      // Arrange
      const content = "Running command with: $ARGUMENTS";
      const args: string[] = [];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Running command with: ");
    });

    it("should handle single argument", () => {
      // Arrange
      const content = "Processing: $ARGUMENTS";
      const args = ["single-arg"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Processing: single-arg");
    });

    it("should preserve spaces within individual arguments", () => {
      // Arrange
      const content = "Command: $ARGUMENTS";
      const args = ["arg with spaces", "another arg"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Command: arg with spaces another arg");
    });

    it("should handle special characters in arguments", () => {
      // Arrange
      const content = "Special chars: $ARGUMENTS";
      const args = ["arg@123", "path/to/file", "value=test"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Special chars: arg@123 path/to/file value=test");
    });

    it("should handle multiple $ARGUMENTS placeholders", () => {
      // Arrange
      const content = "First: $ARGUMENTS, Second: $ARGUMENTS";
      const args = ["a", "b"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("First: a b, Second: a b");
    });

    it("should handle $ARGUMENTS in multi-line content", () => {
      // Arrange
      const content = `Line 1: $ARGUMENTS
Line 2: More text
Line 3: $ARGUMENTS again`;
      const args = ["arg1", "arg2"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe(`Line 1: arg1 arg2
Line 2: More text
Line 3: arg1 arg2 again`);
    });
  });

  describe("$ARGUMENTS[N] placeholder", () => {
    it("should replace $ARGUMENTS[0] with first argument", () => {
      // Arrange
      const content = "First arg: $ARGUMENTS[0]";
      const args = ["first", "second", "third"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("First arg: first");
    });

    it("should replace $ARGUMENTS[1] with second argument", () => {
      // Arrange
      const content = "Second arg: $ARGUMENTS[1]";
      const args = ["first", "second", "third"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Second arg: second");
    });

    it("should replace $ARGUMENTS[2] with third argument", () => {
      // Arrange
      const content = "Third arg: $ARGUMENTS[2]";
      const args = ["first", "second", "third"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Third arg: third");
    });

    it("should handle out of bounds index by returning empty string", () => {
      // Arrange
      const content = "Missing: $ARGUMENTS[5]";
      const args = ["first", "second"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Missing: ");
    });

    it("should handle multiple $ARGUMENTS[N] placeholders", () => {
      // Arrange
      const content = "Copy $ARGUMENTS[0] to $ARGUMENTS[1]";
      const args = ["source.txt", "dest.txt", "extra"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Copy source.txt to dest.txt");
    });

    it("should handle same index referenced multiple times", () => {
      // Arrange
      const content = "First: $ARGUMENTS[0], Again: $ARGUMENTS[0]";
      const args = ["value"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("First: value, Again: value");
    });

    it("should handle empty array with index access", () => {
      // Arrange
      const content = "Value: $ARGUMENTS[0]";
      const args: string[] = [];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Value: ");
    });

    it("should handle double-digit indices", () => {
      // Arrange
      const content = "Value: $ARGUMENTS[10]";
      const args = Array.from({ length: 15 }, (_, i) => `arg${i}`);

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Value: arg10");
    });
  });

  describe("$N shorthand placeholder", () => {
    it("should replace $0 with first argument", () => {
      // Arrange
      const content = "First: $0";
      const args = ["first", "second", "third"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("First: first");
    });

    it("should replace $1 with second argument", () => {
      // Arrange
      const content = "Second: $1";
      const args = ["first", "second", "third"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Second: second");
    });

    it("should replace $2 with third argument", () => {
      // Arrange
      const content = "Third: $2";
      const args = ["first", "second", "third"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Third: third");
    });

    it("should handle out of bounds shorthand index", () => {
      // Arrange
      const content = "Missing: $5";
      const args = ["first", "second"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Missing: ");
    });

    it("should handle multiple shorthand placeholders", () => {
      // Arrange
      const content = "mv $0 $1";
      const args = ["source.txt", "dest.txt"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("mv source.txt dest.txt");
    });

    it("should handle double-digit shorthand indices", () => {
      // Arrange
      const content = "Value: $10";
      const args = Array.from({ length: 15 }, (_, i) => `arg${i}`);

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Value: arg10");
    });

    it("should not confuse $1 with $10 or $11", () => {
      // Arrange
      const content = "Values: $1, $10, $11";
      const args = Array.from({ length: 15 }, (_, i) => `arg${i}`);

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Values: arg1, arg10, arg11");
    });
  });

  describe("${CLAUDE_SESSION_ID} placeholder", () => {
    it("should replace ${CLAUDE_SESSION_ID} with provided session ID", () => {
      // Arrange
      const content = "Session: ${CLAUDE_SESSION_ID}";
      const args = ["arg1"];
      const sessionId = "session-123-abc";

      // Act
      const result = StringInterpolator.interpolate(content, args, sessionId);

      // Assert
      expect(result).toBe("Session: session-123-abc");
    });

    it("should handle missing session ID by replacing with empty string", () => {
      // Arrange
      const content = "Session: ${CLAUDE_SESSION_ID}";
      const args = ["arg1"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Session: ");
    });

    it("should handle empty session ID", () => {
      // Arrange
      const content = "Session: ${CLAUDE_SESSION_ID}";
      const args = ["arg1"];
      const sessionId = "";

      // Act
      const result = StringInterpolator.interpolate(content, args, sessionId);

      // Assert
      expect(result).toBe("Session: ");
    });

    it("should handle multiple ${CLAUDE_SESSION_ID} placeholders", () => {
      // Arrange
      const content = "Start: ${CLAUDE_SESSION_ID}, End: ${CLAUDE_SESSION_ID}";
      const args: string[] = [];
      const sessionId = "sess-456";

      // Act
      const result = StringInterpolator.interpolate(content, args, sessionId);

      // Assert
      expect(result).toBe("Start: sess-456, End: sess-456");
    });

    it("should handle session ID with special characters", () => {
      // Arrange
      const content = "ID: ${CLAUDE_SESSION_ID}";
      const args: string[] = [];
      const sessionId = "sess_123-abc.def";

      // Act
      const result = StringInterpolator.interpolate(content, args, sessionId);

      // Assert
      expect(result).toBe("ID: sess_123-abc.def");
    });
  });

  describe("Multiple placeholder types", () => {
    it("should handle mix of $ARGUMENTS and $N placeholders", () => {
      // Arrange
      const content = "All: $ARGUMENTS, First: $0, Second: $1";
      const args = ["arg1", "arg2", "arg3"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("All: arg1 arg2 arg3, First: arg1, Second: arg2");
    });

    it("should handle mix of $ARGUMENTS[N] and $N placeholders", () => {
      // Arrange
      const content = "Index: $ARGUMENTS[0], Short: $0, Next: $1";
      const args = ["first", "second"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Index: first, Short: first, Next: second");
    });

    it("should handle all placeholder types together", () => {
      // Arrange
      const content =
        "Session ${CLAUDE_SESSION_ID}: $ARGUMENTS | $0 -> $ARGUMENTS[1]";
      const args = ["source", "target"];
      const sessionId = "sess-789";

      // Act
      const result = StringInterpolator.interpolate(content, args, sessionId);

      // Assert
      expect(result).toBe("Session sess-789: source target | source -> target");
    });

    it("should handle adjacent placeholders", () => {
      // Arrange
      const content = "$0$1$2";
      const args = ["a", "b", "c"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("abc");
    });

    it("should handle complex real-world example", () => {
      // Arrange
      const content =
        "\n# Task for session ${CLAUDE_SESSION_ID}\n\nExecute command: $0 with args: $ARGUMENTS\nSource: $ARGUMENTS[0]\nDestination: $ARGUMENTS[1]\nAll parameters: $ARGUMENTS\n";
      const args = ["copy", "file1.txt", "file2.txt"];
      const sessionId = "abc-123";

      // Act
      const result = StringInterpolator.interpolate(content, args, sessionId);

      // Assert
      expect(result).toBe(
        "\n# Task for session abc-123\n\nExecute command: copy with args: copy file1.txt file2.txt\nSource: copy\nDestination: file1.txt\nAll parameters: copy file1.txt file2.txt\n"
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle content with no placeholders", () => {
      // Arrange
      const content = "Just plain text with no placeholders";
      const args = ["arg1", "arg2"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Just plain text with no placeholders");
    });

    it("should not replace partial matches like $ARG", () => {
      // Arrange
      const content = "Partial: $ARG and $ARGUMENT";
      const args = ["test"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Partial: $ARG and $ARGUMENT");
    });

    it("should not replace $ARGUMENTS without proper boundary", () => {
      // Arrange
      const content = "Not a placeholder: MY$ARGUMENTS";
      const args = ["test"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Not a placeholder: MY$ARGUMENTS");
    });

    it("should handle escaped dollar signs ($$)", () => {
      // Arrange
      const content = "Price: $$100 and $0";
      const args = ["item"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Price: $100 and item");
    });

    it("should handle multiple escaped dollar signs", () => {
      // Arrange
      const content = "$$ARGUMENTS and $$$0";
      const args = ["test"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("$ARGUMENTS and $test");
    });

    it("should be case sensitive for placeholders", () => {
      // Arrange
      const content = "$arguments and $Arguments and $ARGUMENTS";
      const args = ["test"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("$arguments and $Arguments and test");
    });

    it("should handle dollar sign followed by non-digit", () => {
      // Arrange
      const content = "Value: $abc and $0";
      const args = ["test"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Value: $abc and test");
    });

    it("should handle numbers in argument content", () => {
      // Arrange
      const content = "Process: $0";
      const args = ["123", "456"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Process: 123");
    });

    it("should handle empty strings in arguments", () => {
      // Arrange
      const content = "Values: $0|$1|$2";
      const args = ["", "middle", ""];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Values: |middle|");
    });

    it("should handle unicode characters in arguments", () => {
      // Arrange
      const content = "Text: $0";
      const args = ["Hello 世界 🌍"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Text: Hello 世界 🌍");
    });

    it("should handle very long content", () => {
      // Arrange
      const longText = "x".repeat(10000);
      const content = `${longText} $0 ${longText}`;
      const args: string[] = ["middle"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe(`${longText} middle ${longText}`);
      expect(result.length).toBe(20000 + " middle ".length);
    });

    it("should handle many arguments", () => {
      // Arrange
      const manyArgs: string[] = Array.from({ length: 100 }, (_, i) => `arg${i}`);
      const content = "$50 and $99";

      // Act
      const result = StringInterpolator.interpolate(content, manyArgs);

      // Assert
      expect(result).toBe("arg50 and arg99");
    });

    it("should handle malformed ${...} that is not CLAUDE_SESSION_ID", () => {
      // Arrange
      const content = "Value: ${OTHER_VAR}";
      const args = ["test"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Value: ${OTHER_VAR}");
    });

    it("should handle incomplete bracket syntax", () => {
      // Arrange
      const content = "$ARGUMENTS[ and $ARGUMENTS[0";
      const args = ["test"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("$ARGUMENTS[ and $ARGUMENTS[0");
    });
  });

  describe("Error handling", () => {
    it("should handle empty content string", () => {
      // Arrange
      const content = "";
      const args = ["arg1"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("");
    });

    it("should handle content with only placeholders", () => {
      // Arrange
      const content = "$ARGUMENTS";
      const args = ["test"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("test");
    });

    it("should handle arguments array with only empty strings", () => {
      // Arrange
      const content = "Values: $ARGUMENTS";
      const args = ["", "", ""];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Values:   ");
    });

    it("should handle whitespace-only arguments", () => {
      // Arrange
      const content = "Values: [$0] [$1]";
      const args = [" ", "  "];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Values: [ ] [  ]");
    });

    it("should handle newlines in arguments", () => {
      // Arrange
      const content = "Multi-line: $0";
      const args = ["line1\nline2\nline3"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Multi-line: line1\nline2\nline3");
    });

    it("should handle tabs in arguments", () => {
      // Arrange
      const content = "Tabbed: $0";
      const args = ["col1\tcol2\tcol3"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("Tabbed: col1\tcol2\tcol3");
    });
  });

  describe("Performance and boundary conditions", () => {
    it("should handle zero-length arguments array efficiently", () => {
      // Arrange
      const content = "$ARGUMENTS $0 $1 $ARGUMENTS[0]";
      const args: string[] = [];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("   ");
    });

    it("should handle content with many placeholders efficiently", () => {
      // Arrange
      const placeholders = Array.from({ length: 50 }, (_, i) => `$${i}`).join(
        " "
      );
      const args = Array.from({ length: 50 }, (_, i) => `val${i}`);

      // Act
      const result = StringInterpolator.interpolate(placeholders, args);

      // Assert
      const expected = Array.from({ length: 50 }, (_, i) => `val${i}`).join(
        " "
      );
      expect(result).toBe(expected);
    });

    it("should preserve exact spacing between placeholders", () => {
      // Arrange
      const content = "$0  $1   $2";
      const args = ["a", "b", "c"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe("a  b   c");
    });
  });

  describe("Real-world usage scenarios", () => {
    it("should handle bash command interpolation", () => {
      // Arrange
      const content = "git commit -m $0 && git push $1 $2";
      const args = ["feat: add feature", "origin", "main"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe(
        "git commit -m feat: add feature && git push origin main"
      );
    });

    it("should handle markdown template interpolation", () => {
      // Arrange
      const content =
        "# $0\n\n## Description\n$1\n\n## Session\nID: ${CLAUDE_SESSION_ID}\n\n## All Args\n$ARGUMENTS";
      const args = ["Feature Title", "This is a detailed description"];
      const sessionId = "sess-abc-123";

      // Act
      const result = StringInterpolator.interpolate(content, args, sessionId);

      // Assert
      expect(result).toBe(
        "# Feature Title\n\n## Description\nThis is a detailed description\n\n## Session\nID: sess-abc-123\n\n## All Args\nFeature Title This is a detailed description"
      );
    });

    it("should handle JSON template interpolation", () => {
      // Arrange
      const content =
        '{\n  "session": "${CLAUDE_SESSION_ID}",\n  "command": "$0",\n  "args": "$ARGUMENTS",\n  "target": "$1"\n}';
      const args = ["deploy", "production"];
      const sessionId = "json-session-789";

      // Act
      const result = StringInterpolator.interpolate(content, args, sessionId);

      // Assert
      expect(result).toBe(
        '{\n  "session": "json-session-789",\n  "command": "deploy",\n  "args": "deploy production",\n  "target": "production"\n}'
      );
    });

    it("should handle file path operations", () => {
      // Arrange
      const content = "cp $0 $1 && chmod +x $1";
      const args = ["/source/path/script.sh", "/dest/path/script.sh"];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe(
        "cp /source/path/script.sh /dest/path/script.sh && chmod +x /dest/path/script.sh"
      );
    });

    it("should handle URL interpolation", () => {
      // Arrange
      const content = "curl -X POST https://api.example.com/$0 -d $1";
      const args = ["users/create", '{"name": "John"}'];

      // Act
      const result = StringInterpolator.interpolate(content, args);

      // Assert
      expect(result).toBe(
        'curl -X POST https://api.example.com/users/create -d {"name": "John"}'
      );
    });
  });
});
