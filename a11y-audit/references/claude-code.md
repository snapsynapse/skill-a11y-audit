---
skill_bundle: a11y-audit
file_role: reference
version: 2
version_date: 2026-09-05
previous_version: 1
change_summary: >
  Adds v3 runtime and managed browser installation guidance.
---

# Claude Code Notes

Use this file only when running the skill in Claude Code.

## Runtime and installation

Verify Node.js 22.12.0 or later before invoking the bundled helpers. Read
`runtime-compatibility.md` when installing or upgrading the skill, changing
browser caches, or using skip-download settings. Installation may replace
stale skill-local Puppeteer and download Chrome; establish that scope before
running a scan. The bundled scanner supports Puppeteer only.

## Dev Server Discovery

- Check `.claude/launch.json` for project-specific launch targets, URLs,
  and environment hints before inventing a new startup command.
- If Claude Preview MCP tools are available and a local server needs to
  be started, prefer `preview_start` over ad hoc shell commands.
- If `.claude/launch.json`, package scripts, and repo docs disagree,
  report the mismatch before scanning.

## Workspace-Local Context

- Store mutable audit preferences in the target workspace, not in the
  installed skill directory.
- Default path: `.a11y-audit/PROJECT_CONTEXT.md` at the workspace root.
- If the project already keeps accessibility planning docs elsewhere,
  record those paths in the context file instead of duplicating content.

## Practical Guidance

- Prefer the Preview-provided URL when it differs from a guessed
  localhost port.
- Treat `.claude/launch.json` as a project hint, not as proof that the
  app is healthy. Confirm the selected URL responds before running scans.
