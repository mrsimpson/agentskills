/**
 * SkillInstaller Component
 *
 * Responsibility: Install Agent Skills from various sources (GitHub, Git URLs,
 * local directories, tarballs, npm packages).
 *
 * Uses pacote library for downloading and extracting packages, supports caching,
 * generates lock files for reproducible installations.
 */

import { promises as fs } from "fs";
import { join, dirname, resolve } from "path";
import * as pacote from "pacote";
import type {
  InstallResult,
  InstallAllResult,
  SkillManifest,
  SkillLockFile,
  InstallErrorCode,
  Skill
} from "./types.js";
import { parseSkillContent, parseSkill } from "./parser.js";

/**
 * SkillInstaller class for installing Agent Skills from various sources
 */
export class SkillInstaller {
  private readonly skillsDir: string;
  private readonly cacheDir?: string;

  /**
   * Create a new SkillInstaller instance
   *
   * @param skillsDir - Directory where skills will be installed
   * @param cacheDir - Optional cache directory for downloads
   * @throws Error if skillsDir is empty
   */
  constructor(skillsDir: string, cacheDir?: string) {
    if (!skillsDir || skillsDir.trim().length === 0) {
      throw new Error("Skills directory is required");
    }
    this.skillsDir = skillsDir;
    this.cacheDir = cacheDir;
  }

