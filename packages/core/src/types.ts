/**
 * Type definitions for Agent Skills Parser
 * 
 * These types define the structure of parsed Agent Skills following
 * the Agent Skills standard and Claude Code extensions.
 */

/**
 * Metadata extracted from skill YAML frontmatter
 */
export interface SkillMetadata {
  // Required fields (Agent Skills standard)
  name: string;
  description: string;

  // Optional standard fields
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  allowedTools?: string[];

  // Claude Code extensions
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  argumentHint?: string;
  context?: string;
  agent?: string;
  model?: string;
  hooks?: Record<string, string>;
}

/**
 * Parsed skill with metadata and body content
 */
export interface Skill {
  metadata: SkillMetadata;
  body: string;
}

/**
 * Error codes for parsing failures
 */
export type ParseErrorCode =
  | "EMPTY_FILE"
  | "MISSING_FRONTMATTER"
  | "INVALID_YAML"
  | "MISSING_REQUIRED_FIELD"
  | "FILE_NOT_FOUND"
  | "FILE_READ_ERROR";

/**
 * Error information for parsing failures
 */
export interface ParseError {
  code: ParseErrorCode;
  message: string;
  field?: string; // For MISSING_REQUIRED_FIELD errors
}

/**
 * Successful parse result
 */
export interface ParseSuccess {
  success: true;
  skill: Skill;
}

/**
 * Failed parse result
 */
export interface ParseFailure {
  success: false;
  error: ParseError;
}

/**
 * Result of parsing a skill (discriminated union)
 */
export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Error codes for validation failures
 */
export type ValidationErrorCode =
  | "MISSING_FIELD"
  | "INVALID_NAME_LENGTH"
  | "INVALID_NAME_FORMAT"
  | "INVALID_DESCRIPTION_LENGTH"
  | "INVALID_COMPATIBILITY_LENGTH"
  | "INVALID_FIELD_TYPE";

/**
 * Warning codes for non-blocking validation issues
 */
export type ValidationWarningCode =
  | "MISSING_RECOMMENDED_FIELD"
  | "SHORT_DESCRIPTION"
  | "LONG_CONTENT";

/**
 * Validation error information
 */
export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  field?: string;
}

/**
 * Validation warning information
 */
export interface ValidationWarning {
  code: ValidationWarningCode;
  message: string;
  field?: string;
}

/**
 * Result of validating a skill
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Source configuration for loading skills
 */
export interface SkillSource {
  type: "local_directory";
  path: string;
  priority?: number;
}

/**
 * Result of loading skills into registry
 */
export interface LoadResult {
  loaded: number;
  failed: number;
  warnings: string[];
  errors: string[];
}

/**
 * Current state of the registry
 */
export interface RegistryState {
  skillCount: number;
  sources: string[];
  lastLoaded?: Date;
}
