import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getGlobalConfigDir,
  getGlobalPackageJsonPath
} from "../global-config-paths.js";
import { join } from "path";

describe("global-config-paths", () => {
  describe("getGlobalConfigDir", () => {
    it("should return a non-empty path", () => {
      const configDir = getGlobalConfigDir();
      expect(configDir).toBeTruthy();
      expect(typeof configDir).toBe("string");
      expect(configDir.length).toBeGreaterThan(0);
    });

    it("should return a path containing 'agentskills-mcp'", () => {
      const configDir = getGlobalConfigDir();
      expect(configDir).toContain("agentskills-mcp");
    });

    it("should return platform-specific path", () => {
      const configDir = getGlobalConfigDir();
      const platform = process.platform;

      if (platform === "win32") {
        // Windows: %APPDATA%\agentskills-mcp
        expect(configDir).toContain("agentskills-mcp");
      } else if (platform === "darwin" || platform === "linux") {
        // macOS/Linux: ~/.config/agentskills-mcp
        expect(configDir).toContain(".config");
        expect(configDir).toContain("agentskills-mcp");
      }
    });

    it("should return consistent path across multiple calls", () => {
      const path1 = getGlobalConfigDir();
      const path2 = getGlobalConfigDir();
      expect(path1).toBe(path2);
    });
  });

  describe("getGlobalPackageJsonPath", () => {
    it("should return path ending with package.json", () => {
      const packageJsonPath = getGlobalPackageJsonPath();
      expect(packageJsonPath).toMatch(/package\.json$/);
    });

    it("should return path within global config directory", () => {
      const configDir = getGlobalConfigDir();
      const packageJsonPath = getGlobalPackageJsonPath();
      expect(packageJsonPath).toBe(join(configDir, "package.json"));
    });

    it("should return absolute path", () => {
      const packageJsonPath = getGlobalPackageJsonPath();
      expect(packageJsonPath).toBeTruthy();
      // Absolute paths start with / on Unix or drive letter on Windows
      expect(
        packageJsonPath.startsWith("/") || /^[A-Za-z]:/.test(packageJsonPath)
      ).toBe(true);
    });

    it("should return consistent path across multiple calls", () => {
      const path1 = getGlobalPackageJsonPath();
      const path2 = getGlobalPackageJsonPath();
      expect(path1).toBe(path2);
    });
  });
});