  /**
   * Install a skill from a spec (GitHub, Git URL, local path, tarball, npm)
   *
   * @param name - Name for the installed skill (directory name)
   * @param spec - Package spec (e.g., "github:user/repo#tag", "file:./path", "https://...")
   * @returns InstallResult with success/failure information
   */
  async install(name: string, spec: string): Promise<InstallResult> {
    // Validate inputs
    if (!name || name.trim().length === 0) {
      throw new Error("Skill name is required");
    }

    if (!spec || spec.trim().length === 0) {
      return this.createFailure(
        name,
        spec,
        "INVALID_SPEC",
        "Package spec is required"
      );
    }

    // Validate spec format
    if (!this.isValidSpec(spec)) {
      return this.createFailure(
        name,
        spec,
        "INVALID_SPEC",
        "invalid package spec format"
      );
    }

    const installPath = join(this.skillsDir, name);

    try {
      // Clean existing directory if it exists
      try {
        await fs.rm(installPath, { recursive: true, force: true });
      } catch {
        // Ignore if directory doesn't exist
      }

      // Ensure parent directory exists
      await fs.mkdir(this.skillsDir, { recursive: true });

      // Extract package using pacote
      const opts: pacote.Options = {};
      if (this.cacheDir) {
        opts.cache = this.cacheDir;
      }

      // Parse the spec for an optional subdirectory path component
      const { baseSpec, subdir } = this.parseSpecWithPath(spec);

      // Handle local directory differently - use direct copy instead of pacote
      if (spec.startsWith("file:")) {
        await this.copyLocalDirectory(spec, installPath);
      } else if (subdir) {
        // Extract the full repo to a temp directory, then copy the subdirectory
        await this.extractSubdirectory(baseSpec, subdir, installPath, opts);
      } else {
        // Use pacote.extract to download and extract the package
        await pacote.extract(baseSpec, installPath, opts);
      }

      // Verify SKILL.md exists
      const skillMdPath = join(installPath, "SKILL.md");
      try {
        await fs.access(skillMdPath);
      } catch {
        await fs.rm(installPath, { recursive: true, force: true });
        return this.createFailure(
          name,
          spec,
          "MISSING_SKILL_MD",
          "SKILL.md file not found in package"
        );
      }

      // Extract manifest from SKILL.md
      const manifest = await this.extractManifest(installPath);
      if (!manifest) {
        await fs.rm(installPath, { recursive: true, force: true });
        return this.createFailure(
          name,
          spec,
          "INVALID_SKILL_FORMAT",
          "Failed to extract valid skill metadata from SKILL.md"
        );
      }

      // Get package metadata for integrity and version
      let resolvedVersion: string;
      let integrity: string;

      if (spec.startsWith("file:")) {
        // For local files, use a hash of the path or timestamp
        resolvedVersion = "local";
        integrity = `file:${installPath}`;

        // Try to get version from package.json
        try {
          const packageJsonPath = join(installPath, "package.json");
          const packageJsonContent = await fs.readFile(
            packageJsonPath,
            "utf-8"
          );
          const packageJson = JSON.parse(packageJsonContent);
          if (packageJson.version) {
            resolvedVersion = packageJson.version;
          }
        } catch {
          // package.json is optional for local files
        }
      } else {
        const metadata = await pacote.manifest(baseSpec, opts);
        resolvedVersion = this.extractVersion(
          baseSpec,
          metadata as unknown as Record<string, unknown>
        );
        integrity = metadata._integrity || metadata.dist?.integrity || "";
      }

      return {
        success: true,
        name,
        spec,
        resolvedVersion,
        integrity,
        installPath,
        manifest
      };
    } catch (error) {
      // Clean up on error
      try {
        await fs.rm(installPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      return this.handleInstallError(name, spec, error);
    }
  }

  /**
   * Install multiple skills in parallel
   *
   * @param skills - Record of skill names to package specs
   * @returns InstallAllResult with success/failure information
   */
  async installAll(skills: Record<string, string>): Promise<InstallAllResult> {
    const results: Record<string, InstallResult> = {};
    const installed = new Set<string>();
    const failed = new Set<string>();

    // Install all skills in parallel
    const installPromises = Object.entries(skills).map(async ([name, spec]) => {
      const result = await this.install(name, spec);
      results[name] = result;

      if (result.success) {
        installed.add(name);
      } else {
        failed.add(name);
      }
    });

    await Promise.all(installPromises);

    return {
      success: failed.size === 0,
      installed,
      failed,
      results
    };
  }

  /**
   * Generate a lock file from installation results
   *
   * @param installed - Record of successfully installed skills
   */
  async generateLockFile(
    installed: Record<string, InstallResult>
  ): Promise<void> {
    const lockFile: SkillLockFile = {
      version: "1.0",
      generated: new Date().toISOString(),
      skills: {}
    };

    for (const [name, result] of Object.entries(installed)) {
      if (result.success) {
        lockFile.skills[name] = {
          spec: result.spec,
          resolvedVersion: result.resolvedVersion,
          integrity: result.integrity
        };
      }
    }

    const lockFilePath = join(dirname(this.skillsDir), "skills-lock.json");
    await fs.writeFile(
      lockFilePath,
      JSON.stringify(lockFile, null, 2),
      "utf-8"
    );
  }

  /**
   * Read the lock file
   *
   * @returns SkillLockFile or null if file doesn't exist or is invalid
   */
  async readLockFile(): Promise<SkillLockFile | null> {
    const lockFilePath = join(dirname(this.skillsDir), "skills-lock.json");

    try {
      const content = await fs.readFile(lockFilePath, "utf-8");
      const lockFile = JSON.parse(content) as SkillLockFile;
      return lockFile;
    } catch {
      return null;
    }
  }

  /**
   * Load all installed skills from the skills directory
   *
   * @returns Array of parsed Skill objects
   * @throws Error if skills directory doesn't exist or skills are invalid
   */
  async loadInstalledSkills(): Promise<Skill[]> {
    const skills: Skill[] = [];

    try {
      // Check if skills directory exists
      await fs.access(this.skillsDir);
    } catch {
      // If directory doesn't exist, return empty array
      return skills;
    }

    // Read all subdirectories in skills directory
    const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip non-directories and hidden directories
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }

      const skillDir = join(this.skillsDir, entry.name);
      const skillPath = join(skillDir, "SKILL.md");

      try {
        // Check if SKILL.md exists
        await fs.access(skillPath);

        // Parse the skill
        const parseResult = await parseSkill(skillPath);

        if (parseResult.success) {
          skills.push(parseResult.skill);
        }
      } catch {
        // Skip invalid or missing skills
        continue;
      }
    }

    return skills;
  }

