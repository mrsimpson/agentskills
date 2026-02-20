---
name: claude-extensions
description: Testing Claude Code-specific extensions
disable-model-invocation: true
user-invocable: false
argument-hint: "<input-file> <output-file>"
context: fork
agent: custom-agent
model: claude-3-5-sonnet-20250219
hooks:
  pre-execution: setup
  post-execution: teardown
  on-error: rollback
---

# Claude Code Extensions Test

This skill tests all Claude Code-specific extensions.
