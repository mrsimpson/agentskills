import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { SkillInstaller } from "../installer.js";
import type { InstallResult, SkillLockFile } from "../types.js";
import * as pacote from "pacote";

vi.mock("pacote", () => ({
  extract: vi.fn(),
  manifest: vi.fn(),
}));

describe("SkillInstaller", () => {
  let tempDir: string;
  let skillsDir: string;
  let cacheDir: string;
  let installer: SkillInstaller;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `skill-installer-test-${Date.now()}`);
    skillsDir = join(tempDir, "skills");
    cacheDir = join(tempDir, "cache");

    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.mkdir(cacheDir, { recursive: true });

    installer = new SkillInstaller(skillsDir, cacheDir);

    vi.mocked(pacote.extract).mockImplementation(async (spec: string, dest?: string, opts?: any) => {
      if (!dest) return {} as any;
      if (spec.includes("nonexistent")) throw new Error("Repository not found");
      
      await fs.mkdir(dest, { recursive: true });
      
      const skillName = spec.match(/skill-\w+|test-skill|cached-skill|existing-skill|nested-skill/)?.[0] || "test-skill";
      
      await fs.writeFile(join(dest, "SKILL.md"), `---\nname: ${skillName}\ndescription: Test skill\n---\n\n# ${skillName}`, "utf-8");
      
      if (opts?.cache) {
        await fs.mkdir(opts.cache, { recursive: true });
        await fs.writeFile(join(opts.cache, `${skillName}-cached.txt`), "cached", "utf-8");
      }
      
      return {} as any;
    });

    vi.mocked(pacote.manifest).mockResolvedValue({
      name: "test-skill",
      version: "1.0.0",
      _integrity: "sha512-abc123",
      dist: { integrity: "sha512-abc123" },
    } as any);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Constructor", () => {
    it("should throw error if skills directory is not provided", () => {
      expect(() => new SkillInstaller("")).toThrow();
    });
  });

  describe("install - Various sources", () => {
    it.each([
      ["github:user/test-skill#v1.0.0"],
      ["git+https://github.com/user/test-skill.git#v1.0.0"],
      ["git+ssh://git@github.com/user/test-skill.git#v1.0.0"],
      ["https://example.com/skills/test-skill.tgz"],
    ])("should install skill from spec %s", async (spec) => {
      const result = await installer.install("test-skill", spec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.name).toBe("test-skill");
        expect(result.spec).toBe(spec);
        expect(result.installPath).toBe(join(skillsDir, "test-skill"));
        expect(await fs.access(join(skillsDir, "test-skill", "SKILL.md")).then(() => true).catch(() => false)).toBe(true);
      }
    });

    it("should install from local directory", async () => {
      const localDir = join(tempDir, "local-skill");
      await fs.mkdir(localDir, { recursive: true });
      await fs.writeFile(join(localDir, "SKILL.md"), "---\nname: local-skill\ndescription: Local\n---", "utf-8");

      const result = await installer.install("local-skill", `file:${localDir}`);
      expect(result.success).toBe(true);
    });
  });

  describe("install - Error handling", () => {
    it.each([
      ["invalid-spec", "test-skill", "INVALID_SPEC"],
      ["", "test-skill", "INVALID_SPEC"],
    ])("should fail for invalid spec: %s", async (spec, name, expectedCode) => {
      const result = await installer.install(name, spec);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe(expectedCode);
      }
    });

    it("should fail when repository does not exist", async () => {
      const result = await installer.install("nonexistent-skill", "github:nonexistent/repo");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe("INSTALL_FAILED");
      }
    });

    it("should fail when SKILL.md is missing", async () => {
      const localDir = join(tempDir, "no-skill-md");
      await fs.mkdir(localDir, { recursive: true });
      await fs.writeFile(join(localDir, "README.md"), "No SKILL.md", "utf-8");

      const result = await installer.install("no-skill-md", `file:${localDir}`);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe("MISSING_SKILL_MD");
      }
    });

    it("should handle network errors", async () => {
      vi.mocked(pacote.extract).mockRejectedValueOnce(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
      const result = await installer.install("test-skill", "github:user/test-skill");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.code).toBe("NETWORK_ERROR");
      }
    });
  });

  describe("installAll - Multiple skills", () => {
    it("should install multiple skills in parallel", async () => {
      const skills = {
        "skill-one": "github:user/skill-one#v1.0.0",
        "skill-two": "github:user/skill-two#v1.0.0",
        "skill-three": "github:user/skill-three#v1.0.0",
      };

      const result = await installer.installAll(skills);
      expect(result.success).toBe(true);
      expect(result.installed.size).toBe(3);
      expect(result.failed.size).toBe(0);
    });

    it("should handle partial failures", async () => {
      const skills = {
        "valid-skill": "github:user/valid-skill",
        "invalid-skill": "invalid-spec",
        "another-valid": "github:user/another-valid",
      };

      const result = await installer.installAll(skills);
      expect(result.success).toBe(false);
      expect(result.installed.size).toBe(2);
      expect(result.failed.size).toBe(1);
      expect(result.failed.has("invalid-skill")).toBe(true);
    });
  });

  describe("Lock file operations", () => {
    it("should generate and read lock file", async () => {
      const installed: Record<string, InstallResult> = {
        "test-skill": {
          success: true,
          name: "test-skill",
          spec: "github:user/test-skill#v1.0.0",
          resolvedVersion: "v1.0.0",
          integrity: "sha512-abc",
          installPath: join(skillsDir, "test-skill"),
          manifest: { name: "test-skill", description: "Test" },
        },
      };

      await installer.generateLockFile(installed);

      const lockFilePath = join(skillsDir, "..", "skills-lock.json");
      const lockFile: SkillLockFile = JSON.parse(await fs.readFile(lockFilePath, "utf-8"));

      expect(lockFile.version).toBe("1.0");
      expect(lockFile.skills["test-skill"]).toBeDefined();
      expect(lockFile.skills["test-skill"].spec).toBe("github:user/test-skill#v1.0.0");

      const read = await installer.readLockFile();
      expect(read).not.toBeNull();
      expect(read?.skills).toHaveProperty("test-skill");
    });

    it("should return null when lock file does not exist or is invalid", async () => {
      expect(await installer.readLockFile()).toBeNull();

      const lockFilePath = join(skillsDir, "..", "skills-lock.json");
      await fs.writeFile(lockFilePath, "invalid json", "utf-8");
      expect(await installer.readLockFile()).toBeNull();
    });
  });

  describe("Cache behavior", () => {
    it("should use cache directory and reuse cached content", async () => {
      const spec = "github:user/test-skill#v1.0.0";
      
      await installer.install("cached-skill", spec);
      const cacheContents = await fs.readdir(cacheDir);
      expect(cacheContents.length).toBeGreaterThan(0);

      await fs.rm(join(skillsDir, "cached-skill"), { recursive: true, force: true });
      const secondResult = await installer.install("cached-skill", spec);
      expect(secondResult.success).toBe(true);
    });
  });

  describe("Clean installation", () => {
    it("should clean existing directory before install", async () => {
      const existingDir = join(skillsDir, "existing-skill");
      await fs.mkdir(existingDir, { recursive: true });
      await fs.writeFile(join(existingDir, "old-file.txt"), "old", "utf-8");

      const result = await installer.install("existing-skill", "github:user/test-skill");
      expect(result.success).toBe(true);
      expect(await fs.access(join(existingDir, "old-file.txt")).then(() => true).catch(() => false)).toBe(false);
      expect(await fs.access(join(existingDir, "SKILL.md")).then(() => true).catch(() => false)).toBe(true);
    });
  });

  describe("Integration - Full workflow", () => {
    it("should support complete install, lock, and reinstall workflow", async () => {
      const skills = {
        "skill-one": "github:user/skill-one#v1.0.0",
        "skill-two": "github:user/skill-two#v2.0.0",
      };

      const installResult = await installer.installAll(skills);
      expect(installResult.success).toBe(true);

      const installedResults: Record<string, InstallResult> = {};
      for (const [name, result] of Object.entries(installResult.results)) {
        if ((result as InstallResult).success) installedResults[name] = result as InstallResult;
      }

      await installer.generateLockFile(installedResults);
      const lockFile = await installer.readLockFile();
      
      expect(lockFile).not.toBeNull();
      expect(lockFile?.skills["skill-one"]).toBeDefined();
      expect(lockFile?.skills["skill-two"]).toBeDefined();
    });
  });
});
