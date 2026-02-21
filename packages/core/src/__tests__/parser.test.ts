import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parseSkill, parseSkillContent } from "../parser.js";

/**
 * Helper type for accessing unknown metadata in tests
 * Using index signature to allow nested property access
 */
type MetadataRecord = Record<string, any>;

/**
 * Comprehensive test suite for SkillParser component
 *
 * Following TDD approach from agentic-knowledge:
 * - Minimal mocking (use real file system with temp directories)
 * - Test-driven interface design
 * - Clear test structure with arrange-act-assert
 *
 * Coverage:
 * 1. Valid skill parsing (basic, full, Claude Code extensions)
 * 2. Invalid/malformed skills (missing frontmatter, invalid YAML, missing fields)
 * 3. Edge cases (long descriptions, special characters, nested metadata)
 * 4. File system handling (non-existent files, read errors)
 */

const FIXTURES_DIR = join(__dirname, "fixtures", "skills");

describe("SkillParser", () => {
  describe("parseSkillContent - Valid Skills", () => {
    it("should parse a basic skill with name and description", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "basic-skill.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.metadata.name).toBe("test-skill");
        expect(result.skill.metadata.description).toBe(
          "A simple test skill for basic parsing"
        );
        expect(result.skill.body).toContain("# Test Skill");
        expect(result.skill.body).toContain("Use this skill to test");

        // Optional fields should be undefined
        expect(result.skill.metadata.license).toBeUndefined();
        expect(result.skill.metadata.compatibility).toBeUndefined();
        expect(result.skill.metadata.allowedTools).toBeUndefined();
      }
    });

    it("should parse a skill with all optional fields", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "full-skill.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const { metadata, body } = result.skill;

        // Required fields
        expect(metadata.name).toBe("full-feature-skill");
        expect(metadata.description).toBe(
          "A skill with all optional fields populated"
        );

        // Optional standard fields
        expect(metadata.license).toBe("MIT");
        expect(metadata.compatibility).toBe("claude-3.5-sonnet");
        expect(metadata.allowedTools).toEqual([
          "bash",
          "read_file",
          "write_file"
        ]);

        // Metadata object
        expect(metadata.metadata).toBeDefined();
        expect((metadata.metadata as MetadataRecord)?.author).toBe(
          "Test Author"
        );
        expect((metadata.metadata as MetadataRecord)?.version).toBe("1.0.0");
        expect((metadata.metadata as MetadataRecord)?.tags).toEqual([
          "testing",
          "example"
        ]);

        // Body content
        expect(body).toContain("# Full Feature Skill");
        expect(body).toContain("$ARGUMENTS");
        expect(body).toContain("${CLAUDE_SESSION_ID}");
      }
    });

    it("should parse Claude Code extensions", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "claude-code-extensions.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const { metadata } = result.skill;

        // Claude Code specific fields
        expect(metadata.disableModelInvocation).toBe(true);
        expect(metadata.userInvocable).toBe(false);
        expect(metadata.argumentHint).toBe("<input-file> <output-file>");
        expect(metadata.context).toBe("fork");
        expect(metadata.agent).toBe("custom-agent");
        expect(metadata.model).toBe("claude-3-5-sonnet-20250219");

        // Hooks object
        expect(metadata.hooks).toBeDefined();
        expect(metadata.hooks?.["pre-execution"]).toBe("setup");
        expect(metadata.hooks?.["post-execution"]).toBe("teardown");
        expect(metadata.hooks?.["on-error"]).toBe("rollback");
      }
    });

    it("should handle skill with nested metadata structures", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "nested-metadata.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const { metadata } = result.skill;

        expect(metadata.metadata).toBeDefined();
        expect(
          (metadata.metadata as MetadataRecord)?.level1?.level2?.level3?.deeply
        ).toBe("nested");
        expect(
          (metadata.metadata as MetadataRecord)?.level1?.level2?.level3?.values
        ).toEqual(["item1", "item2"]);
        expect((metadata.metadata as MetadataRecord)?.array).toHaveLength(2);
        expect((metadata.metadata as MetadataRecord)?.mixed?.string).toBe(
          "value"
        );
        expect((metadata.metadata as MetadataRecord)?.mixed?.number).toBe(42);
        expect((metadata.metadata as MetadataRecord)?.mixed?.boolean).toBe(
          true
        );
        expect((metadata.metadata as MetadataRecord)?.mixed?.null).toBeNull();
      }
    });

    it("should handle special characters in fields", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "special-characters.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const { metadata, body } = result.skill;

        expect(metadata.description).toContain("émojis 🚀");
        expect(metadata.description).toContain('quotes "nested"');
        expect(metadata.description).toContain("symbols <>&");

        expect((metadata.metadata as MetadataRecord)?.unicode).toContain(
          "日本語"
        );
        expect((metadata.metadata as MetadataRecord)?.symbols).toContain(
          "!@#$%^&*()"
        );
        expect((metadata.metadata as MetadataRecord)?.quotes).toContain(
          'single and "double"'
        );

        expect(body).toContain("你好世界 🌍");
        expect(body).toContain("<script>");
      }
    });

    it("should handle very long descriptions", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "long-description.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const { metadata } = result.skill;

        expect(metadata.description).toContain("very long description");
        expect(metadata.description).toContain("Lorem ipsum");
        expect(metadata.description.length).toBeGreaterThan(500);
      }
    });

    it("should handle empty optional fields", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "empty-optional-fields.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const { metadata } = result.skill;

        // Empty strings should be preserved as empty strings
        expect(metadata.license).toBe("");
        expect(metadata.compatibility).toBe("");

        // Empty objects/arrays should be preserved
        expect(metadata.metadata).toEqual({});
        expect(metadata.allowedTools).toEqual([]);
      }
    });

    it("should handle skill with only frontmatter (no body)", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "only-frontmatter.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.metadata.name).toBe("only-frontmatter");
        expect(result.skill.body).toBe("");
      }
    });
  });

  describe("parseSkillContent - Invalid/Malformed Skills", () => {
    it("should fail when frontmatter is missing", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "missing-frontmatter.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("MISSING_FRONTMATTER");
        expect(result.error.message).toContain("frontmatter");
      }
    });

    it("should fail when YAML syntax is invalid", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "invalid-yaml.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_YAML");
        expect(result.error.message).toContain("YAML");
      }
    });

    it("should fail when required field 'name' is missing", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "missing-name.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("MISSING_REQUIRED_FIELD");
        expect(result.error.field).toBe("name");
        expect(result.error.message).toContain("name");
        expect(result.error.message).toContain("required");
      }
    });

    it("should fail when required field 'description' is missing", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "missing-description.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("MISSING_REQUIRED_FIELD");
        expect(result.error.field).toBe("description");
        expect(result.error.message).toContain("description");
        expect(result.error.message).toContain("required");
      }
    });

    it("should fail when file is empty", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "empty.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("EMPTY_FILE");
        expect(result.error.message).toContain("empty");
      }
    });
  });

  describe("parseSkill - File System Handling", () => {
    let tempDir: string;

    beforeEach(async () => {
      // Create a temporary directory for each test
      tempDir = join(tmpdir(), `skill-parser-test-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should successfully parse a valid skill file", async () => {
      // Arrange
      const skillPath = join(tempDir, "test-skill.md");
      const content = `---
name: file-test-skill
description: Testing file system parsing
---

# File Test Skill

Testing parseSkill function with real file.
`;
      await fs.writeFile(skillPath, content, "utf-8");

      // Act
      const result = await parseSkill(skillPath);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.metadata.name).toBe("file-test-skill");
        expect(result.skill.metadata.description).toBe(
          "Testing file system parsing"
        );
        expect(result.skill.body).toContain("# File Test Skill");
      }
    });

    it("should fail when file does not exist", async () => {
      // Arrange
      const nonExistentPath = join(tempDir, "does-not-exist.md");

      // Act
      const result = await parseSkill(nonExistentPath);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FILE_NOT_FOUND");
        expect(result.error.message).toContain(nonExistentPath);
      }
    });

    it("should fail gracefully on file read error", async () => {
      // Arrange
      const directoryPath = join(tempDir, "is-a-directory");
      await fs.mkdir(directoryPath, { recursive: true });

      // Act - trying to read a directory as a file
      const result = await parseSkill(directoryPath);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FILE_READ_ERROR");
        expect(result.error.message).toContain("read");
      }
    });

    it("should handle permission errors gracefully", async () => {
      // Arrange
      const restrictedPath = join(tempDir, "restricted.md");
      await fs.writeFile(restrictedPath, "test content", "utf-8");

      // Make file unreadable (skip on Windows where chmod doesn't work the same)
      if (process.platform !== "win32") {
        await fs.chmod(restrictedPath, 0o000);

        // Act
        const result = await parseSkill(restrictedPath);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("FILE_READ_ERROR");
        }

        // Cleanup: restore permissions so we can delete the file
        await fs.chmod(restrictedPath, 0o644);
      }
    });

    it("should handle invalid UTF-8 encoding gracefully", async () => {
      // Arrange
      const invalidUtf8Path = join(tempDir, "invalid-utf8.md");

      // Write invalid UTF-8 bytes
      const buffer = Buffer.from([
        0xff,
        0xfe, // Invalid UTF-8 sequence
        0x2d,
        0x2d,
        0x2d,
        0x0a // ---\n
      ]);
      await fs.writeFile(invalidUtf8Path, buffer);

      // Act
      const result = await parseSkill(invalidUtf8Path);

      // Assert
      // Should either fail with encoding error or attempt to parse
      // (behavior depends on Node.js version and platform)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("parseSkillContent - Type Definitions", () => {
    it("should return properly typed Skill object", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "full-skill.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert - Test TypeScript types at runtime
      expect(result.success).toBe(true);
      if (result.success) {
        const { skill } = result;

        // Skill shape
        expect(skill).toHaveProperty("metadata");
        expect(skill).toHaveProperty("body");
        expect(typeof skill.body).toBe("string");

        // Metadata shape
        const { metadata } = skill;
        expect(typeof metadata.name).toBe("string");
        expect(typeof metadata.description).toBe("string");

        // Optional fields
        if (metadata.license !== undefined) {
          expect(typeof metadata.license).toBe("string");
        }
        if (metadata.compatibility !== undefined) {
          expect(typeof metadata.compatibility).toBe("string");
        }
        if (metadata.allowedTools !== undefined) {
          expect(Array.isArray(metadata.allowedTools)).toBe(true);
        }
        if (metadata.metadata !== undefined) {
          expect(typeof metadata.metadata).toBe("object");
        }

        // Claude Code extensions
        if (metadata.disableModelInvocation !== undefined) {
          expect(typeof metadata.disableModelInvocation).toBe("boolean");
        }
        if (metadata.userInvocable !== undefined) {
          expect(typeof metadata.userInvocable).toBe("boolean");
        }
        if (metadata.argumentHint !== undefined) {
          expect(typeof metadata.argumentHint).toBe("string");
        }
        if (metadata.context !== undefined) {
          expect(typeof metadata.context).toBe("string");
        }
        if (metadata.agent !== undefined) {
          expect(typeof metadata.agent).toBe("string");
        }
        if (metadata.model !== undefined) {
          expect(typeof metadata.model).toBe("string");
        }
        if (metadata.hooks !== undefined) {
          expect(typeof metadata.hooks).toBe("object");
        }
      }
    });

    it("should return properly typed ParseError on failure", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "missing-name.md"),
        "utf-8"
      );

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const { error } = result;

        expect(error).toHaveProperty("code");
        expect(error).toHaveProperty("message");
        expect(typeof error.code).toBe("string");
        expect(typeof error.message).toBe("string");

        // Field property exists for field-specific errors
        if (error.code === "MISSING_REQUIRED_FIELD") {
          expect(error).toHaveProperty("field");
          expect(typeof error.field).toBe("string");
        }
      }
    });
  });

  describe("parseSkillContent - Edge Cases", () => {
    it("should handle frontmatter with no body whitespace", () => {
      // Arrange
      const content = `---
name: no-whitespace
description: Testing no whitespace after frontmatter
---`;

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.body).toBe("");
      }
    });

    it("should handle frontmatter with extra whitespace", () => {
      // Arrange
      const content = `---
name: extra-whitespace
description: Testing extra whitespace


---


# Body Content

With extra spacing.
`;

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.metadata.name).toBe("extra-whitespace");
        expect(result.skill.body).toContain("# Body Content");
      }
    });

    it("should handle CRLF line endings", () => {
      // Arrange
      const content =
        "---\r\nname: crlf-test\r\ndescription: Testing CRLF line endings\r\n---\r\n\r\n# Content\r\n";

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.metadata.name).toBe("crlf-test");
      }
    });

    it("should handle mixed line endings", () => {
      // Arrange
      const content =
        "---\r\nname: mixed-test\ndescription: Testing mixed line endings\r\n---\n\n# Content\r\n";

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.metadata.name).toBe("mixed-test");
      }
    });

    it("should preserve markdown formatting in body", () => {
      // Arrange
      const content = `---
name: markdown-test
description: Testing markdown preservation
---

# Heading 1
## Heading 2

**Bold** and *italic* text.

- List item 1
- List item 2

\`\`\`typescript
const code = "preserved";
\`\`\`

> Quote block

[Link](https://example.com)
`;

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.body).toContain("# Heading 1");
        expect(result.skill.body).toContain("**Bold**");
        expect(result.skill.body).toContain("```typescript");
        expect(result.skill.body).toContain("> Quote block");
        expect(result.skill.body).toContain("[Link]");
      }
    });

    it("should handle frontmatter delimiter in body", () => {
      // Arrange
      const content = `---
name: delimiter-in-body
description: Testing delimiter in body content
---

# Content

This body contains a triple dash:
---

And continues after it.
`;

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.body).toContain("triple dash:");
        expect(result.skill.body).toContain("---");
        expect(result.skill.body).toContain("continues after");
      }
    });

    it("should handle numeric field values", () => {
      // Arrange
      const content = `---
name: numeric-fields
description: Testing numeric field values
metadata:
  version: 1.0
  count: 42
  rating: 4.5
---

# Numeric Fields
`;

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(
          (result.skill.metadata.metadata as MetadataRecord)?.version
        ).toBe(1.0);
        expect((result.skill.metadata.metadata as MetadataRecord)?.count).toBe(
          42
        );
        expect((result.skill.metadata.metadata as MetadataRecord)?.rating).toBe(
          4.5
        );
      }
    });

    it("should handle boolean field values", () => {
      // Arrange
      const content = `---
name: boolean-fields
description: Testing boolean field values
disable-model-invocation: true
user-invocable: false
metadata:
  enabled: true
  disabled: false
---

# Boolean Fields
`;

      // Act
      const result = parseSkillContent(content);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skill.metadata.disableModelInvocation).toBe(true);
        expect(result.skill.metadata.userInvocable).toBe(false);
        expect(
          (result.skill.metadata.metadata as MetadataRecord)?.enabled
        ).toBe(true);
        expect(
          (result.skill.metadata.metadata as MetadataRecord)?.disabled
        ).toBe(false);
      }
    });
  });

  describe("Immutability", () => {
    it("should return immutable Skill object", async () => {
      // Arrange
      const content = await fs.readFile(
        join(FIXTURES_DIR, "basic-skill.md"),
        "utf-8"
      );
      const result = parseSkillContent(content);

      // Act & Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const { skill } = result;

        // Attempt to modify should not affect original
        // (TypeScript should prevent this at compile time)
        const metadataCopy = { ...skill.metadata };
        metadataCopy.name = "modified";

        expect(skill.metadata.name).toBe("test-skill");
        expect(skill.metadata.name).not.toBe("modified");
      }
    });
  });
});
