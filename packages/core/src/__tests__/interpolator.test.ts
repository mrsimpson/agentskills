import { describe, it, expect } from "vitest";
import { StringInterpolator } from "../interpolator.js";

describe("StringInterpolator", () => {
  describe("$ARGUMENTS placeholder", () => {
    it("should replace $ARGUMENTS with all arguments", () => {
      expect(StringInterpolator.interpolate("cmd: $ARGUMENTS", ["a", "b", "c"])).toBe("cmd: a b c");
      expect(StringInterpolator.interpolate("cmd: $ARGUMENTS", [])).toBe("cmd: ");
      expect(StringInterpolator.interpolate("cmd: $ARGUMENTS", ["single"])).toBe("cmd: single");
    });

    it("should handle special cases", () => {
      expect(StringInterpolator.interpolate("$ARGUMENTS $ARGUMENTS", ["a"])).toBe("a a");
      expect(StringInterpolator.interpolate("cmd: $ARGUMENTS", ["arg with spaces", "another"])).toBe("cmd: arg with spaces another");
      expect(StringInterpolator.interpolate("Line 1: $ARGUMENTS\nLine 2: $ARGUMENTS", ["a", "b"])).toBe("Line 1: a b\nLine 2: a b");
    });
  });

  describe("$ARGUMENTS[N] placeholder", () => {
    it.each([
      [0, "first", "arg0"],
      [1, "second", "arg1"],
      [2, "third", "arg2"],
      [10, "double-digit", "arg10"],
    ])("should replace $ARGUMENTS[%d] with %s argument", (index, _, expected) => {
      const args = Array.from({ length: 15 }, (_, i) => `arg${i}`);
      expect(StringInterpolator.interpolate(`Value: $ARGUMENTS[${index}]`, args)).toBe(`Value: ${expected}`);
    });

    it("should handle edge cases", () => {
      expect(StringInterpolator.interpolate("$ARGUMENTS[5]", ["a", "b"])).toBe("");
      expect(StringInterpolator.interpolate("$ARGUMENTS[0] $ARGUMENTS[1]", ["src", "dst"])).toBe("src dst");
      expect(StringInterpolator.interpolate("$ARGUMENTS[0]", [])).toBe("");
    });
  });

  describe("$N shorthand placeholder", () => {
    it.each([
      [0, "arg0"],
      [1, "arg1"],
      [2, "arg2"],
      [10, "arg10"],
    ])("should replace $%d with correct argument", (index, expected) => {
      const args = Array.from({ length: 15 }, (_, i) => `arg${i}`);
      expect(StringInterpolator.interpolate(`Value: $${index}`, args)).toBe(`Value: ${expected}`);
    });

    it("should distinguish between similar indices", () => {
      const args = Array.from({ length: 15 }, (_, i) => `arg${i}`);
      expect(StringInterpolator.interpolate("$1, $10, $11", args)).toBe("arg1, arg10, arg11");
    });

    it("should handle out of bounds and multiple placeholders", () => {
      expect(StringInterpolator.interpolate("$5", ["a", "b"])).toBe("");
      expect(StringInterpolator.interpolate("mv $0 $1", ["src.txt", "dst.txt"])).toBe("mv src.txt dst.txt");
      expect(StringInterpolator.interpolate("$0$1$2", ["a", "b", "c"])).toBe("abc");
    });
  });

  describe("${CLAUDE_SESSION_ID} placeholder", () => {
    it("should replace with session ID", () => {
      expect(StringInterpolator.interpolate("Session: ${CLAUDE_SESSION_ID}", [], "sess-123")).toBe("Session: sess-123");
      expect(StringInterpolator.interpolate("${CLAUDE_SESSION_ID} ${CLAUDE_SESSION_ID}", [], "id")).toBe("id id");
    });

    it("should handle missing or empty session ID", () => {
      expect(StringInterpolator.interpolate("${CLAUDE_SESSION_ID}", [])).toBe("");
      expect(StringInterpolator.interpolate("${CLAUDE_SESSION_ID}", [], "")).toBe("");
    });
  });

  describe("Mixed placeholders", () => {
    it("should handle all placeholder types together", () => {
      expect(StringInterpolator.interpolate("All: $ARGUMENTS | First: $0 | Index: $ARGUMENTS[1]", ["a", "b", "c"])).toBe("All: a b c | First: a | Index: b");
      expect(StringInterpolator.interpolate("Session ${CLAUDE_SESSION_ID}: $0 -> $1", ["src", "dst"], "s123")).toBe("Session s123: src -> dst");
    });
  });

  describe("Edge cases", () => {
    it("should not replace partial matches", () => {
      expect(StringInterpolator.interpolate("$ARG $ARGUMENT MY$ARGUMENTS", ["test"])).toBe("$ARG $ARGUMENT MY$ARGUMENTS");
      expect(StringInterpolator.interpolate("${OTHER_VAR}", ["test"])).toBe("${OTHER_VAR}");
    });

    it("should handle escaped dollar signs", () => {
      expect(StringInterpolator.interpolate("$$100 and $0", ["item"])).toBe("$100 and item");
      expect(StringInterpolator.interpolate("$$ARGUMENTS and $$$0", ["test"])).toBe("$ARGUMENTS and $test");
    });

    it("should be case sensitive", () => {
      expect(StringInterpolator.interpolate("$arguments $Arguments $ARGUMENTS", ["test"])).toBe("$arguments $Arguments test");
    });

    it("should handle special content in arguments", () => {
      expect(StringInterpolator.interpolate("$0|$1|$2", ["", "mid", ""])).toBe("|mid|");
      expect(StringInterpolator.interpolate("$0", ["Hello 世界 🌍"])).toBe("Hello 世界 🌍");
      expect(StringInterpolator.interpolate("$0", ["line1\nline2"])).toBe("line1\nline2");
      expect(StringInterpolator.interpolate("$0", ["col1\tcol2"])).toBe("col1\tcol2");
    });

    it("should handle edge cases efficiently", () => {
      expect(StringInterpolator.interpolate("", ["a"])).toBe("");
      expect(StringInterpolator.interpolate("No placeholders", ["a"])).toBe("No placeholders");
      expect(StringInterpolator.interpolate("$ARGUMENTS $0 $ARGUMENTS[0]", [])).toBe("  ");
      expect(StringInterpolator.interpolate("$0  $1   $2", ["a", "b", "c"])).toBe("a  b   c");
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle bash commands", () => {
      expect(StringInterpolator.interpolate("git commit -m $0 && git push $1 $2", ["feat: add", "origin", "main"])).toBe("git commit -m feat: add && git push origin main");
      expect(StringInterpolator.interpolate("cp $0 $1 && chmod +x $1", ["/src/script.sh", "/dst/script.sh"])).toBe("cp /src/script.sh /dst/script.sh && chmod +x /dst/script.sh");
    });

    it("should handle structured templates", () => {
      const markdown = "# $0\n\nDescription: $1\nSession: ${CLAUDE_SESSION_ID}\nAll: $ARGUMENTS";
      expect(StringInterpolator.interpolate(markdown, ["Title", "Desc"], "s123")).toBe("# Title\n\nDescription: Desc\nSession: s123\nAll: Title Desc");
    });
  });
});
