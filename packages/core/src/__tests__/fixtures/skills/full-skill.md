---
name: full-feature-skill
description: A skill with all optional fields populated
license: MIT
compatibility: claude-3.5-sonnet
metadata:
  author: Test Author
  version: 1.0.0
  tags:
    - testing
    - example
allowed-tools:
  - bash
  - read_file
  - write_file
disable-model-invocation: false
user-invocable: true
argument-hint: "<task> <options>"
context: inline
agent: claude-default
model: claude-3-opus-20240229
hooks:
  pre-execution: validate-env
  post-execution: cleanup
---

# Full Feature Skill

This skill demonstrates all available features of the Agent Skills standard.

## Usage

Execute with `$ARGUMENTS` to see dynamic substitution.

Your session ID is: ${CLAUDE_SESSION_ID}

## Dynamic Context

Run this command to get context:
!`echo "Dynamic context"`

## Arguments

- First argument: $1
- Second argument: $2
- All arguments: $ARGUMENTS