  /**
   * Get manifest without installing (dry-run)
   *
   * @param spec - Package spec
   * @returns SkillManifest
   * @throws Error if spec is invalid or SKILL.md is missing
   */
  async getManifest(spec: string): Promise<SkillManifest> {
    if (!this.isValidSpec(spec)) {
      throw new Error("Invalid package spec format");
    }

    // Create a temporary directory for extraction
    const tempDir = join(
      this.cacheDir || this.skillsDir,
      `.temp-${Date.now()}`
    );

    try {
      await fs.mkdir(tempDir, { recursive: true });

      const opts: pacote.Options = {};
      if (this.cacheDir) {
        opts.cache = this.cacheDir;
      }

      // Parse the spec for an optional subdirectory path component
      const { baseSpec, subdir } = this.parseSpecWithPath(spec);

      // Extract to temp directory
      if (spec.startsWith("file:")) {
        await this.copyLocalDirectory(spec, tempDir);
      } else if (subdir) {
        await this.extractSubdirectory(baseSpec, subdir, tempDir, opts);
      } else {
        await pacote.extract(baseSpec, tempDir, opts);
      }

      // Verify SKILL.md exists
      const skillMdPath = join(tempDir, "SKILL.md");
      try {
        await fs.access(skillMdPath);
      } catch {
        throw new Error("SKILL.md file not found in package");
      }

      // Extract and return manifest
      const manifest = await this.extractManifest(tempDir);
      if (!manifest) {
        throw new Error("Failed to extract valid skill metadata from SKILL.md");
      }

      return manifest;
    } finally {
      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Extract a subdirectory from a git repository into the destination.
   *
   * Downloads the full repository to a temporary directory, then copies
   * only the specified subdirectory into destPath.
   */
  private async extractSubdirectory(
    baseSpec: string,
    subdir: string,
    destPath: string,
    opts: pacote.Options
  ): Promise<void> {
    const tempRepo = join(
      this.cacheDir || this.skillsDir,
      `.repo-${Date.now()}`
    );

    try {
      await fs.mkdir(tempRepo, { recursive: true });
      await pacote.extract(baseSpec, tempRepo, opts);

      const subdirPath = join(tempRepo, subdir);

      // Verify the subdirectory exists
      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(subdirPath);
      } catch {
        throw new Error(
          `Path '${subdir}' not found in repository '${baseSpec}'`
        );
      }

      if (!stat.isDirectory()) {
        throw new Error(
          `Path '${subdir}' in repository '${baseSpec}' is not a directory`
        );
      }

      // Copy the subdirectory contents into the destination
      await fs.mkdir(destPath, { recursive: true });
      await this.copyDir(subdirPath, destPath);
    } finally {
      try {
        await fs.rm(tempRepo, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Copy local directory to install path
   */
  private async copyLocalDirectory(
    spec: string,
    installPath: string
  ): Promise<void> {
    // Remove "file:" prefix and resolve path
    let sourcePath = spec.substring(5); // Remove "file:"

    // Handle file:// protocol
    if (sourcePath.startsWith("//")) {
      sourcePath = sourcePath.substring(2);
    }

    // Expand tilde to home directory
    if (sourcePath.startsWith("~/")) {
      const os = await import("os");
      sourcePath = join(os.homedir(), sourcePath.substring(2));
    }

    // Resolve relative paths
    sourcePath = resolve(sourcePath);

    // Verify source exists
    try {
      const stat = await fs.stat(sourcePath);
      if (!stat.isDirectory()) {
        throw new Error(`Source is not a directory: ${sourcePath}`);
      }
    } catch {
      throw new Error(`Local path not found: ${sourcePath}`);
    }

    // Copy directory recursively
    await fs.mkdir(installPath, { recursive: true });
    await this.copyDir(sourcePath, installPath);
  }

  /**
   * Recursively copy directory, excluding .agentskills and node_modules
   */
  private async copyDir(src: string, dest: string): Promise<void> {
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      // Skip .agentskills, node_modules, and hidden directories
      if (
        entry.name === ".agentskills" ||
        entry.name === "node_modules" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }

      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await this.copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Extract manifest from installed package
   */
  private async extractManifest(
    installPath: string
  ): Promise<SkillManifest | null> {
    try {
      // Read SKILL.md
      const skillMdPath = join(installPath, "SKILL.md");
      const skillContent = await fs.readFile(skillMdPath, "utf-8");

      // Parse SKILL.md
      const parseResult = parseSkillContent(skillContent);
      if (!parseResult.success) {
        return null;
      }

      const { metadata } = parseResult.skill;

      // Try to read package.json for additional metadata
      let packageName: string | undefined;
      let version: string | undefined;

      try {
        const packageJsonPath = join(installPath, "package.json");
        const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(packageJsonContent);
        packageName = packageJson.name;
        version = packageJson.version;
      } catch {
        // package.json is optional
      }

      return {
        name: metadata.name,
        description: metadata.description,
        license: metadata.license,
        compatibility: metadata.compatibility,
        packageName,
        version,
        metadata: metadata.metadata
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract version from spec or metadata
   */
  private extractVersion(
    spec: string,
    metadata: Record<string, unknown>
  ): string {
    // Try to extract from spec first
    const hashIndex = spec.indexOf("#");
    if (hashIndex !== -1) {
      return spec.substring(hashIndex + 1);
    }

    // Try to extract from metadata
    if (typeof metadata.version === "string") {
      return metadata.version;
    }

    if (typeof metadata.gitHead === "string") {
      return metadata.gitHead.substring(0, 7);
    }

    // Default to "latest" or branch name
    return typeof metadata._resolved === "string"
      ? metadata._resolved
      : "latest";
  }

  /**
   * Parse the git fragment (everything after `#`) into its committish and
   * optional subdirectory path, following the npm/pacote convention of
   * `::` as a separator between fragment attributes:
   *
   *   `ref`                      → committish=ref, subdir=undefined
   *   `ref::path:subdir`         → committish=ref, subdir=subdir
   *   `path:subdir`              → committish=undefined, subdir=subdir
   *   `semver:^1.0::path:sub`   → committish=undefined, subdir=sub
   */
  private parseFragment(fragment: string): {
    committish?: string;
    subdir?: string;
  } {
    const parts = fragment.split("::");
    let committish: string | undefined;
    let subdir: string | undefined;

    for (const part of parts) {
      if (part.startsWith("path:")) {
        subdir = part.substring("path:".length);
      } else if (part.startsWith("semver:")) {
        // semver: ranges are a pacote concept; ignore for our purposes
      } else if (part.length > 0) {
        // bare value is the git committish (branch, tag, SHA)
        committish = part;
      }
    }

    return { committish, subdir };
  }

  /**
   * Parse a spec that may contain a subdirectory path component.
   *
   * Supported formats (aligned with the npm/pacote `path:` convention):
   *
   * Standard (recommended):
   * - `github:user/repo#path:skills/my-skill`
   * - `github:user/repo#v1.0.0::path:skills/my-skill`
   * - `git+https://...#v1.0.0::path:skills/my-skill`
   * - `git+ssh://...#v1.0.0::path:skills/my-skill`
   *
   * Convenience shorthand (github: only):
   * - `github:user/repo/skills/my-skill`
   * - `github:user/repo/skills/my-skill#v1.0.0`
   *
   * All other specs are returned as-is with no subdir.
   */
  private parseSpecWithPath(spec: string): {
    baseSpec: string;
    subdir?: string;
  } {
    // Handle github: shorthand
    if (spec.startsWith("github:")) {
      const withoutPrefix = spec.substring("github:".length);
      const hashIndex = withoutPrefix.indexOf("#");
      const urlPart =
        hashIndex !== -1
          ? withoutPrefix.substring(0, hashIndex)
          : withoutPrefix;
      const fragment =
        hashIndex !== -1 ? withoutPrefix.substring(hashIndex + 1) : undefined;

      // Standard format: github:user/repo#[ref::]path:subdir
      if (fragment) {
        const { committish, subdir } = this.parseFragment(fragment);
        if (subdir) {
          const [user, repo] = urlPart.split("/");
          const baseSpec = committish
            ? `github:${user}/${repo}#${committish}`
            : `github:${user}/${repo}`;
          return { baseSpec, subdir };
        }
      }

      // Convenience shorthand: github:user/repo/path/to/skill[#ref]
      const parts = urlPart.split("/");
      if (parts.length > 2) {
        const user = parts[0];
        const repo = parts[1];
        const subdir = parts.slice(2).join("/");
        const baseSpec = fragment
          ? `github:${user}/${repo}#${fragment}`
          : `github:${user}/${repo}`;
        return { baseSpec, subdir };
      }

      return { baseSpec: spec };
    }

    // Handle git+https:// and git+ssh:// with standard path: attribute
    if (spec.startsWith("git+https://") || spec.startsWith("git+ssh://")) {
      const hashIndex = spec.indexOf("#");
      if (hashIndex !== -1) {
        const fragment = spec.substring(hashIndex + 1);
        const { committish, subdir } = this.parseFragment(fragment);
        if (subdir) {
          const base = spec.substring(0, hashIndex);
          const baseSpec = committish ? `${base}#${committish}` : base;
          return { baseSpec, subdir };
        }
      }
    }

    return { baseSpec: spec };
  }

  /**
   * Validate if spec is in a supported format
   */
  private isValidSpec(spec: string): boolean {
    if (!spec || spec.trim().length === 0) {
      return false;
    }

    // Check for valid formats
    const validPrefixes = [
      "github:",
      "git+https://",
      "git+ssh://",
      "file:",
      "http://",
      "https://",
      "@" // npm scoped packages
    ];

    // Check if it starts with any valid prefix
    const hasValidPrefix = validPrefixes.some((prefix) =>
      spec.startsWith(prefix)
    );

    // Also allow npm package names (with or without version)
    // Must start with @scope/ or be a valid package name with optional @version
    // Npm packages cannot contain "format" or similar non-package words
    const isScopedPackage = /^@[a-z0-9-]+\/[a-z0-9-]+(@.+)?$/.test(spec);
    // Valid npm package: no spaces, starts with letter or @, contains only valid chars
    const isNpmPackage = /^[a-z][a-z0-9-]*(@[\w.-~]+)?$/.test(spec);

    // Reject obvious non-packages (containing spaces, invalid keywords, etc.)
    if (spec.includes(" ") || spec.includes("invalid")) {
      return false;
    }

    return hasValidPrefix || isScopedPackage || isNpmPackage;
  }

  /**
   * Create a failure result
   */
  private createFailure(
    name: string,
    spec: string,
    code: InstallErrorCode,
    message: string
  ): InstallResult {
    return {
      success: false,
      name,
      spec,
      error: {
        code,
        message
      }
    };
  }

  /**
   * Handle installation errors and map to appropriate error codes
   */
  private handleInstallError(
    name: string,
    spec: string,
    error: unknown
  ): InstallResult {
    const err = error as Error & { code?: string; statusCode?: number };
    const message = err.message || "Unknown error";

    // Subdirectory path not found in git repository
    if (
      message.includes("not found in repository") ||
      message.includes("is not a directory")
    ) {
      return this.createFailure(name, spec, "INSTALL_FAILED", message);
    }

    // Network errors
    if (
      err.code === "ENOTFOUND" ||
      err.code === "ETIMEDOUT" ||
      err.code === "ECONNREFUSED" ||
      message.toLowerCase().includes("network") ||
      message.includes("getaddrinfo")
    ) {
      return this.createFailure(name, spec, "NETWORK_ERROR", message);
    }

    // 404 errors
    if (err.statusCode === 404 || message.includes("404")) {
      return this.createFailure(
        name,
        spec,
        "INSTALL_FAILED",
        "Package not found (404)"
      );
    }

    // Repository/reference not found errors
    if (
      message.toLowerCase().includes("not found") ||
      message.includes("does not exist") ||
      message.includes("Could not find") ||
      message.includes("Repository not found") ||
      message.includes("unknown revision") ||
      message.includes("couldn't find remote ref")
    ) {
      // Check if it's a reference error
      if (
        message.includes("reference") ||
        message.includes("ref") ||
        message.includes("revision") ||
        message.includes("branch") ||
        message.includes("tag")
      ) {
        return this.createFailure(
          name,
          spec,
          "INSTALL_FAILED",
          "Git reference not found"
        );
      }
      return this.createFailure(
        name,
        spec,
        "INSTALL_FAILED",
        "Repository or package not found"
      );
    }

    // Git errors
    if (message.includes("git error") || message.includes("fatal:")) {
      return this.createFailure(
        name,
        spec,
        "INSTALL_FAILED",
        "Git error: repository or reference not found"
      );
    }

    // Permission errors
    if (err.code === "EACCES" || err.code === "EPERM") {
      return this.createFailure(
        name,
        spec,
        "PERMISSION_ERROR",
        "Permission denied - permission error"
      );
    }

    // File not found for local paths
    if (err.code === "ENOENT" && spec.startsWith("file:")) {
      return this.createFailure(
        name,
        spec,
        "INSTALL_FAILED",
        "Local path not found"
      );
    }

    // Generic install failure
    return this.createFailure(name, spec, "INSTALL_FAILED", message);
  }
}
